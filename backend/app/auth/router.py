# backend/app/auth/router.py
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Response, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.auth import service
from app.auth.models import User
from app.auth.schemas import Token, UserCreate, UserLogin, UserOut, VerifyEmail
from app.core.config import settings
from app.core.mailer import send_verification_email
from app.db.session import get_db

# Nota: este router ya incluye el prefijo /api; en main.py se debe incluir SIN prefijo adicional.
router = APIRouter(prefix="/api/auth", tags=["auth"])

# OAuth2PasswordBearer lo usamos para extraer el Bearer token del Authorization header
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


@router.post("/register", status_code=204)
def register_user(
    data: UserCreate,
    bg: BackgroundTasks,
    db: Session = Depends(get_db),
) -> Response:
    """
    Crea/actualiza usuario y genera un código de verificación.
    Envía el email en segundo plano (mailer síncrono con kwargs).
    """
    code = service.register(db, data)  # debe devolver el string de 6 dígitos

    # ⚠️ IMPORTANTE: pasar argumentos por nombre (la función no acepta posicionales)
    bg.add_task(send_verification_email, to_email=data.email, code=code)
    return Response(status_code=204)


@router.post("/verify", status_code=204)
def verify_user(payload: VerifyEmail, db: Session = Depends(get_db)) -> Response:
    """
    Verifica el email con el código recibido.
    """
    service.verify_email(db, payload.email, payload.code)
    return Response(status_code=204)


@router.post("/login", response_model=Token)
def login_user(payload: UserLogin, db: Session = Depends(get_db)) -> Token:
    """
    Login con email + contraseña. Devuelve un JWT si son correctos.
    """
    token = service.login(db, payload.email, payload.password)
    return {"access_token": token, "token_type": "bearer"}


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    Extrae el usuario actual a partir del Bearer token.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        data = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
        sub = data.get("sub")
        if not sub:
            raise credentials_exception
        user = db.get(User, int(sub))
        if not user:
            raise credentials_exception
        return user
    except JWTError:
        raise credentials_exception from None


@router.get("/me", response_model=UserOut)
def me(current: User = Depends(get_current_user)) -> UserOut:
    """
    Devuelve los datos públicos del usuario autenticado.
    """
    return current
