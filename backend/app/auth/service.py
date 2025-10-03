import secrets
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.auth.models import EmailCode, User
from app.auth.schemas import UserCreate
from app.core.config import settings
from app.core.security import create_access_token, hash_password, verify_password


def _extract_domain(email: str) -> str:
    # "user@alumnos.ugr.es" -> "alumnos.ugr.es"
    return email.split("@", 1)[1].lower()


def _is_allowed_domain(domain: str) -> bool:
    if not settings.allowed_email_domains:
        return True
    # permite subdominios: alumnos.ugr.es válido si ugr.es está permitido
    return any(domain == d or domain.endswith(f".{d}") for d in settings.allowed_email_domains)


def _issue_email_code(db: Session, email: str, purpose: str = "verify_email") -> str:
    """
    Crea y persiste un código de verificación de 6 dígitos con caducidad.
    Devuelve el código generado.
    """
    code = f"{secrets.randbelow(10**6):06d}"
    expires_at = datetime.now(UTC) + timedelta(minutes=settings.email_code_expire_minutes)
    db.add(EmailCode(email=email, code=code, purpose=purpose, expires_at=expires_at))
    db.commit()
    return code


def register(db: Session, data: UserCreate) -> None:
    domain = _extract_domain(data.email)
    if not _is_allowed_domain(domain):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Email domain '{domain}' is not allowed",
        )

    if db.query(User).filter(User.email == data.email).first():
        # Mensaje claro cuando el correo ya existe
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ya existe una cuenta registrada con el correo {data.email}",
        )

    try:
        user = User(email=data.email, password_hash=hash_password(data.password))
        db.add(user)
        db.commit()

        code = _issue_email_code(db, data.email)
        print(f"[UniGo] Código de verificación para {data.email}: {code}")  # consola
        return None
    except SQLAlchemyError as err:
        db.rollback()
        # B904: encadenar la excepción original
        raise HTTPException(status_code=500, detail="DB error durante el registro") from err


def verify_email(db: Session, email: str, code: str) -> None:
    rec = (
        db.query(EmailCode)
        .filter(
            EmailCode.email == email,
            EmailCode.purpose == "verify_email",
            EmailCode.consumed.is_(False),
        )
        .order_by(EmailCode.created_at.desc())
        .first()
    )

    if not rec:
        raise HTTPException(status_code=400, detail="No hay código pendiente")

    now = datetime.now(UTC)
    if rec.expires_at < now:
        raise HTTPException(status_code=400, detail="Código de verificación caducado")

    if code != rec.code:
        rec.attempts += 1
        db.commit()
        raise HTTPException(status_code=400, detail="Código de verificación inválido")

    rec.consumed = True
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    user.is_verified = True
    db.commit()


def login(db: Session, email: str, password: str) -> str:
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales inválidas"
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Usuario deshabilitado")
    if not user.is_verified:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Email no verificado")
    return create_access_token(sub=str(user.id))
