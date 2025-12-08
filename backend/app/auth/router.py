# backend/app/auth/router.py
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Response, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session
import logging
import threading

from app.auth import service
from app.auth.models import User
from app.auth.schemas import Token, UserCreate, UserLogin, UserOut, VerifyEmail, ResendCodeRequest
from app.core.config import settings
from app.core.email import send_verification_email_sync, send_verification_email
from app.db.session import get_db

# Configure logger
log = logging.getLogger(__name__)

# Nota: este router ya incluye el prefijo /api; en main.py se debe incluir SIN prefijo adicional.
router = APIRouter(prefix="/api/auth", tags=["auth"])

# OAuth2PasswordBearer lo usamos para extraer el Bearer token del Authorization header
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


@router.post("/register")
def register_user(
    data: UserCreate,
    bg: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Crea/actualiza usuario y genera un código de verificación.
    Envía el email en segundo plano (async email service).
    
    FLUJO COMPLETO:
    1. Se crea el usuario en la base de datos (o se actualiza si existe y no está verificado)
    2. Se genera un código de verificación de 6 dígitos
    3. Se envía el email automáticamente usando Mailjet (o el backend configurado)
    
    Si el email ya existe pero no está verificado, reenvía el código y devuelve status "pending_verification"
    """
    # FORZAR LOGS INMEDIATAMENTE
    import sys
    from fastapi.responses import JSONResponse
    
    print("=" * 70, flush=True)
    print(f"[Register] ===== INICIANDO REGISTRO PARA {data.email} =====", flush=True)
    print("=" * 70, flush=True)
    sys.stdout.flush()
    sys.stderr.flush()
    
    log.info("=" * 70)
    log.info(f"[Register] ===== INICIANDO REGISTRO PARA {data.email} =====")
    log.info("=" * 70)
    sys.stdout.flush()
    
    try:
        # PASO 1: Generar código de verificación y crear usuario
        print(f"[Register] Paso 1: Llamando a service.register() para {data.email}", flush=True)
        log.info(f"[Register] Paso 1: Llamando a service.register() para {data.email}")
        sys.stdout.flush()
        
        code, registration_status = service.register(db, data)  # Devuelve (código, status)
        
        if registration_status == "pending_verification":
            print(f"[Register] Paso 2: Usuario existente no verificado - reenviando código", flush=True)
            log.info(f"[Register] Paso 2: Usuario existente no verificado - reenviando código")
        else:
            print(f"[Register] Paso 2: Usuario registrado exitosamente", flush=True)
            log.info(f"[Register] Paso 2: Usuario registrado exitosamente")
        
        print(f"[Register] Paso 3: Código generado: {code}", flush=True)
        log.info(f"[Register] Paso 3: Código de verificación generado: {code} para {data.email}")
        sys.stdout.flush()
        
        # PASO 2: Enviar email de verificación INMEDIATAMENTE (ANTES de responder)
        # IMPORTANTE: Esto se ejecuta SÍNCRONO y BLOQUEA hasta que el email se envíe
        print(f"[Register] Paso 4: ENVIANDO EMAIL INMEDIATAMENTE (BLOQUEANTE)", flush=True)
        print(f"[Register] Email={data.email}, Code={code}", flush=True)
        log.info(f"[Register] Paso 4: Enviando email INMEDIATAMENTE (BLOQUEANTE - antes de respuesta HTTP)")
        log.info(f"[Register] Email={data.email}, Code={code}")
        sys.stdout.flush()
        sys.stderr.flush()
        
        email_sent = False
        try:
            print(f"[Register] ⚡ LLAMANDO send_verification_email_sync() - ESPERANDO RESPUESTA...", flush=True)
            log.info(f"[Register] ⚡ EJECUTANDO send_verification_email_sync() AHORA - ESPERANDO RESPUESTA")
            sys.stdout.flush()
            
            # LLAMAR DIRECTAMENTE Y ESPERAR - ESTO BLOQUEA HASTA QUE SE ENVÍE
            send_verification_email_sync(data.email, code)
            email_sent = True
            
            print(f"[Register] ⚡ send_verification_email_sync() COMPLETADO", flush=True)
            print(f"[Register] ✅ Email enviado exitosamente INMEDIATAMENTE", flush=True)
            log.info(f"[Register] ⚡ send_verification_email_sync() COMPLETADO")
            log.info(f"[Register] ✅ Email enviado exitosamente a {data.email} INMEDIATAMENTE")
            sys.stdout.flush()
            sys.stderr.flush()
        except Exception as e:
            print("=" * 70, flush=True)
            print(f"[Register] ❌❌❌ ERROR AL ENVIAR EMAIL ❌❌❌", flush=True)
            print(f"[Register] Error: {str(e)}", flush=True)
            print("=" * 70, flush=True)
            log.error("=" * 70)
            log.error(f"[Register] ❌❌❌ ERROR CRÍTICO al enviar email ❌❌❌")
            log.error(f"[Register] Email={data.email}, Code={code}")
            log.error(f"[Register] Error: {str(e)}")
            log.error("=" * 70)
            sys.stdout.flush()
            sys.stderr.flush()
            import traceback
            traceback.print_exc()
            # NO fallar el registro si el email falla, pero loguear el error
        
        # NO usar BackgroundTasks - ya enviamos directamente y bloqueamos
        # Si el email se envió correctamente, no necesitamos BackgroundTasks
        if not email_sent:
            print(f"[Register] Paso 5: Email NO enviado, añadiendo a BackgroundTasks como último intento", flush=True)
            log.warning(f"[Register] Paso 5: Email NO enviado, añadiendo a BackgroundTasks como último intento")
            bg.add_task(send_verification_email_sync, email=data.email, code=code)
        else:
            print(f"[Register] Paso 5: Email ya enviado, NO usando BackgroundTasks", flush=True)
            log.info(f"[Register] Paso 5: Email ya enviado, NO usando BackgroundTasks")
        sys.stdout.flush()
        
        # Si es pending_verification, devolver JSON con status
        if registration_status == "pending_verification":
            print(f"[Register] Paso 6: Enviando respuesta JSON con status pending_verification", flush=True)
            log.info(f"[Register] Paso 6: Registro completado. Enviando respuesta JSON con status pending_verification")
            print("=" * 70, flush=True)
            log.info("=" * 70)
            log.info(f"[Register] ===== REGISTRO COMPLETADO PARA {data.email} (PENDING VERIFICATION) =====")
            log.info("=" * 70)
            sys.stdout.flush()
            
            return JSONResponse(
                status_code=200,
                content={"status": "pending_verification"}
            )
        else:
            print(f"[Register] Paso 6: Enviando respuesta HTTP 204", flush=True)
            log.info(f"[Register] Paso 6: Registro completado. Enviando respuesta HTTP 204")
            print("=" * 70, flush=True)
            log.info("=" * 70)
            log.info(f"[Register] ===== REGISTRO COMPLETADO PARA {data.email} =====")
            log.info("=" * 70)
            sys.stdout.flush()
            
            return Response(status_code=204)
        
    except HTTPException:
        # Re-raise HTTP exceptions (validation errors, etc.)
        raise
    except Exception as e:
        print(f"[Register] ❌ ERROR CRÍTICO: {e}", flush=True)
        log.error(
            f"[Register] ❌ ERROR CRÍTICO durante el registro de {data.email}: {e}",
            exc_info=True
        )
        sys.stdout.flush()
        sys.stderr.flush()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error interno durante el registro: {str(e)}"
        )


@router.post("/resend-code")
def resend_verification_code(
    data: ResendCodeRequest,
    bg: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Reenvía el código de verificación a un usuario que aún no ha verificado su email.
    Solo funciona si el usuario existe y no está verificado.
    Solo requiere email, NO requiere code.
    """
    user = db.query(User).filter(User.email == data.email).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se encontró una cuenta con este correo electrónico",
        )
    
    if user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Esta cuenta ya está verificada",
        )
    
    # Generar nuevo código usando la función del servicio
    code = service._issue_email_code(db, data.email)
    
    # Enviar email
    try:
        send_verification_email_sync(data.email, code)
        log.info(f"[Resend Code] Email enviado exitosamente a {data.email}")
    except Exception as e:
        log.error(f"[Resend Code] Error al enviar email: {e}", exc_info=True)
        # No fallar si el email falla, pero intentar en background
        bg.add_task(send_verification_email_sync, email=data.email, code=code)
    
    return {"message": "Código de verificación reenviado"}


@router.post("/verify", response_model=Token)
def verify_user(payload: VerifyEmail, db: Session = Depends(get_db)) -> Token:
    """
    Verifica el email con el código recibido y devuelve un JWT token para auto-login.
    """
    token = service.verify_email(db, payload.email, payload.code)
    return {"access_token": token, "token_type": "bearer"}


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


@router.post("/verify-manual", status_code=204)
def verify_user_manually_endpoint(
    payload: dict,
    db: Session = Depends(get_db),
) -> Response:
    """
    Manually verify a user by email (development/testing only).
    """
    email = payload.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")
    
    service.verify_user_manually(db, email)
    return Response(status_code=204)
