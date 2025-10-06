# backend/app/core/mailer.py
import logging
import os
import smtplib
from email.message import EmailMessage

log = logging.getLogger("mailer")

MAIL_HOST = os.getenv("MAIL_HOST", "127.0.0.1")
MAIL_PORT = int(os.getenv("MAIL_PORT", "1025"))
MAIL_FROM = os.getenv("MAIL_FROM", "no-reply@unigo.local")


def send_verification_email(*, to_email: str, code: str) -> None:
    """
    Envía el código de verificación.
    Requiere 'code' no vacío; NO tiene default para evitar code=None por error.
    """
    if not isinstance(code, str) or not code.strip():
        raise ValueError("Verification code must be a non-empty string")

    subject = "[UniGo] Código de verificación"
    body = f"Tu código de verificación es: {code}\n\nCaduca en 10 minutos."

    msg = EmailMessage()
    msg["From"] = MAIL_FROM
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(body)

    log.info("[UniGo] Enviando código %s a %s", code, to_email)

    with smtplib.SMTP(MAIL_HOST, MAIL_PORT) as smtp:
        smtp.send_message(msg)
