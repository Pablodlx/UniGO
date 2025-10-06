from datetime import UTC, datetime, timedelta

from jose import jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(sub: str, expires_minutes: int | None = None) -> str:
    expire_delta = timedelta(
        minutes=expires_minutes or settings.access_token_expire_minutes
    )
    to_encode = {
        "sub": sub,
        "iat": int(datetime.now(UTC).timestamp()),
        "exp": int((datetime.now(UTC) + expire_delta).timestamp()),
    }
    return jwt.encode(to_encode, settings.secret_key, algorithm=ALGORITHM)
