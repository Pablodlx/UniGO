"""
Email service for UniGO with support for real SMTP and development backends.
Uses EMAIL_BACKEND environment variable to determine the backend:
- EMAIL_BACKEND="smtp" → Real SMTP with TLS/SSL
- EMAIL_BACKEND="sendgrid" → SendGrid API (easier, only needs API key)
- EMAIL_BACKEND="mailjet" → Mailjet API
- EMAIL_BACKEND!="smtp" → Development mode (MailHog or console)
"""
import asyncio
import logging
import os
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

import aiosmtplib
import httpx
import nest_asyncio

from app.core.config import settings

# Apply nest_asyncio to allow nested event loops
nest_asyncio.apply()

log = logging.getLogger(__name__)


class EmailService:
    """Email service supporting real SMTP and development backends."""

    def __init__(self):
        """Initialize email service from environment variables."""
        # FORZAR CARGA DE VARIABLES DE ENTORNO
        # Asegurarse de que se cargan desde .env si existe
        try:
            from dotenv import load_dotenv
            import os as os_module
            backend_dir = os_module.path.dirname(os_module.path.dirname(os_module.path.dirname(os_module.path.abspath(__file__))))
            env_path = os_module.path.join(backend_dir, ".env")
            if os_module.path.exists(env_path):
                load_dotenv(env_path, override=True)
        except Exception as e:
            log.warning(f"Could not load .env file: {e}")
        
        self.email_backend = os.getenv("EMAIL_BACKEND", "").lower().strip()
        self.provider = os.getenv("EMAIL_PROVIDER", "Unknown")
        
        log.info(f"[EmailService] Initializing with EMAIL_BACKEND='{self.email_backend}'")
        
        # Determine backend type
        self.use_real_smtp = self.email_backend == "smtp"
        self.use_sendgrid = self.email_backend == "sendgrid"
        self.use_mailjet = self.email_backend == "mailjet"
        
        if self.use_mailjet:
            # Mailjet configuration
            self.mailjet_api_key = os.getenv("MAILJET_API_KEY", "").strip()
            self.mailjet_secret_key = os.getenv("MAILJET_SECRET_KEY", "").strip()
            self.email_from_name = os.getenv("EMAIL_FROM_NAME", "UniGO")
            self.email_from = os.getenv("EMAIL_FROM", "").strip()
            
            log.info(f"[EmailService] Mailjet config check:")
            log.info(f"  - API Key present: {bool(self.mailjet_api_key)}")
            log.info(f"  - Secret Key present: {bool(self.mailjet_secret_key)}")
            log.info(f"  - From: {self.email_from}")
            
            if not self.mailjet_api_key or not self.mailjet_secret_key:
                log.error("=" * 70)
                log.error("EMAIL_BACKEND=mailjet but MAILJET_API_KEY or MAILJET_SECRET_KEY not configured")
                log.error("Falling back to development mode (MailHog)")
                log.error("=" * 70)
                self.use_mailjet = False
            else:
                log.info("=" * 70)
                log.info(f"✅ Email service initialized: Mailjet mode")
                log.info(f"   From: {self.email_from} ({self.email_from_name})")
                log.info("=" * 70)
        elif self.use_sendgrid:
            # SendGrid configuration (easier - only needs API key)
            self.sendgrid_api_key = os.getenv("SENDGRID_API_KEY", "")
            self.email_from_name = os.getenv("EMAIL_FROM_NAME", "UniGO")
            self.email_from = os.getenv("EMAIL_FROM", "")
            
            if not self.sendgrid_api_key:
                log.error("EMAIL_BACKEND=sendgrid but SENDGRID_API_KEY is not configured")
                log.error("Falling back to development mode (MailHog)")
                self.use_sendgrid = False
            else:
                log.info(
                    f"Email service initialized: SendGrid mode - "
                    f"From: {self.email_from}"
                )
        elif self.use_real_smtp:
            # Real SMTP configuration
            self.smtp_host = os.getenv("SMTP_HOST", "")
            self.smtp_port = int(os.getenv("SMTP_PORT", "587"))
            self.smtp_username = os.getenv("SMTP_USERNAME", "")
            self.smtp_password = os.getenv("SMTP_PASSWORD", "")
            self.email_from_name = os.getenv("EMAIL_FROM_NAME", "UniGO")
            self.email_from = os.getenv("EMAIL_FROM", "")
            
            # TLS/SSL configuration
            # Default to TLS for port 587, SSL for port 465
            if self.smtp_port == 465:
                self.use_ssl = True
                self.use_tls = False
            elif self.smtp_port == 587:
                self.use_ssl = False
                self.use_tls = True
            else:
                # Check explicit configuration
                tls_env = os.getenv("SMTP_USE_TLS", "").lower()
                ssl_env = os.getenv("SMTP_USE_SSL", "").lower()
                self.use_tls = tls_env == "true" if tls_env else False
                self.use_ssl = ssl_env == "true" if ssl_env else False
            
            # Validate SMTP configuration
            if not self.smtp_host:
                log.error("EMAIL_BACKEND=smtp but SMTP_HOST is not configured")
                log.error("Falling back to development mode (MailHog)")
                self.use_real_smtp = False
                return
            
            # Check if password is placeholder or missing
            password_placeholder = (
                not self.smtp_password or 
                self.smtp_password == "TU_CONTRASEÑA_DE_APLICACION_AQUI" or
                len(self.smtp_password) < 10
            )
            
            if not self.smtp_username or password_placeholder:
                log.warning("=" * 70)
                log.warning("⚠️  SMTP credentials not configured or using placeholder")
                log.warning("   Email sending will fail. To fix:")
                log.warning("   1. Run: cd backend && python3 setup_email_auto.py")
                log.warning("   2. Or manually set SMTP_PASSWORD in .env")
                log.warning("=" * 70)
                # Don't fail completely, but log the issue clearly
            
            log.info(
                f"Email service initialized: SMTP real mode - "
                f"Host: {self.smtp_host}, Port: {self.smtp_port}, "
                f"TLS: {self.use_tls}, SSL: {self.use_ssl}"
            )
        else:
            # Development mode (MailHog or console)
            self.smtp_host = os.getenv("SMTP_HOST", "127.0.0.1")
            self.smtp_port = int(os.getenv("SMTP_PORT", "1025"))
            self.smtp_username = os.getenv("SMTP_USERNAME", "")
            self.smtp_password = os.getenv("SMTP_PASSWORD", "")
            self.email_from_name = os.getenv("EMAIL_FROM_NAME", "UniGO")
            self.email_from = os.getenv("EMAIL_FROM", settings.mail_from)
            self.use_tls = False
            self.use_ssl = False
            
            log.info(
                f"Email service initialized: Development mode - "
                f"Host: {self.smtp_host}, Port: {self.smtp_port} (MailHog)"
            )

    async def _send_email(
        self,
        to_email: str,
        subject: str,
        html_body: str,
        text_body: Optional[str] = None,
    ) -> bool:
        """
        Send an email using the configured backend.

        Args:
            to_email: Recipient email address
            subject: Email subject
            html_body: HTML content of the email
            text_body: Plain text fallback (optional)

        Returns:
            True if email was sent successfully, False otherwise
        """
        if self.use_mailjet:
            # Mailjet mode
            return await self._send_email_mailjet(to_email, subject, html_body, text_body)
        elif self.use_sendgrid:
            # SendGrid mode
            return await self._send_email_sendgrid(to_email, subject, html_body, text_body)
        elif not self.use_real_smtp:
            # Development mode: use MailHog or console
            return await self._send_email_dev(to_email, subject, html_body, text_body)
        
        # Real SMTP mode
        if not self.smtp_host:
            log.error("Cannot send email: SMTP_HOST not configured")
            return False

        if not text_body:
            # Simple HTML to text conversion
            import re
            text_body = re.sub(r"<[^>]+>", "", html_body)
            text_body = text_body.replace("&nbsp;", " ").strip()

        try:
            log.info(f"[SMTP] Sending email to {to_email} (subject: {subject})")

            # Create message
            message = MIMEMultipart("alternative")
            message["Subject"] = subject
            message["From"] = f"{self.email_from_name} <{self.email_from}>"
            message["To"] = to_email

            # Add text and HTML parts
            text_part = MIMEText(text_body, "plain", "utf-8")
            html_part = MIMEText(html_body, "html", "utf-8")
            message.attach(text_part)
            message.attach(html_part)

            # Send email
            if self.use_ssl:
                # SSL mode (port 465)
                context = ssl.create_default_context()
                await aiosmtplib.send(
                    message,
                    hostname=self.smtp_host,
                    port=self.smtp_port,
                    username=self.smtp_username,
                    password=self.smtp_password,
                    use_tls=False,
                    use_ssl=True,
                    tls_context=context,
                )
            else:
                # TLS mode (port 587) or no encryption
                await aiosmtplib.send(
                    message,
                    hostname=self.smtp_host,
                    port=self.smtp_port,
                    username=self.smtp_username if self.smtp_username else None,
                    password=self.smtp_password if self.smtp_password else None,
                    use_tls=self.use_tls,
                    use_ssl=False,
                )

            log.info(f"[SMTP] Email sent successfully to {to_email}")
            return True

        except Exception as e:
            log.error(
                f"[SMTP] Failed to send email to {to_email}: {str(e)}",
                exc_info=True,
            )
            return False

    async def _send_email_dev(
        self,
        to_email: str,
        subject: str,
        html_body: str,
        text_body: Optional[str] = None,
    ) -> bool:
        """
        Send email in development mode (MailHog or console).
        """
        if not text_body:
            import re
            text_body = re.sub(r"<[^>]+>", "", html_body)
            text_body = text_body.replace("&nbsp;", " ").strip()

        try:
            log.info(
                f"[MailHog] Sending email to {to_email} (subject: {subject})"
            )

            # Create message
            message = MIMEMultipart("alternative")
            message["Subject"] = subject
            message["From"] = f"{self.email_from_name} <{self.email_from}>"
            message["To"] = to_email

            text_part = MIMEText(text_body, "plain", "utf-8")
            html_part = MIMEText(html_body, "html", "utf-8")
            message.attach(text_part)
            message.attach(html_part)

            # Connect to MailHog (no TLS, no auth)
            await aiosmtplib.send(
                message,
                hostname=self.smtp_host,
                port=self.smtp_port,
                use_tls=False,
                use_ssl=False,
            )

            log.info(f"[MailHog] Email sent successfully to {to_email}")
            return True

        except Exception as e:
            log.error(
                f"[MailHog] Failed to send email to {to_email}: {str(e)}",
                exc_info=True,
            )
            # In dev mode, also print to console
            print(f"\n{'='*70}")
            print(f"📧 EMAIL (DEV MODE - MailHog no disponible)")
            print(f"{'='*70}")
            print(f"To: {to_email}")
            print(f"Subject: {subject}")
            print(f"Body: {text_body[:200]}...")
            print(f"{'='*70}\n")
            return False

    async def _send_email_sendgrid(
        self,
        to_email: str,
        subject: str,
        html_body: str,
        text_body: Optional[str] = None,
    ) -> bool:
        """
        Send email using SendGrid API.
        """
        if not self.sendgrid_api_key:
            log.error("SendGrid API key not configured")
            return False

        if not text_body:
            import re
            text_body = re.sub(r"<[^>]+>", "", html_body)
            text_body = text_body.replace("&nbsp;", " ").strip()

        try:
            log.info(
                f"[SendGrid] Sending email to {to_email} (subject: {subject})"
            )

            url = "https://api.sendgrid.com/v3/mail/send"
            headers = {
                "Authorization": f"Bearer {self.sendgrid_api_key}",
                "Content-Type": "application/json",
            }

            payload = {
                "personalizations": [{"to": [{"email": to_email}]}],
                "from": {"email": self.email_from, "name": self.email_from_name},
                "subject": subject,
                "content": [
                    {"type": "text/plain", "value": text_body},
                    {"type": "text/html", "value": html_body},
                ],
            }

            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(url, json=payload, headers=headers)
                response.raise_for_status()

            log.info(f"[SendGrid] Email sent successfully to {to_email}")
            return True

        except httpx.HTTPStatusError as e:
            error_body = ""
            try:
                error_body = e.response.text
            except:
                pass
            log.error(
                f"[SendGrid] Failed to send email to {to_email}: "
                f"HTTP {e.response.status_code} - {error_body}",
                exc_info=True,
            )
            return False
        except Exception as e:
            log.error(
                f"[SendGrid] Failed to send email to {to_email}: {str(e)}",
                exc_info=True,
            )
            return False

    async def _send_email_mailjet(
        self,
        to_email: str,
        subject: str,
        html_body: str,
        text_body: Optional[str] = None,
    ) -> bool:
        """
        Send email using Mailjet API.
        """
        if not self.mailjet_api_key or not self.mailjet_secret_key:
            log.error("Mailjet API key or secret key not configured")
            return False

        if not text_body:
            import re
            text_body = re.sub(r"<[^>]+>", "", html_body)
            text_body = text_body.replace("&nbsp;", " ").strip()

        try:
            log.info(
                f"[Mailjet] Sending email to {to_email} (subject: {subject})"
            )
            log.debug(f"[Mailjet] From: {self.email_from} ({self.email_from_name})")

            # Mailjet API v3.1
            url = "https://api.mailjet.com/v3.1/send"
            
            # Mailjet uses HTTP Basic Auth with API Key and Secret Key
            import base64
            auth_string = f"{self.mailjet_api_key}:{self.mailjet_secret_key}"
            auth_bytes = auth_string.encode('ascii')
            auth_b64 = base64.b64encode(auth_bytes).decode('ascii')
            
            headers = {
                "Authorization": f"Basic {auth_b64}",
                "Content-Type": "application/json",
            }
            
            payload = {
                "Messages": [
                    {
                        "From": {
                            "Email": self.email_from,
                            "Name": self.email_from_name,
                        },
                        "To": [
                            {
                                "Email": to_email,
                            }
                        ],
                        "Subject": subject,
                        "TextPart": text_body,
                        "HTMLPart": html_body,
                    }
                ]
            }

            log.debug(f"[Mailjet] Making POST request to {url}")
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(url, json=payload, headers=headers)
                log.debug(f"[Mailjet] Response status: {response.status_code}")
                response.raise_for_status()

            log.info(f"[Mailjet] ✅ Email sent successfully to {to_email} (Status: {response.status_code})")
            return True

        except httpx.HTTPStatusError as e:
            error_body = ""
            try:
                error_body = e.response.text
            except:
                pass
            log.error(
                f"[Mailjet] Failed to send email to {to_email}: "
                f"HTTP {e.response.status_code} - {error_body}",
                exc_info=True,
            )
            return False
        except Exception as e:
            log.error(
                f"[Mailjet] Failed to send email to {to_email}: {str(e)}",
                exc_info=True,
            )
            return False

    def _get_verification_email_html(self, code: str) -> str:
        """Generate HTML template for verification email."""
        return f"""
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Código de verificación - UniGO</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }}
        .container {{
            background-color: #ffffff;
            border-radius: 8px;
            padding: 40px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }}
        .header {{
            text-align: center;
            margin-bottom: 30px;
        }}
        .logo {{
            font-size: 32px;
            font-weight: bold;
            color: #6366f1;
            margin-bottom: 10px;
        }}
        .code-container {{
            background: linear-gradient(135deg, #e0e0e0 0%, #cccccc 100%);
            border-radius: 8px;
            padding: 30px;
            text-align: center;
            margin: 30px 0;
        }}
        .code {{
            font-size: 48px;
            font-weight: bold;
            color: #000000;
            letter-spacing: 8px;
            font-family: 'Courier New', monospace;
        }}
        .message {{
            color: #666;
            margin: 20px 0;
            text-align: center;
        }}
        .footer {{
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            text-align: center;
            color: #999;
            font-size: 12px;
        }}
        .warning {{
            background-color: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🎓 UniGO</div>
            <h1 style="color: #333; margin: 0;">Código de verificación</h1>
        </div>
        
        <p class="message">
            Hola,<br><br>
            Has solicitado un código de verificación para tu cuenta de UniGO.
        </p>
        
        <div class="code-container">
            <div class="code">{code}</div>
        </div>
        
        <p class="message">
            Introduce este código en la aplicación para completar la verificación de tu cuenta.
        </p>
        
        <div class="warning">
            <strong>⚠️ Importante:</strong> Este código caduca en {settings.email_code_expire_minutes} minutos.
            No compartas este código con nadie.
        </div>
        
        <div class="footer">
            <p>Si no has solicitado este código, puedes ignorar este correo.</p>
            <p>© 2025 UniGO - Carpooling universitario</p>
        </div>
    </div>
</body>
</html>
"""

    async def send_verification_email(self, email: str, code: str) -> bool:
        """
        Send verification code email.

        Args:
            email: Recipient email address
            code: 6-digit verification code

        Returns:
            True if email was sent successfully, False otherwise
        """
        log.info(f"[EmailService] send_verification_email called for {email} with code: {code}")
        
        if not isinstance(code, str) or not code.strip():
            log.error("[EmailService] Verification code must be a non-empty string")
            return False

        log.info(f"[EmailService] Generating email content for {email}")
        subject = "[UniGO] Código de verificación"
        html_body = self._get_verification_email_html(code)
        text_body = f"""UniGO - Código de verificación

Tu código de verificación es: {code}

Este código caduca en {settings.email_code_expire_minutes} minutos.

Si no has solicitado este código, puedes ignorar este correo.

© 2025 UniGO - Carpooling universitario
"""

        log.info(f"[EmailService] Calling _send_email for {email}")
        result = await self._send_email(email, subject, html_body, text_body)
        
        if result:
            log.info(f"[EmailService] ✅ Email sent successfully to {email}")
        else:
            log.error(f"[EmailService] ❌ Failed to send email to {email}")
        
        return result

    def _get_password_reset_email_html(self, token: str, reset_url: Optional[str] = None) -> str:
        """Generate HTML template for password reset email."""
        if not reset_url:
            frontend_url = os.getenv("FRONTEND_URL", "http://127.0.0.1:3001")
            reset_url = f"{frontend_url}/reset-password?token={token}"
        
        return f"""
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Restablecer contraseña - UniGO</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }}
        .container {{
            background-color: #ffffff;
            border-radius: 8px;
            padding: 40px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }}
        .header {{
            text-align: center;
            margin-bottom: 30px;
        }}
        .logo {{
            font-size: 32px;
            font-weight: bold;
            color: #6366f1;
            margin-bottom: 10px;
        }}
        .button {{
            display: inline-block;
            padding: 12px 24px;
            background-color: #6366f1;
            color: #ffffff;
            text-decoration: none;
            border-radius: 6px;
            margin: 20px 0;
        }}
        .footer {{
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            text-align: center;
            color: #999;
            font-size: 12px;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🎓 UniGO</div>
            <h1 style="color: #333; margin: 0;">Restablecer contraseña</h1>
        </div>
        
        <p>Hola,</p>
        
        <p>Has solicitado restablecer la contraseña de tu cuenta de UniGO.</p>
        
        <p style="text-align: center;">
            <a href="{reset_url}" class="button">Restablecer contraseña</a>
        </p>
        
        <p>Este enlace caduca en 1 hora.</p>
        
        <p>Si no has solicitado restablecer tu contraseña, puedes ignorar este correo.</p>
        
        <div class="footer">
            <p>© 2025 UniGO - Carpooling universitario</p>
        </div>
    </div>
</body>
</html>
"""

    async def send_password_reset_email(
        self, email: str, token: str, reset_url: Optional[str] = None
    ) -> bool:
        """
        Send password reset email with token.

        Args:
            email: Recipient email address
            token: Password reset token
            reset_url: Optional custom reset URL (defaults to frontend URL + token)

        Returns:
            True if email was sent successfully, False otherwise
        """
        if not isinstance(token, str) or not token.strip():
            log.error("Password reset token must be a non-empty string")
            return False

        subject = "[UniGO] Restablecer contraseña"
        html_body = self._get_password_reset_email_html(token, reset_url)
        text_body = f"""UniGO - Restablecer contraseña

Has solicitado restablecer la contraseña de tu cuenta de UniGO.

Para restablecer tu contraseña, visita el siguiente enlace:
{reset_url or f"{os.getenv('FRONTEND_URL', 'http://127.0.0.1:3001')}/reset-password?token={token}"}

Este enlace caduca en 1 hora.

Si no has solicitado restablecer tu contraseña, puedes ignorar este correo.

© 2025 UniGO - Carpooling universitario
"""

        return await self._send_email(email, subject, html_body, text_body)


# Global instance
_email_service: Optional[EmailService] = None


def get_email_service() -> EmailService:
    """Get or create the global email service instance."""
    global _email_service
    if _email_service is None:
        log.info("[EmailService] Creating new EmailService instance")
        _email_service = EmailService()
    else:
        log.debug("[EmailService] Using existing EmailService instance")
    return _email_service


# Convenience functions
async def send_verification_email(email: str, code: str) -> bool:
    """
    Send verification email (async wrapper).
    Returns True if sent successfully, False otherwise.
    """
    log.info(f"[Email] send_verification_email async called for {email} with code: {code}")
    
    try:
        service = get_email_service()
        log.info(f"[Email] Calling service.send_verification_email for {email}")
        success = await service.send_verification_email(email, code)
        
        if success:
            log.info(f"[Email] ✅ Service returned success for {email}")
        else:
            log.warning(f"[Email] ⚠️ Service returned False for {email}")
        
        return success
    except Exception as e:
        log.error(
            f"[Email] ❌ Exception in send_verification_email for {email}: {str(e)}",
            exc_info=True
        )
        return False


def send_verification_email_sync(email: str, code: str) -> None:
    """
    Synchronous wrapper for sending verification email.
    SOLUCIÓN DEFINITIVA: Envío directo síncrono sin asyncio.
    """
    import threading
    import base64
    thread_name = threading.current_thread().name
    
    # FORZAR LOGS INMEDIATOS
    print("=" * 70, flush=True)
    print(f"[Email] ===== INICIANDO ENVÍO DE EMAIL DE VERIFICACIÓN =====", flush=True)
    print(f"[Email] Thread: '{thread_name}'", flush=True)
    print(f"[Email] Email: {email}", flush=True)
    print(f"[Email] Código: {code}", flush=True)
    print("=" * 70, flush=True)
    
    log.info("=" * 70)
    log.info(f"[Email] ===== INICIANDO ENVÍO DE EMAIL DE VERIFICACIÓN =====")
    log.info(f"[Email] Thread: '{thread_name}'")
    log.info(f"[Email] Email: {email}")
    log.info(f"[Email] Código: {code}")
    log.info("=" * 70)
    
    try:
        # Cargar configuración directamente
        from dotenv import load_dotenv
        backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        env_path = os.path.join(backend_dir, ".env")
        if os.path.exists(env_path):
            load_dotenv(env_path, override=True)
        
        email_backend = os.getenv("EMAIL_BACKEND", "").lower().strip()
        mailjet_api_key = os.getenv("MAILJET_API_KEY", "").strip()
        mailjet_secret_key = os.getenv("MAILJET_SECRET_KEY", "").strip()
        email_from = os.getenv("EMAIL_FROM", "").strip()
        email_from_name = os.getenv("EMAIL_FROM_NAME", "UniGO")
        
        print(f"[Email] Configuración:", flush=True)
        print(f"  - EMAIL_BACKEND: {email_backend}", flush=True)
        print(f"  - MAILJET_API_KEY: {'✅' if mailjet_api_key else '❌'}", flush=True)
        print(f"  - MAILJET_SECRET_KEY: {'✅' if mailjet_secret_key else '❌'}", flush=True)
        print(f"  - EMAIL_FROM: {email_from}", flush=True)
        
        log.info(f"[Email] Configuración: backend={email_backend}, from={email_from}")
        
        # Si es Mailjet, enviar directamente SIN asyncio
        if email_backend == "mailjet" and mailjet_api_key and mailjet_secret_key:
            print(f"[Email] Enviando con Mailjet API (síncrono)...", flush=True)
            log.info(f"[Email] Enviando con Mailjet API (síncrono)")
            
            url = "https://api.mailjet.com/v3.1/send"
            auth_string = f"{mailjet_api_key}:{mailjet_secret_key}"
            auth_b64 = base64.b64encode(auth_string.encode('ascii')).decode('ascii')
            
            headers = {
                "Authorization": f"Basic {auth_b64}",
                "Content-Type": "application/json",
            }
            
            # Generar HTML del email
            from app.core.config import settings
            html_body = f"""
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Código de verificación - UniGO</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }}
        .container {{
            background-color: #ffffff;
            border-radius: 8px;
            padding: 40px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }}
        .header {{
            text-align: center;
            margin-bottom: 30px;
        }}
        .logo {{
            font-size: 32px;
            font-weight: bold;
            color: #6366f1;
            margin-bottom: 10px;
        }}
        .code-container {{
            background: linear-gradient(135deg, #e0e0e0 0%, #cccccc 100%);
            border-radius: 8px;
            padding: 30px;
            text-align: center;
            margin: 30px 0;
        }}
        .code {{
            font-size: 48px;
            font-weight: bold;
            color: #000000;
            letter-spacing: 8px;
            font-family: 'Courier New', monospace;
        }}
        .message {{
            color: #666;
            margin: 20px 0;
            text-align: center;
        }}
        .footer {{
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            text-align: center;
            color: #999;
            font-size: 12px;
        }}
        .warning {{
            background-color: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🎓 UniGO</div>
            <h1 style="color: #333; margin: 0;">Código de verificación</h1>
        </div>
        
        <p class="message">
            Hola,<br><br>
            Has solicitado un código de verificación para tu cuenta de UniGO.
        </p>
        
        <div class="code-container">
            <div class="code">{code}</div>
        </div>
        
        <p class="message">
            Introduce este código en la aplicación para completar la verificación de tu cuenta.
        </p>
        
        <div class="warning">
            <strong>⚠️ Importante:</strong> Este código caduca en {settings.email_code_expire_minutes} minutos.
            No compartas este código con nadie.
        </div>
        
        <div class="footer">
            <p>Si no has solicitado este código, puedes ignorar este correo.</p>
            <p>© 2025 UniGO - Carpooling universitario</p>
        </div>
    </div>
</body>
</html>
"""
            
            text_body = f"""UniGO - Código de verificación

Tu código de verificación es: {code}

Este código caduca en {settings.email_code_expire_minutes} minutos.

Si no has solicitado este código, puedes ignorar este correo.

© 2025 UniGO - Carpooling universitario
"""
            
            payload = {
                "Messages": [
                    {
                        "From": {
                            "Email": email_from,
                            "Name": email_from_name,
                        },
                        "To": [
                            {
                                "Email": email,
                            }
                        ],
                        "Subject": "[UniGO] Código de verificación",
                        "TextPart": text_body,
                        "HTMLPart": html_body,
                    }
                ]
            }
            
            # Enviar con httpx síncrono - TIMEOUT MÍNIMO para respuesta rápida
            import httpx
            # Timeout corto: 5 segundos para conexión, 10 para lectura total
            # Esto fuerza a Mailjet a responder rápido
            with httpx.Client(timeout=httpx.Timeout(5.0, read=10.0)) as client:
                print(f"[Email] Enviando a Mailjet API...", flush=True)
                log.info(f"[Email] Enviando a Mailjet API...")
                response = client.post(url, json=payload, headers=headers)
                print(f"[Email] Respuesta recibida: Status {response.status_code}", flush=True)
                log.info(f"[Email] Respuesta recibida: Status {response.status_code}")
                response.raise_for_status()
                
                # Verificar que Mailjet aceptó el email
                if response.status_code == 200:
                    try:
                        result = response.json()
                        if result.get("Messages"):
                            msg = result["Messages"][0]
                            if msg.get("Status") == "success":
                                print(f"[Email] ✅ Mailjet aceptó el email inmediatamente", flush=True)
                                log.info(f"[Email] ✅ Mailjet aceptó el email inmediatamente")
                            else:
                                print(f"[Email] ⚠️ Mailjet respondió pero Status: {msg.get('Status')}", flush=True)
                                log.warning(f"[Email] ⚠️ Mailjet respondió pero Status: {msg.get('Status')}")
                    except:
                        pass
            
            print("=" * 70, flush=True)
            print(f"[Email] ✅ EMAIL ENVIADO EXITOSAMENTE", flush=True)
            print(f"[Email] Email: {email}", flush=True)
            print(f"[Email] Código: {code}", flush=True)
            print(f"[Email] Status: {response.status_code}", flush=True)
            print("=" * 70, flush=True)
            
            log.info("=" * 70)
            log.info(f"[Email] ✅ EMAIL ENVIADO EXITOSAMENTE")
            log.info(f"[Email] Email: {email}")
            log.info(f"[Email] Código: {code}")
            log.info(f"[Email] Status: {response.status_code}")
            log.info("=" * 70)
            
        else:
            # Fallback: usar el servicio async
            print(f"[Email] Usando servicio async como fallback...", flush=True)
            log.info(f"[Email] Usando servicio async como fallback")
            result = asyncio.run(send_verification_email(email, code))
            if not result:
                raise Exception("El servicio async retornó False")
            
    except Exception as e:
        print("=" * 70, flush=True)
        print(f"[Email] ❌ EXCEPCIÓN AL ENVIAR EMAIL", flush=True)
        print(f"[Email] Email: {email}", flush=True)
        print(f"[Email] Código: {code}", flush=True)
        print(f"[Email] Error: {str(e)}", flush=True)
        print("=" * 70, flush=True)
        log.error("=" * 70)
        log.error(f"[Email] ❌ EXCEPCIÓN AL ENVIAR EMAIL")
        log.error(f"[Email] Email: {email}")
        log.error(f"[Email] Código: {code}")
        log.error(f"[Email] Error: {str(e)}")
        log.error("=" * 70)
        log.error(f"[Email] Traceback completo:", exc_info=True)
        import traceback
        traceback.print_exc()
