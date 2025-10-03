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

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Nota: OAuth2PasswordBearer espera un endpoint que acepte form-data,
# pero aquí solo lo usamos para extraer y validar el Bearer token.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


@router.post("/register", status_code=204)
def register_user(
    data: UserCreate,
    bg: BackgroundTasks,
    db: Session = Depends(get_db),
) -> Response:
    # El service crea el usuario y DEVUELVE el código generado
    code = service.register(db, data)

    # Enviar el email en segundo plano (y además el mailer imprime por consola)
    bg.add_task(send_verification_email, data.email, code)

    return Response(status_code=204)


@router.post("/verify", status_code=204)
def verify_user(payload: VerifyEmail, db: Session = Depends(get_db)) -> Response:
    service.verify_email(db, payload.email, payload.code)
    return Response(status_code=204)


@router.post("/login", response_model=Token)
def login_user(payload: UserLogin, db: Session = Depends(get_db)) -> Token:
    token = service.login(db, payload.email, payload.password)
    return {"access_token": token, "token_type": "bearer"}


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
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
        raise credentials_exception


@router.get("/me", response_model=UserOut)
def me(current: User = Depends(get_current_user)) -> UserOut:
    return current
