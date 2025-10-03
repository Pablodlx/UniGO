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


def _check_allowed_domain(email: str) -> None:
    if not settings.allowed_email_domains:
        return
    domain = _extract_domain(email)
    allowed = [d.lower().lstrip("@") for d in settings.allowed_email_domains]
    # Acepta si el dominio es exactamente el permitido o termina con ".permitido"
    ok = any(domain == base or domain.endswith("." + base) for base in allowed)
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Email domain '{domain}' is not allowed",
        )


def _issue_email_code(db: Session, email: str, purpose: str = "verify_email") -> str:
    """
    Crea un código de verificación de 6 dígitos y lo persiste.
    Devuelve el código generado.
    """
    code = f"{secrets.randbelow(10**6):06d}"
    expires_at = datetime.now(UTC) + timedelta(minutes=settings.email_code_expire_minutes)
    db.add(
        EmailCode(
            email=email,
            code=code,
            purpose=purpose,
            expires_at=expires_at,
            consumed=False,
        )
    )
    db.commit()
    return code


def register(db: Session, data: UserCreate) -> str:
    """
    Registra usuario (inactivo para features restringidas) y genera código.
    Devuelve el código para que el router lo envíe por email (y lo imprima en consola).
    """
    _check_allowed_domain(data.email)

    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ya existe una cuenta registrada con el correo {data.email}",
        )
    try:
        user = User(
            email=data.email,
            password_hash=hash_password(data.password),
            is_verified=False,
        )
        db.add(user)
        db.commit()

        code = _issue_email_code(db, data.email)
        print(f"[UniGo] Código de verificación para {data.email}: {code}")  # consola
        return code
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="DB error during registration")


def verify_email(db: Session, email: str, code: str) -> None:
    """
    Verifica el email comparando el último código no consumido y no expirado.
    """
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
        raise HTTPException(status_code=400, detail="No pending verification code")

    now = datetime.now(UTC)
    if rec.expires_at < now:
        raise HTTPException(status_code=400, detail="Verification code expired")

    if code != rec.code:
        rec.attempts = (rec.attempts or 0) + 1
        db.commit()
        raise HTTPException(status_code=400, detail="Invalid verification code")

    # marcar consumido y usuario verificado
    rec.consumed = True
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_verified = True
    db.commit()


def login(db: Session, email: str, password: str) -> str:
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User disabled")
    if not user.is_verified:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Email not verified")
    return create_access_token(sub=str(user.id))
