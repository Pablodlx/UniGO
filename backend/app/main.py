from fastapi import FastAPI

from app.auth.router import router as auth_router

app = FastAPI(title="UniGo", version="0.1.0")


@app.get("/health")
def health():
    return {"status": "ok"}


app.include_router(auth_router)
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001"],  # 👈 frontend en 3001
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
