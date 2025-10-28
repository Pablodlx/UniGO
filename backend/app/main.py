from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from app.auth.router import router as auth_router
from app.profile import router as profile_router
from app.rides import router as rides_router

# Import all models to ensure they're registered
from app.auth.models import User, Ride, Booking, EmailCode
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
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


app.include_router(auth_router)
app.include_router(profile_router.router, prefix="/api")
app.include_router(rides_router, prefix="/api")

# Mount static files for avatars
AVATAR_DIR = os.getenv("AVATAR_DIR", "data/avatars")
if os.path.exists(AVATAR_DIR):
    app.mount("/static/avatars", StaticFiles(directory=AVATAR_DIR), name="avatars")
