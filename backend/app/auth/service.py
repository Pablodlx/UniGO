import re
import secrets
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.auth.models import EmailCode, User
from app.auth.schemas import UserCreate
from app.core.config import settings
from app.core.security import create_access_token, hash_password, verify_password


# Mapping of email domains to university names
EMAIL_DOMAIN_TO_UNIVERSITY = {
    "ual.es": "Universidad de Almería",
    "uca.es": "Universidad de Cádiz",
    "uco.es": "Universidad de Córdoba",
    "ugr.es": "Universidad de Granada",
    "uhu.es": "Universidad de Huelva",
    "us.es": "Universidad de Sevilla",
    "uma.es": "Universidad de Málaga",
    "ujaen.es": "Universidad de Jaén",
    "unia.es": "Universidad Internacional de Andalucía",
    "ua.es": "Universidad de Alicante",
    "uji.es": "Universitat Jaume I (Castellón)",
    "umh.es": "Universidad Miguel Hernández de Elche",
    "uv.es": "Universitat de València",
    "upv.es": "Universitat Politècnica de València",
    "uam.es": "Universidad Autónoma de Madrid",
    "ucm.es": "Universidad Complutense de Madrid",
    "upm.es": "Universidad Politécnica de Madrid",
    "uc3m.es": "Universidad Carlos III de Madrid",
    "urjc.es": "Universidad Rey Juan Carlos",
    "uah.es": "Universidad de Alcalá",
    "usal.es": "Universidad de Salamanca",
    "uva.es": "Universidad de Valladolid",
    "ubu.es": "Universidad de Burgos",
    "unileon.es": "Universidad de León",
    "unican.es": "Universidad de Cantabria",
    "uniovi.es": "Universidad de Oviedo",
    "uex.es": "Universidad de Extremadura",
    "uclm.es": "Universidad de Castilla-La Mancha",
    "unizar.es": "Universidad de Zaragoza",
    "ull.es": "Universidad de La Laguna",
    "ulpgc.es": "Universidad de Las Palmas de Gran Canaria",
    "uib.es": "Universitat de les Illes Balears",
    "um.es": "Universidad de Murcia",
    "ucam.edu": "Universidad Católica San Antonio de Murcia (UCAM)",
    "upct.es": "Universidad Politécnica de Cartagena",
    "upna.es": "Universidad Pública de Navarra",
    "unavarra.es": "Universidad Pública de Navarra",
    "ehu.eus": "Universidad del País Vasco (UPV/EHU)",
    "deusto.es": "Universidad de Deusto",
    "mondragon.edu": "Mondragón Unibertsitatea",
    "ub.edu": "Universitat de Barcelona",
    "uab.cat": "Universitat Autònoma de Barcelona",
    "upc.edu": "Universitat Politècnica de Catalunya",
    "upf.edu": "Universitat Pompeu Fabra",
    "urv.cat": "Universitat Rovira i Virgili",
    "udl.cat": "Universitat de Lleida",
    "uvic.cat": "Universitat de Vic – Universitat Central de Catalunya",
    "uoc.edu": "Universitat Oberta de Catalunya",
    "unav.edu": "Universidad de Navarra",
    "cunef.edu": "CUNEF Universidad",
    "comillas.edu": "Universidad Pontificia Comillas",
    "ceu.es": "Fundación Universitaria San Pablo CEU",
    "uax.es": "Universidad Alfonso X el Sabio",
    "ufv.es": "Universidad Francisco de Vitoria",
    "nebrija.es": "Universidad Nebrija",
    "uic.es": "Universitat Internacional de Catalunya",
    "unir.net": "Universidad Internacional de La Rioja",
    "ui1.es": "Universidad Isabel I",
    "viu.es": "Universidad Internacional de Valencia",
    "esade.edu": "ESADE",
    "esic.edu": "ESIC Universidad",
}


def _extract_domain(email: str) -> str:
    # "user@alumnos.ugr.es" -> "alumnos.ugr.es"
    return email.split("@", 1)[1].lower()


def _get_base_domain(domain: str) -> str:
    """
    Extract base domain from a subdomain.
    Examples:
    - "alumnos.ugr.es" -> "ugr.es"
    - "ugr.es" -> "ugr.es"
    - "mail.unizar.es" -> "unizar.es"
    """
    parts = domain.split(".")
    # Take last two parts for .es, .edu, .cat, .eus domains
    if len(parts) >= 2:
        return ".".join(parts[-2:])
    return domain


def _detect_university_from_email(email: str) -> str | None:
    """
    Detect university name from email domain.
    Returns the university name or None if not found.
    """
    domain = _extract_domain(email)
    base_domain = _get_base_domain(domain)
    
    # Try exact match first
    if base_domain in EMAIL_DOMAIN_TO_UNIVERSITY:
        return EMAIL_DOMAIN_TO_UNIVERSITY[base_domain]
    
    # Try full domain match (for subdomains)
    if domain in EMAIL_DOMAIN_TO_UNIVERSITY:
        return EMAIL_DOMAIN_TO_UNIVERSITY[domain]
    
    # Try partial match for subdomains (e.g., "alumnos.ugr.es" -> check "ugr.es")
    for allowed_domain, university in EMAIL_DOMAIN_TO_UNIVERSITY.items():
        if domain.endswith(f".{allowed_domain}") or domain == allowed_domain:
            return university
    
    return None


def _is_allowed_domain(domain: str) -> bool:
    """
    Check if email domain is allowed (university domains only).
    Allows:
    - Domains matching university patterns (*.edu, *.edu.es, *.university, *.uni.*)
    - Domains in the whitelist (settings.allowed_email_domains)
    - Domains that match known university patterns in EMAIL_DOMAIN_TO_UNIVERSITY
    
    Rejects:
    - Personal email providers (gmail, outlook, hotmail, yahoo, etc.)
    """
    # Personal email provider blacklist
    personal_email_providers = [
        "gmail.com", "outlook.com", "hotmail.com", "yahoo.com", "yahoo.es",
        "icloud.com", "protonmail.com", "aol.com", "mail.com", "zoho.com",
        "yandex.com", "gmx.com", "live.com", "msn.com", "me.com"
    ]
    
    domain_lower = domain.lower()
    base_domain = _get_base_domain(domain_lower)
    
    # Reject personal email providers
    if base_domain in personal_email_providers or any(domain_lower.endswith(f".{provider}") for provider in personal_email_providers):
        return False
    
    # Check if domain matches university patterns
    university_patterns = [
        r"\.edu$",           # *.edu
        r"\.edu\.es$",        # *.edu.es
        r"\.edu\.[a-z]{2,}$", # *.edu.* (any country code)
        r"\.university$",     # *.university
        r"\.uni\.[a-z]{2,}$", # *.uni.*
        r"univ\.[a-z]{2,}$",  # univ.*
    ]
    
    # Check if domain matches any university pattern
    for pattern in university_patterns:
        if re.search(pattern, domain_lower):
            return True
    
    # Check if domain is in the whitelist (if configured)
    if settings.allowed_email_domains:
        if any(domain_lower == d or domain_lower.endswith(f".{d}") for d in settings.allowed_email_domains):
            return True
    
    # Check if domain is in the known university mapping
    if base_domain in EMAIL_DOMAIN_TO_UNIVERSITY:
        return True
    if domain_lower in EMAIL_DOMAIN_TO_UNIVERSITY:
        return True
    # Check for subdomains (e.g., alumnos.ugr.es -> ugr.es)
    for allowed_domain in EMAIL_DOMAIN_TO_UNIVERSITY.keys():
        if domain_lower.endswith(f".{allowed_domain}") or domain_lower == allowed_domain:
            return True
    
    # If no whitelist is configured and domain doesn't match patterns, reject
    # (This maintains security - only explicit university domains are allowed)
    return False


def _issue_email_code(db: Session, email: str, purpose: str = "verify_email") -> str:
    """
    Crea y persiste un código de verificación de 6 dígitos con caducidad.
    Devuelve el código generado (string).
    """
    code = f"{secrets.randbelow(10**6):06d}"  # 6 dígitos, con ceros a la izquierda
    expires_at = datetime.now(UTC) + timedelta(minutes=settings.email_code_expire_minutes)
    db.add(EmailCode(email=email, code=code, purpose=purpose, expires_at=expires_at))
    db.commit()
    return code


def register(db: Session, data: UserCreate) -> str:
    """
    Crea el usuario (si no existe) y genera un código de verificación.
    DEVUELVE SIEMPRE el string del código para que el router lo envíe por email.
    """
    domain = _extract_domain(data.email)
    if not _is_allowed_domain(domain):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El dominio de correo '{domain}' no está permitido",
        )

    if db.query(User).filter(User.email == data.email).first():
        # Mensaje claro cuando el correo ya existe
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ya existe una cuenta registrada con el correo {data.email}",
        )

    try:
        # Detect university from email domain
        university = _detect_university_from_email(data.email)
        
        user = User(
            email=data.email,
            password_hash=hash_password(data.password),
            university=university
        )
        
        # Auto-verify users if enabled in development mode
        if settings.auto_verify_users:
            user.is_verified = True
            print(f"[UniGo] Auto-verified user {data.email} (development mode)")
        
        if university:
            print(f"[UniGo] Universidad detectada para {data.email}: {university}")
        
        db.add(user)
        db.commit()
        db.refresh(user)

        # Genera y guarda el código, y DEVUÉLVELO
        code = _issue_email_code(db, data.email)
        # Log de ayuda en dev
        print(f"[UniGo] Código de verificación para {data.email}: {code}")
        return code

    except SQLAlchemyError as err:
        db.rollback()
        raise HTTPException(status_code=500, detail="DB error durante el registro") from err


def verify_email(db: Session, email: str, code: str) -> str:
    """
    Verifica el email con el código y devuelve un JWT token para auto-login.
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
        raise HTTPException(status_code=400, detail="No hay código pendiente")

    now = datetime.now(UTC)
    if rec.expires_at < now:
        raise HTTPException(status_code=400, detail="Código de verificación caducado")

    # Normalize code (strip whitespace, ensure 6 digits)
    normalized_code = code.strip()
    normalized_db_code = rec.code.strip()
    
    if normalized_code != normalized_db_code:
        rec.attempts += 1
        db.commit()
        raise HTTPException(status_code=400, detail="Código de verificación inválido")

    rec.consumed = True
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    user.is_verified = True
    db.commit()
    
    # Generate and return JWT token for auto-login
    token = create_access_token(sub=str(user.id))
    return token


def login(db: Session, email: str, password: str) -> str:
    try:
        user = db.query(User).filter(User.email == email).first()
        if not user or not verify_password(password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales inválidas"
            )
        if not user.is_active:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Usuario deshabilitado")
        if not user.is_verified:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Email no verificado")
        
        # Ensure user.id is valid
        if user.id is None:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error interno: ID de usuario inválido")
        
        token = create_access_token(sub=str(user.id))
        return token
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error en login para {email}: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error interno del servidor: {str(e)}"
        )


def verify_user_manually(db: Session, email: str) -> None:
    """
    Manually verify a user by email (useful for development/testing).
    """
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    user.is_verified = True
    db.commit()
