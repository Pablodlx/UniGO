from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

from app.auth.router import router as auth_router
from app.profile import router as profile_router
from app.rides import router as rides_router
from app.ratings import router as ratings_router
from app.chat.router import router as chat_router
from app.trip_chat.router import router as trip_chat_router
from app.notifications.router import router as notifications_router
from app.search_alerts.router import router as search_alerts_router

# Import all models to ensure they're registered
from app.auth.models import User, Ride, Booking, EmailCode, Rating, FavoriteRide, Message, TripGroupMessage, Notification, SearchAlert
from app.db.session import Base, engine

# Create all tables if they don't exist (development only)
from sqlalchemy import inspect
inspector = inspect(engine)
if 'bookings' not in inspector.get_table_names():
    from sqlalchemy import text
    with engine.connect() as conn:
        conn.execute(text("""
            CREATE TABLE bookings (
                id SERIAL PRIMARY KEY,
                ride_id INTEGER NOT NULL REFERENCES rides(id),
                passenger_id INTEGER NOT NULL REFERENCES users(id),
                status VARCHAR(50) NOT NULL,
                seats INTEGER NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL
            );
        """))
        conn.execute(text("CREATE INDEX ix_bookings_ride_id ON bookings (ride_id);"))
        conn.execute(text("CREATE INDEX ix_bookings_passenger_id ON bookings (passenger_id);"))
        conn.commit()

app = FastAPI(title="UniGo", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://127.0.0.1:3001",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Setup avatar directory first (before routes and endpoints)
AVATAR_DIR = os.getenv("AVATAR_DIR", "data/avatars")
# Convert to absolute path if relative
if not os.path.isabs(AVATAR_DIR):
    # Get backend directory (parent of app/)
    # __file__ is app/main.py, so dirname(dirname(__file__)) = backend/
    current_file = os.path.abspath(__file__)  # /path/to/backend/app/main.py
    backend_dir = os.path.dirname(os.path.dirname(current_file))  # /path/to/backend
    AVATAR_DIR = os.path.join(backend_dir, AVATAR_DIR)  # /path/to/backend/data/avatars

# Create directory if it doesn't exist
os.makedirs(AVATAR_DIR, exist_ok=True)
print(f"✅ Avatar directory configured: {AVATAR_DIR}")
print(f"✅ Avatar directory exists: {os.path.exists(AVATAR_DIR)}")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/static/avatars/{filename}")
async def serve_avatar(filename: str):
    """Serve avatar files directly"""
    try:
        print(f"📸 Serving avatar: {filename}")
        print(f"📁 AVATAR_DIR: {AVATAR_DIR}")
        
        # Get absolute paths
        real_avatar_dir = os.path.abspath(AVATAR_DIR)
        file_path = os.path.join(real_avatar_dir, filename)
        real_file_path = os.path.abspath(file_path)
        
        print(f"📂 File path: {file_path}")
        print(f"📂 Real file path: {real_file_path}")
        print(f"📂 Real avatar dir: {real_avatar_dir}")
        
        # Security: prevent directory traversal
        if not real_file_path.startswith(real_avatar_dir):
            print(f"❌ Security check failed: {real_file_path} not in {real_avatar_dir}")
            raise HTTPException(status_code=403, detail="Forbidden")
        
        # Check if file exists
        if not os.path.exists(file_path):
            print(f"❌ File does not exist: {file_path}")
            raise HTTPException(status_code=404, detail=f"Avatar not found: {filename}")
        
        if not os.path.isfile(file_path):
            print(f"❌ Not a file: {file_path}")
            raise HTTPException(status_code=404, detail=f"Not a file: {filename}")
        
        # Determine media type
        if filename.lower().endswith(".png"):
            media_type = "image/png"
        elif filename.lower().endswith((".jpg", ".jpeg")):
            media_type = "image/jpeg"
        else:
            media_type = "image/png"  # default
        
        print(f"✅ Serving file: {file_path} as {media_type}")
        return FileResponse(file_path, media_type=media_type)
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"❌ Error serving avatar {filename}: {e}")
        print(f"❌ Traceback: {error_trace}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@app.get("/debug/config")
def debug_config():
    """Debug endpoint to check if Google Maps API key is loaded"""
    from app.core.config import settings
    import os
    
    # Check environment variable directly
    env_key = os.getenv("GOOGLE_MAPS_API_KEY")
    
    return {
        "settings_google_maps_api_key": settings.google_maps_api_key,
        "env_GOOGLE_MAPS_API_KEY": env_key,
        "api_key_configured": bool(settings.google_maps_api_key),
        "api_key_length": len(settings.google_maps_api_key) if settings.google_maps_api_key else 0,
    }

app.include_router(auth_router)
app.include_router(profile_router.router, prefix="/api")
app.include_router(rides_router, prefix="/api")
app.include_router(ratings_router, prefix="/api")
app.include_router(chat_router, prefix="/api")
app.include_router(trip_chat_router, prefix="/api")
from app.rides.passengers_router import router as passengers_router
app.include_router(passengers_router, prefix="/api")
from app.bookings.router import router as bookings_router
app.include_router(bookings_router, prefix="/api")
app.include_router(notifications_router, prefix="/api")
app.include_router(search_alerts_router, prefix="/api")
