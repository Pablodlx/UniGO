from fastapi_mail import ConnectionConfig, FastMail, MessageSchema
from pydantic import EmailStr

from app.core.config import settings

conf = ConnectionConfig(
    MAIL_USERNAME=settings.mail_username or "",
    MAIL_PASSWORD=settings.mail_password or "",
    MAIL_FROM=str(settings.mail_from),
    MAIL_SERVER=settings.mail_server,  # 127.0.0.1 para MailHog
    MAIL_PORT=settings.mail_port,  # 1025 para MailHog
    MAIL_STARTTLS=settings.mail_starttls,  # False con MailHog
    MAIL_SSL_TLS=settings.mail_ssl_tls,  # False con MailHog
    USE_CREDENTIALS=bool(settings.mail_username or settings.mail_password),
    VALIDATE_CERTS=False,  # cómodo en dev
)


async def send_verification_email(email: EmailStr, code: str) -> None:
    print(f"\n📨 [UniGo] Preparando email a {email} con código {code}\n")
    try:
        message = MessageSchema(
            subject="Código de verificación UniGo",
            recipients=[email],
            body=f"Tu código de verificación es: {code}",
            subtype="plain",
        )
        fm = FastMail(conf)
        await fm.send_message(message)
        print("✉️  Email enviado (MailHog: http://127.0.0.1:8025).")
    except Exception as e:
        print(f"⚠️  Fallo enviando correo: {e}")
