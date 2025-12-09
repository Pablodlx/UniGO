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
            frontend_url = os.getenv("FRONTEND_URL", "http://127.0.0.1:5173")
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

    def _get_passenger_cancellation_email_html(
        self,
        driver_name: str,
        passenger_name: str,
        departure_city: str,
        destination_city: str,
        departure_date: str,
        departure_time: str,
    ) -> str:
        """Generate HTML template for passenger cancellation email."""
        return f"""
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reserva cancelada - UniGO</title>
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
            color: #ef4444;
            margin-bottom: 10px;
        }}
        .warning-badge {{
            background-color: #fef3c7;
            color: #92400e;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: bold;
            display: inline-block;
            margin-bottom: 20px;
        }}
        .trip-details {{
            background-color: #f9fafb;
            border-radius: 8px;
            padding: 24px;
            margin: 24px 0;
        }}
        .detail-row {{
            display: flex;
            justify-content: space-between;
            padding: 12px 0;
            border-bottom: 1px solid #e5e7eb;
        }}
        .detail-row:last-child {{
            border-bottom: none;
        }}
        .detail-label {{
            font-weight: 600;
            color: #6b7280;
        }}
        .detail-value {{
            color: #111827;
            text-align: right;
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
            <div class="warning-badge">⚠️ Reserva Cancelada</div>
            <h1 style="color: #333; margin: 20px 0 10px 0;">Un pasajero ha cancelado su reserva</h1>
        </div>
        
        <p>Hola <strong>{driver_name}</strong>,</p>
        
        <p>Te informamos que <strong>{passenger_name}</strong> ha cancelado su reserva para el siguiente viaje:</p>
        
        <div class="trip-details">
            <div class="detail-row">
                <span class="detail-label">📍 Origen:</span>
                <span class="detail-value"><strong>{departure_city}</strong></span>
            </div>
            <div class="detail-row">
                <span class="detail-label">🎯 Destino:</span>
                <span class="detail-value"><strong>{destination_city}</strong></span>
            </div>
            <div class="detail-row">
                <span class="detail-label">📅 Fecha:</span>
                <span class="detail-value">{departure_date}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">🕐 Hora:</span>
                <span class="detail-value">{departure_time}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">👤 Pasajero:</span>
                <span class="detail-value">{passenger_name}</span>
            </div>
        </div>
        
        <p style="margin-top: 24px;">
            <strong>Información importante:</strong><br>
            • Los asientos de esta reserva han sido liberados y están disponibles nuevamente.<br>
            • Puedes ver todos los detalles del viaje y gestionar tus reservas desde la aplicación.<br>
            • Si tienes otras reservas pendientes, puedes aceptarlas ahora.
        </p>
        
        <div class="footer">
            <p>© 2025 UniGO - Carpooling universitario</p>
        </div>
    </div>
</body>
</html>
"""

    def _get_trip_confirmed_email_html(
        self,
        passenger_name: str,
        driver_name: str,
        departure_city: str,
        destination_city: str,
        departure_date: str,
        departure_time: str,
        meeting_point: Optional[str],
        seats: int,
        trip_url: str,
    ) -> str:
        """Generate HTML template for trip confirmed email."""
        meeting_point_text = meeting_point if meeting_point else "Se acordará con el conductor"
        
        return f"""
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Viaje confirmado - UniGO</title>
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
            color: #22c55e;
            margin-bottom: 10px;
        }}
        .success-badge {{
            background-color: #22c55e;
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: bold;
            display: inline-block;
            margin-bottom: 20px;
        }}
        .trip-details {{
            background-color: #f9fafb;
            border-radius: 8px;
            padding: 24px;
            margin: 24px 0;
        }}
        .detail-row {{
            display: flex;
            justify-content: space-between;
            padding: 12px 0;
            border-bottom: 1px solid #e5e7eb;
        }}
        .detail-row:last-child {{
            border-bottom: none;
        }}
        .detail-label {{
            font-weight: 600;
            color: #6b7280;
        }}
        .detail-value {{
            color: #111827;
            text-align: right;
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
            <div class="success-badge">✅ Viaje Confirmado</div>
            <h1 style="color: #333; margin: 20px 0 10px 0;">¡Tu viaje ha sido confirmado!</h1>
        </div>
        
        <p>Hola <strong>{passenger_name}</strong>,</p>
        
        <p>¡Excelente noticia! El conductor <strong>{driver_name}</strong> ha confirmado tu reserva para el siguiente viaje:</p>
        
        <div class="trip-details">
            <div class="detail-row">
                <span class="detail-label">📍 Origen:</span>
                <span class="detail-value"><strong>{departure_city}</strong></span>
            </div>
            <div class="detail-row">
                <span class="detail-label">🎯 Destino:</span>
                <span class="detail-value"><strong>{destination_city}</strong></span>
            </div>
            <div class="detail-row">
                <span class="detail-label">📅 Fecha:</span>
                <span class="detail-value">{departure_date}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">🕐 Hora:</span>
                <span class="detail-value">{departure_time}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">👤 Conductor:</span>
                <span class="detail-value">{driver_name}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">💺 Plazas reservadas:</span>
                <span class="detail-value">{seats} {('plaza' if seats == 1 else 'plazas')}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">📍 Punto de encuentro:</span>
                <span class="detail-value">{meeting_point_text}</span>
            </div>
        </div>
        
        <p style="margin-top: 24px;">
            <strong>Próximos pasos:</strong><br>
            • El conductor se pondrá en contacto contigo si necesita coordinar el punto de encuentro.<br>
            • Puedes ver todos los detalles del viaje y contactar con el conductor desde la aplicación.<br>
            • ¡Disfruta de tu viaje!
        </p>
        
        <div class="footer">
            <p>© 2025 UniGO - Carpooling universitario</p>
        </div>
    </div>
</body>
</html>
"""

    async def send_trip_confirmed_email(
        self,
        to_email: str,
        passenger_name: str,
        driver_name: str,
        departure_city: str,
        destination_city: str,
        departure_date: str,
        departure_time: str,
        meeting_point: Optional[str],
        seats: int,
        trip_id: int,
    ) -> bool:
        """
        Send trip confirmed email to passenger.

        Args:
            to_email: Passenger email address
            passenger_name: Passenger full name
            driver_name: Driver full name
            departure_city: Trip origin city
            destination_city: Trip destination city
            departure_date: Trip departure date (formatted string)
            departure_time: Trip departure time (HH:MM format)
            meeting_point: Optional meeting point
            seats: Number of seats reserved
            trip_id: Trip ID for the URL

        Returns:
            True if email was sent successfully, False otherwise
        """
        log.info(f"[EmailService] send_trip_confirmed_email called for {to_email} (trip {trip_id})")
        
        try:
            frontend_url = os.getenv("FRONTEND_URL", "http://127.0.0.1:3001")
            trip_url = f"{frontend_url}/my-rides?trip={trip_id}"
            
            subject = "UniGO – Tu viaje ha sido confirmado ✅"
            html_body = self._get_trip_confirmed_email_html(
                passenger_name=passenger_name,
                driver_name=driver_name,
                departure_city=departure_city,
                destination_city=destination_city,
                departure_date=departure_date,
                departure_time=departure_time,
                meeting_point=meeting_point,
                seats=seats,
                trip_url=trip_url,
            )
            text_body = f"""UniGO – Tu viaje ha sido confirmado ✅

Hola {passenger_name},

¡Excelente noticia! El conductor {driver_name} ha confirmado tu reserva para el siguiente viaje:

📍 Origen: {departure_city}
🎯 Destino: {destination_city}
📅 Fecha: {departure_date}
🕐 Hora: {departure_time}
👤 Conductor: {driver_name}
💺 Plazas reservadas: {seats} {('plaza' if seats == 1 else 'plazas')}
📍 Punto de encuentro: {meeting_point if meeting_point else 'Se acordará con el conductor'}

Próximos pasos:
• El conductor se pondrá en contacto contigo si necesita coordinar el punto de encuentro.
• Puedes ver todos los detalles del viaje y contactar con el conductor desde la aplicación.
• ¡Disfruta de tu viaje!

© 2025 UniGO - Carpooling universitario
"""

            log.info(f"[EmailService] Calling _send_email for trip confirmation to {to_email}")
            result = await self._send_email(to_email, subject, html_body, text_body)
            
            if result:
                log.info(f"[EmailService] ✅ Trip confirmation email sent successfully to {to_email}")
            else:
                log.error(f"[EmailService] ❌ Failed to send trip confirmation email to {to_email}")
            
            return result
        except Exception as e:
            log.error(
                f"[EmailService] ❌ Exception sending trip confirmation email to {to_email}: {str(e)}",
                exc_info=True
            )
            return False

    async def send_passenger_cancellation_email(
        self,
        to_email: str,
        driver_name: str,
        passenger_name: str,
        departure_city: str,
        destination_city: str,
        departure_date: str,
        departure_time: str,
        trip_id: int,
    ) -> bool:
        """
        Send passenger cancellation email to driver.

        Args:
            to_email: Driver email address
            driver_name: Driver full name
            passenger_name: Passenger full name who cancelled
            departure_city: Trip origin city
            destination_city: Trip destination city
            departure_date: Trip departure date (formatted string)
            departure_time: Trip departure time (HH:MM format)
            trip_id: Trip ID for reference

        Returns:
            True if email was sent successfully, False otherwise
        """
        log.info(f"[EmailService] send_passenger_cancellation_email called for {to_email} (trip {trip_id})")
        
        try:
            subject = "UniGO – Un pasajero ha cancelado su reserva"
            html_body = self._get_passenger_cancellation_email_html(
                driver_name=driver_name,
                passenger_name=passenger_name,
                departure_city=departure_city,
                destination_city=destination_city,
                departure_date=departure_date,
                departure_time=departure_time,
            )
            text_body = f"""UniGO – Un pasajero ha cancelado su reserva

Hola {driver_name},

Te informamos que {passenger_name} ha cancelado su reserva para el siguiente viaje:

📍 Origen: {departure_city}
🎯 Destino: {destination_city}
📅 Fecha: {departure_date}
🕐 Hora: {departure_time}
👤 Pasajero: {passenger_name}

Información importante:
• Los asientos de esta reserva han sido liberados y están disponibles nuevamente.
• Puedes ver todos los detalles del viaje y gestionar tus reservas desde la aplicación.
• Si tienes otras reservas pendientes, puedes aceptarlas ahora.

© 2025 UniGO - Carpooling universitario
"""

            log.info(f"[EmailService] Calling _send_email for passenger cancellation to {to_email}")
            result = await self._send_email(to_email, subject, html_body, text_body)
            
            if result:
                log.info(f"[EmailService] ✅ Passenger cancellation email sent successfully to {to_email}")
            else:
                log.error(f"[EmailService] ❌ Failed to send passenger cancellation email to {to_email}")
            
            return result
        except Exception as e:
            log.error(
                f"[EmailService] ❌ Exception sending passenger cancellation email to {to_email}: {str(e)}",
                exc_info=True
            )
            return False


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


async def send_trip_confirmed_email(
    to_email: str,
    passenger_name: str,
    driver_name: str,
    departure_city: str,
    destination_city: str,
    departure_date: str,
    departure_time: str,
    meeting_point: Optional[str],
    seats: int,
    trip_id: int,
) -> bool:
    """
    Send trip confirmed email (async wrapper).
    Returns True if sent successfully, False otherwise.
    """
    log.info(f"[Email] send_trip_confirmed_email async called for {to_email} (trip {trip_id})")
    
    try:
        service = get_email_service()
        success = await service.send_trip_confirmed_email(
            to_email=to_email,
            passenger_name=passenger_name,
            driver_name=driver_name,
            departure_city=departure_city,
            destination_city=destination_city,
            departure_date=departure_date,
            departure_time=departure_time,
            meeting_point=meeting_point,
            seats=seats,
            trip_id=trip_id,
        )
        
        if success:
            log.info(f"[Email] ✅ Trip confirmation email sent successfully to {to_email}")
        else:
            log.warning(f"[Email] ⚠️ Failed to send trip confirmation email to {to_email}")
        
        return success
    except Exception as e:
        log.error(
            f"[Email] ❌ Exception in send_trip_confirmed_email for {to_email}: {str(e)}",
            exc_info=True
        )
        return False


def send_passenger_cancellation_email_sync(
    to_email: str,
    driver_name: str,
    passenger_name: str,
    departure_city: str,
    destination_city: str,
    departure_date: str,
    departure_time: str,
    trip_id: int,
) -> None:
    """
    Synchronous wrapper for sending passenger cancellation email.
    SOLUCIÓN DEFINITIVA: Envío directo síncrono sin asyncio.
    Usa EXACTAMENTE el mismo patrón que send_verification_email_sync.
    """
    import threading
    import base64
    import httpx
    thread_name = threading.current_thread().name
    
    # FORZAR LOGS INMEDIATOS
    print("=" * 70, flush=True)
    print(f"[Email] ===== INICIANDO ENVÍO DE EMAIL DE CANCELACIÓN DE RESERVA =====", flush=True)
    print(f"[Email] Thread: '{thread_name}'", flush=True)
    print(f"[Email] Email: {to_email}", flush=True)
    print(f"[Email] Trip ID: {trip_id}", flush=True)
    print("=" * 70, flush=True)
    
    log.info("=" * 70)
    log.info(f"[Email] ===== INICIANDO ENVÍO DE EMAIL DE CANCELACIÓN DE RESERVA =====")
    log.info(f"[Email] Thread: '{thread_name}'")
    log.info(f"[Email] Email: {to_email}")
    log.info(f"[Email] Trip ID: {trip_id}")
    log.info("=" * 70)
    
    try:
        # Cargar configuración directamente (igual que send_verification_email_sync)
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
        
        # Si es Mailjet, enviar directamente SIN asyncio (igual que send_verification_email_sync)
        if email_backend == "mailjet" and mailjet_api_key and mailjet_secret_key:
            print(f"[Email] Enviando con Mailjet API (síncrono)...", flush=True)
            log.info(f"[Email] Enviando con Mailjet API (síncrono)")
            
            subject = "UniGO – Un pasajero ha cancelado su reserva"
            
            # Generar HTML del email (usar el mismo método del servicio)
            service = get_email_service()
            html_body = service._get_passenger_cancellation_email_html(
                driver_name=driver_name,
                passenger_name=passenger_name,
                departure_city=departure_city,
                destination_city=destination_city,
                departure_date=departure_date,
                departure_time=departure_time,
            )
            
            text_body = f"""UniGO – Un pasajero ha cancelado su reserva

Hola {driver_name},

Te informamos que {passenger_name} ha cancelado su reserva para el siguiente viaje:

📍 Origen: {departure_city}
🎯 Destino: {destination_city}
📅 Fecha: {departure_date}
🕐 Hora: {departure_time}
👤 Pasajero: {passenger_name}

Información importante:
• Los asientos de esta reserva han sido liberados y están disponibles nuevamente.
• Puedes ver todos los detalles del viaje y gestionar tus reservas desde la aplicación.
• Si tienes otras reservas pendientes, puedes aceptarlas ahora.

© 2025 UniGO - Carpooling universitario
"""
            
            url = "https://api.mailjet.com/v3.1/send"
            auth_string = f"{mailjet_api_key}:{mailjet_secret_key}"
            auth_b64 = base64.b64encode(auth_string.encode('ascii')).decode('ascii')
            
            headers = {
                "Authorization": f"Basic {auth_b64}",
                "Content-Type": "application/json",
            }
            
            payload = {
                "Messages": [
                    {
                        "From": {
                            "Email": email_from,
                            "Name": email_from_name,
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
            
            print(f"[Email] Payload preparado:", flush=True)
            print(f"  - From: {email_from} ({email_from_name})", flush=True)
            print(f"  - To: {to_email}", flush=True)
            print(f"  - Subject: {subject}", flush=True)
            print(f"[Email] Haciendo POST a Mailjet API...", flush=True)
            log.info(f"[Email] Haciendo POST a Mailjet API para {to_email}")
            log.info(f"[Email] From: {email_from} ({email_from_name})")
            
            # Usar el mismo timeout que send_verification_email_sync
            with httpx.Client(timeout=httpx.Timeout(5.0, read=10.0)) as client:
                print(f"[Email] Enviando a Mailjet API...", flush=True)
                log.info(f"[Email] Enviando a Mailjet API...")
                response = client.post(url, json=payload, headers=headers)
                
                print(f"[Email] Respuesta recibida: Status {response.status_code}", flush=True)
                log.info(f"[Email] Respuesta recibida: Status {response.status_code}")
                
                if response.status_code != 200:
                    print(f"[Email] Response body: {response.text}", flush=True)
                    log.error(f"[Email] Mailjet error response: {response.text}")
                
                response.raise_for_status()
                
                # Verificar que Mailjet aceptó el email (igual que send_verification_email_sync)
                if response.status_code == 200:
                    try:
                        result = response.json()
                        print(f"[Email] Mailjet response completa: {result}", flush=True)
                        log.info(f"[Email] Mailjet response completa: {result}")
                        
                        if result.get("Messages"):
                            msg = result["Messages"][0]
                            msg_status = msg.get("Status", "unknown")
                            msg_errors = msg.get("Errors", [])
                            
                            print(f"[Email] Status del mensaje: {msg_status}", flush=True)
                            log.info(f"[Email] Status del mensaje: {msg_status}")
                            
                            if msg_status == "success":
                                print(f"[Email] ✅ Mailjet aceptó el email inmediatamente", flush=True)
                                log.info(f"[Email] ✅ Mailjet aceptó el email inmediatamente")
                            else:
                                print(f"[Email] ⚠️ Mailjet respondió pero Status: {msg_status}", flush=True)
                                log.warning(f"[Email] ⚠️ Mailjet respondió pero Status: {msg_status}")
                                if msg_errors:
                                    print(f"[Email] Errores de Mailjet: {msg_errors}", flush=True)
                                    log.warning(f"[Email] Errores de Mailjet: {msg_errors}")
                    except Exception as parse_error:
                        print(f"[Email] ⚠️ Error parseando respuesta de Mailjet: {parse_error}", flush=True)
                        log.warning(f"[Email] ⚠️ Error parseando respuesta de Mailjet: {parse_error}")
            
            print(f"[Email] ✅ Email enviado exitosamente (Status: {response.status_code})", flush=True)
            log.info(f"[Email] ✅ Passenger cancellation email sent successfully to {to_email} via Mailjet (Status: {response.status_code})")
        else:
            print(f"[Email] ⚠️ EMAIL_BACKEND no es 'mailjet' o faltan credenciales", flush=True)
            log.warning(f"[Email] ⚠️ EMAIL_BACKEND={email_backend}, no se puede enviar email")
    except Exception as e:
        print("=" * 70, flush=True)
        print(f"[Email] ❌❌❌ ERROR AL ENVIAR EMAIL DE CANCELACIÓN DE RESERVA ❌❌❌", flush=True)
        print(f"[Email] Error: {str(e)}", flush=True)
        print("=" * 70, flush=True)
        log.error("=" * 70)
        log.error(f"[Email] ❌❌❌ ERROR CRÍTICO al enviar email de cancelación de reserva ❌❌❌")
        log.error(f"[Email] Email={to_email}, Trip={trip_id}")
        log.error(f"[Email] Error: {str(e)}")
        log.error("=" * 70)
        import traceback
        traceback.print_exc()


def send_trip_confirmed_email_sync(
    to_email: str,
    passenger_name: str,
    driver_name: str,
    departure_city: str,
    destination_city: str,
    departure_date: str,
    departure_time: str,
    meeting_point: Optional[str],
    seats: int,
    trip_id: int,
) -> None:
    """
    Synchronous wrapper for sending trip confirmed email.
    SOLUCIÓN DEFINITIVA: Envío directo síncrono sin asyncio.
    Usa EXACTAMENTE el mismo patrón que send_verification_email_sync.
    """
    import threading
    import base64
    import httpx
    thread_name = threading.current_thread().name
    
    # FORZAR LOGS INMEDIATOS
    print("=" * 70, flush=True)
    print(f"[Email] ===== INICIANDO ENVÍO DE EMAIL DE VIAJE CONFIRMADO =====", flush=True)
    print(f"[Email] Thread: '{thread_name}'", flush=True)
    print(f"[Email] Email: {to_email}", flush=True)
    print(f"[Email] Trip ID: {trip_id}", flush=True)
    print("=" * 70, flush=True)
    
    log.info("=" * 70)
    log.info(f"[Email] ===== INICIANDO ENVÍO DE EMAIL DE VIAJE CONFIRMADO =====")
    log.info(f"[Email] Thread: '{thread_name}'")
    log.info(f"[Email] Email: {to_email}")
    log.info(f"[Email] Trip ID: {trip_id}")
    log.info("=" * 70)
    
    try:
        # Cargar configuración directamente (igual que send_verification_email_sync)
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
        
        # Si es Mailjet, enviar directamente SIN asyncio (igual que send_verification_email_sync)
        if email_backend == "mailjet" and mailjet_api_key and mailjet_secret_key:
            print(f"[Email] Enviando con Mailjet API (síncrono)...", flush=True)
            log.info(f"[Email] Enviando con Mailjet API (síncrono)")
            
            frontend_url = os.getenv("FRONTEND_URL", "http://127.0.0.1:3001")
            trip_url = f"{frontend_url}/my-rides?trip={trip_id}"
            
            subject = "UniGO – Tu viaje ha sido confirmado ✅"
            
            # Generar HTML del email (usar el mismo método del servicio)
            service = get_email_service()
            html_body = service._get_trip_confirmed_email_html(
                passenger_name=passenger_name,
                driver_name=driver_name,
                departure_city=departure_city,
                destination_city=destination_city,
                departure_date=departure_date,
                departure_time=departure_time,
                meeting_point=meeting_point,
                seats=seats,
                trip_url=trip_url,
            )
            
            text_body = f"""UniGO – Tu viaje ha sido confirmado ✅

Hola {passenger_name},

¡Excelente noticia! El conductor {driver_name} ha confirmado tu reserva para el siguiente viaje:

📍 Origen: {departure_city}
🎯 Destino: {destination_city}
📅 Fecha: {departure_date}
🕐 Hora: {departure_time}
👤 Conductor: {driver_name}
💺 Plazas reservadas: {seats} {('plaza' if seats == 1 else 'plazas')}
📍 Punto de encuentro: {meeting_point if meeting_point else 'Se acordará con el conductor'}

Próximos pasos:
• El conductor se pondrá en contacto contigo si necesita coordinar el punto de encuentro.
• Puedes ver todos los detalles del viaje y contactar con el conductor desde la aplicación.
• ¡Disfruta de tu viaje!

© 2025 UniGO - Carpooling universitario
"""
            
            url = "https://api.mailjet.com/v3.1/send"
            auth_string = f"{mailjet_api_key}:{mailjet_secret_key}"
            auth_b64 = base64.b64encode(auth_string.encode('ascii')).decode('ascii')
            
            headers = {
                "Authorization": f"Basic {auth_b64}",
                "Content-Type": "application/json",
            }
            
            payload = {
                "Messages": [
                    {
                        "From": {
                            "Email": email_from,
                            "Name": email_from_name,
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
            
            print(f"[Email] Payload preparado:", flush=True)
            print(f"  - From: {email_from} ({email_from_name})", flush=True)
            print(f"  - To: {to_email}", flush=True)
            print(f"  - Subject: {subject}", flush=True)
            print(f"[Email] Haciendo POST a Mailjet API...", flush=True)
            log.info(f"[Email] Haciendo POST a Mailjet API para {to_email}")
            log.info(f"[Email] From: {email_from} ({email_from_name})")
            
            # Usar el mismo timeout que send_verification_email_sync
            with httpx.Client(timeout=httpx.Timeout(5.0, read=10.0)) as client:
                response = client.post(url, json=payload, headers=headers)
                
                print(f"[Email] Respuesta de Mailjet: Status {response.status_code}", flush=True)
                if response.status_code != 200:
                    print(f"[Email] Response body: {response.text}", flush=True)
                
                response.raise_for_status()
                
                # Log de respuesta exitosa
                try:
                    response_data = response.json()
                    print(f"[Email] Mailjet response: {response_data}", flush=True)
                    log.info(f"[Email] Mailjet response: {response_data}")
                except:
                    pass
            
            print(f"[Email] ✅ Email enviado exitosamente (Status: {response.status_code})", flush=True)
            log.info(f"[Email] ✅ Trip confirmation email sent successfully to {to_email} via Mailjet (Status: {response.status_code})")
        else:
            print(f"[Email] ⚠️ EMAIL_BACKEND no es 'mailjet' o faltan credenciales", flush=True)
            log.warning(f"[Email] ⚠️ EMAIL_BACKEND={email_backend}, no se puede enviar email")
    except Exception as e:
        print("=" * 70, flush=True)
        print(f"[Email] ❌❌❌ ERROR AL ENVIAR EMAIL DE VIAJE CONFIRMADO ❌❌❌", flush=True)
        print(f"[Email] Error: {str(e)}", flush=True)
        print("=" * 70, flush=True)
        log.error("=" * 70)
        log.error(f"[Email] ❌❌❌ ERROR CRÍTICO al enviar email de viaje confirmado ❌❌❌")
        log.error(f"[Email] Email={to_email}, Trip={trip_id}")
        log.error(f"[Email] Error: {str(e)}")
        log.error("=" * 70)
        import traceback
        traceback.print_exc()


def send_new_booking_request_email_sync(
    to_email: str,
    driver_name: str,
    passenger_name: str,
    departure_city: str,
    destination_city: str,
    departure_date: str,
    departure_time: str,
    seats: int,
) -> None:
    """
    Send email to driver when they receive a new booking request.
    This is sent synchronously when a passenger creates a booking in pending status.
    """
    try:
        import base64
        
        # Load environment variables (same pattern as send_verification_email_sync)
        from dotenv import load_dotenv
        backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        env_path = os.path.join(backend_dir, ".env")
        if os.path.exists(env_path):
            load_dotenv(env_path, override=True)
        
        email_backend = os.getenv("EMAIL_BACKEND", "").strip().lower()
        mailjet_api_key = os.getenv("MAILJET_API_KEY", "").strip()
        mailjet_secret_key = os.getenv("MAILJET_SECRET_KEY", "").strip()
        email_from = os.getenv("EMAIL_FROM", "unigonoreply@gmail.com").strip()
        email_from_name = os.getenv("EMAIL_FROM_NAME", "UniGO").strip()
        
        print(f"[Email] Enviando email de nueva solicitud de reserva a {to_email}", flush=True)
        log.info(f"[Email] Sending new booking request email to {to_email}")
        log.info(f"[Email] Config: backend={email_backend}, mailjet_api_key={'present' if mailjet_api_key else 'missing'}")
        
        subject = "Nueva solicitud de reserva en UniGO"
        
        text_body = f"""Hola {driver_name},

Tienes una nueva solicitud de reserva pendiente de confirmar en uno de tus viajes.

Entra en UniGO para revisarla y aceptarla o rechazarla.

UniGO
"""
        
        html_body = f"""<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Nueva solicitud de reserva - UniGO</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
    <div style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
        <!-- Content -->
        <div style="padding: 40px;">
            <p style="margin: 0 0 24px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                Hola <strong>{driver_name}</strong>,
            </p>
            
            <p style="margin: 0 0 24px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                Tienes una nueva solicitud de reserva pendiente de confirmar en uno de tus viajes.
            </p>
            
            <p style="margin: 0 0 24px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                Entra en UniGO para revisarla y aceptarla o rechazarla.
            </p>
        </div>
        
        <!-- Footer -->
        <div style="background-color: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0; color: #6b7280; font-size: 14px;">
                <strong style="color: #10b981;">UniGO</strong>
            </p>
        </div>
    </div>
</body>
</html>
"""
        
        # Send via Mailjet
        if email_backend == "mailjet" and mailjet_api_key and mailjet_secret_key:
            print(f"[Email] Enviando con Mailjet API...", flush=True)
            log.info(f"[Email] Sending new booking request email via Mailjet to {to_email}")
            
            url = "https://api.mailjet.com/v3.1/send"
            auth_string = f"{mailjet_api_key}:{mailjet_secret_key}"
            auth_b64 = base64.b64encode(auth_string.encode('ascii')).decode('ascii')
            
            headers = {
                "Authorization": f"Basic {auth_b64}",
                "Content-Type": "application/json",
            }
            
            payload = {
                "Messages": [
                    {
                        "From": {
                            "Email": email_from,
                            "Name": email_from_name,
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
            
            print(f"[Email] Haciendo POST a Mailjet...", flush=True)
            with httpx.Client(timeout=httpx.Timeout(5.0, read=10.0)) as client:
                response = client.post(url, json=payload, headers=headers)
                print(f"[Email] Respuesta: Status {response.status_code}", flush=True)
                response.raise_for_status()
                
                # Log response
                try:
                    response_data = response.json()
                    print(f"[Email] Mailjet response: {response_data}", flush=True)
                    log.info(f"[Email] Mailjet response: {response_data}")
                except:
                    pass
            
            print(f"[Email] ✅ Email de nueva solicitud enviado exitosamente", flush=True)
            log.info(f"[Email] ✅ New booking request email sent successfully to {to_email}")
        else:
            print(f"[Email] ⚠️ Mailjet not configured: backend={email_backend}, api_key={'present' if mailjet_api_key else 'missing'}", flush=True)
            log.warning(f"[Email] Mailjet not configured, skipping new booking request email")
            
    except Exception as e:
        log.error(f"[Email] ❌ Error sending new booking request email to {to_email}: {e}", exc_info=True)
        # Don't raise - email failure shouldn't block booking creation


def send_booking_rejected_email_sync(
    to_email: str,
    passenger_name: str,
    driver_name: str,
    departure_city: str,
    destination_city: str,
    departure_date: str,
    departure_time: str,
    trip_id: int,
) -> None:
    """
    Send email to passenger when their booking is rejected by the driver.
    This is sent synchronously when a driver rejects a booking.
    Uses the same pattern as send_trip_confirmed_email_sync.
    """
    import threading
    import base64
    import httpx
    thread_name = threading.current_thread().name
    
    # FORZAR LOGS INMEDIATOS
    print("=" * 70, flush=True)
    print(f"[Email] ===== INICIANDO ENVÍO DE EMAIL DE RESERVA RECHAZADA =====", flush=True)
    print(f"[Email] Thread: '{thread_name}'", flush=True)
    print(f"[Email] Email: {to_email}", flush=True)
    print(f"[Email] Trip ID: {trip_id}", flush=True)
    print("=" * 70, flush=True)
    
    log.info("=" * 70)
    log.info(f"[Email] ===== INICIANDO ENVÍO DE EMAIL DE RESERVA RECHAZADA =====")
    log.info(f"[Email] Thread: '{thread_name}'")
    log.info(f"[Email] Email: {to_email}")
    log.info(f"[Email] Trip ID: {trip_id}")
    log.info("=" * 70)
    
    try:
        # Cargar configuración directamente (igual que send_verification_email_sync)
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
            
            frontend_url = os.getenv("FRONTEND_URL", "http://127.0.0.1:5173")
            
            subject = "UniGO – Tu reserva ha sido rechazada"
            
            html_body = f"""
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reserva rechazada - UniGO</title>
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
            color: #f97316;
            margin-bottom: 10px;
        }}
        .rejected-badge {{
            background-color: #ef4444;
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: bold;
            display: inline-block;
            margin-bottom: 20px;
        }}
        .trip-details {{
            background-color: #f9fafb;
            border-radius: 8px;
            padding: 24px;
            margin: 24px 0;
        }}
        .detail-row {{
            display: flex;
            justify-content: space-between;
            padding: 12px 0;
            border-bottom: 1px solid #e5e7eb;
        }}
        .detail-row:last-child {{
            border-bottom: none;
        }}
        .detail-label {{
            font-weight: 600;
            color: #6b7280;
        }}
        .detail-value {{
            color: #111827;
            text-align: right;
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
            <div class="rejected-badge">❌ Reserva Rechazada</div>
            <h1 style="color: #333; margin: 20px 0 10px 0;">Tu reserva ha sido rechazada</h1>
        </div>
        
        <p>Hola <strong>{passenger_name}</strong>,</p>
        
        <p>El conductor <strong>{driver_name}</strong> ha rechazado tu solicitud para el siguiente viaje:</p>
        
        <div class="trip-details">
            <div class="detail-row">
                <span class="detail-label">📍 Origen:</span>
                <span class="detail-value"><strong>{departure_city}</strong></span>
            </div>
            <div class="detail-row">
                <span class="detail-label">🎯 Destino:</span>
                <span class="detail-value"><strong>{destination_city}</strong></span>
            </div>
            <div class="detail-row">
                <span class="detail-label">📅 Fecha:</span>
                <span class="detail-value">{departure_date}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">🕐 Hora:</span>
                <span class="detail-value">{departure_time}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">👤 Conductor:</span>
                <span class="detail-value">{driver_name}</span>
            </div>
        </div>
        
        <p style="margin-top: 24px;">
            Puedes buscar otro viaje en UniGO.
        </p>
        
        <div class="footer">
            <p>© 2025 UniGO - Carpooling universitario</p>
        </div>
    </div>
</body>
</html>
"""
            
            text_body = f"""UniGO – Tu reserva ha sido rechazada

Hola {passenger_name},

El conductor {driver_name} ha rechazado tu solicitud para el siguiente viaje:

📍 Origen: {departure_city}
🎯 Destino: {destination_city}
📅 Fecha: {departure_date}
🕐 Hora: {departure_time}

Puedes buscar otro viaje en UniGO.

© 2025 UniGO - Carpooling universitario
"""
            
            url = "https://api.mailjet.com/v3.1/send"
            auth_string = f"{mailjet_api_key}:{mailjet_secret_key}"
            auth_b64 = base64.b64encode(auth_string.encode('ascii')).decode('ascii')
            
            headers = {
                "Authorization": f"Basic {auth_b64}",
                "Content-Type": "application/json",
            }
            
            payload = {
                "Messages": [
                    {
                        "From": {
                            "Email": email_from,
                            "Name": email_from_name,
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
            
            with httpx.Client(timeout=httpx.Timeout(5.0, read=10.0)) as client:
                print(f"[Email] Enviando a Mailjet API...", flush=True)
                log.info(f"[Email] Enviando a Mailjet API...")
                response = client.post(url, json=payload, headers=headers)
                print(f"[Email] Respuesta recibida: Status {response.status_code}", flush=True)
                log.info(f"[Email] Respuesta recibida: Status {response.status_code}")
                response.raise_for_status()
                
                # Log de respuesta exitosa
                try:
                    response_data = response.json()
                    print(f"[Email] Mailjet response: {response_data}", flush=True)
                    log.info(f"[Email] Mailjet response: {response_data}")
                except:
                    pass
            
            print(f"[Email] ✅ Email enviado exitosamente (Status: {response.status_code})", flush=True)
            log.info(f"[Email] ✅ Booking rejected email sent successfully to {to_email} via Mailjet (Status: {response.status_code})")
        else:
            print(f"[Email] ⚠️ EMAIL_BACKEND no es 'mailjet' o faltan credenciales", flush=True)
            log.warning(f"[Email] ⚠️ EMAIL_BACKEND={email_backend}, no se puede enviar email")
    except Exception as e:
        print("=" * 70, flush=True)
        print(f"[Email] ❌❌❌ ERROR AL ENVIAR EMAIL DE RESERVA RECHAZADA ❌❌❌", flush=True)
        print(f"[Email] Error: {str(e)}", flush=True)
        print("=" * 70, flush=True)
        log.error("=" * 70)
        log.error(f"[Email] ❌❌❌ ERROR CRÍTICO al enviar email de reserva rechazada ❌❌❌")
        log.error(f"[Email] Email={to_email}, Trip={trip_id}")
        log.error(f"[Email] Error: {str(e)}")
        log.error("=" * 70)
        import traceback
        traceback.print_exc()


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
            log.warning(f"[Email] Email backend '{email_backend}' not configured or missing credentials")
    except Exception as e:
        print("=" * 70, flush=True)
        print(f"[Email] ❌ EXCEPCIÓN AL ENVIAR EMAIL DE VERIFICACIÓN", flush=True)
        print(f"[Email] Email: {email}", flush=True)
        print(f"[Email] Código: {code}", flush=True)
        print(f"[Email] Error: {str(e)}", flush=True)
        print("=" * 70, flush=True)
        log.error("=" * 70)
        log.error(f"[Email] ❌ EXCEPCIÓN AL ENVIAR EMAIL DE VERIFICACIÓN")
        log.error(f"[Email] Email: {email}")
        log.error(f"[Email] Código: {code}")
        log.error(f"[Email] Error: {str(e)}")
        log.error("=" * 70)
        log.error(f"[Email] Traceback completo:", exc_info=True)
        import traceback
        traceback.print_exc()


def send_password_reset_email_sync(email: str, reset_url: str) -> None:
    """
    Synchronous wrapper for sending password reset email.
    Usa el mismo patrón que send_verification_email_sync.
    """
    import threading
    import base64
    thread_name = threading.current_thread().name
    
    # FORZAR LOGS INMEDIATOS
    print("=" * 70, flush=True)
    print(f"[Email] ===== INICIANDO ENVÍO DE EMAIL DE RECUPERACIÓN DE CONTRASEÑA =====", flush=True)
    print(f"[Email] Thread: '{thread_name}'", flush=True)
    print(f"[Email] Email: {email}", flush=True)
    print("=" * 70, flush=True)
    
    log.info("=" * 70)
    log.info(f"[Email] ===== INICIANDO ENVÍO DE EMAIL DE RECUPERACIÓN DE CONTRASEÑA =====")
    log.info(f"[Email] Thread: '{thread_name}'")
    log.info(f"[Email] Email: {email}")
    log.info("=" * 70)
    
    try:
        # Cargar configuración directamente
        from dotenv import load_dotenv
        import os as os_module
        backend_dir = os_module.path.dirname(os_module.path.dirname(os_module.path.dirname(os_module.path.abspath(__file__))))
        env_path = os_module.path.join(backend_dir, ".env")
        if os_module.path.exists(env_path):
            load_dotenv(env_path, override=True)
        
        email_backend = os_module.getenv("EMAIL_BACKEND", "").lower().strip()
        
        if email_backend == "mailjet":
            # Mailjet API
            api_key = os_module.getenv("MAILJET_API_KEY", "").strip()
            api_secret = os_module.getenv("MAILJET_SECRET_KEY", "").strip()
            email_from = os_module.getenv("EMAIL_FROM", "noreply@unigo.app")
            email_from_name = os_module.getenv("EMAIL_FROM_NAME", "UniGO")
            
            print(f"[Email] Mailjet config check:", flush=True)
            print(f"  - API Key present: {'✅' if api_key else '❌'}", flush=True)
            print(f"  - Secret Key present: {'✅' if api_secret else '❌'}", flush=True)
            log.info(f"[Email] Mailjet config: api_key={'present' if api_key else 'missing'}, secret_key={'present' if api_secret else 'missing'}")
            
            if not api_key or not api_secret:
                log.error("[Email] Mailjet credentials not found")
                print("[Email] ❌ Mailjet credentials not found", flush=True)
                return
            
            url = "https://api.mailjet.com/v3.1/send"
            auth_string = f"{api_key}:{api_secret}"
            auth_bytes = auth_string.encode("utf-8")
            auth_b64 = base64.b64encode(auth_bytes).decode("utf-8")
            headers = {
                "Authorization": f"Basic {auth_b64}",
                "Content-Type": "application/json",
            }
            
            # HTML del email
            html_body = f"""
            <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #f97316;">Recuperación de contraseña</h2>
                    <p>Has solicitado restablecer tu contraseña.</p>
                    <p>Pulsa este enlace para crear una nueva contraseña:</p>
                    <p style="margin: 20px 0;">
                        <a href="{reset_url}" style="background-color: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                            Restablecer contraseña
                        </a>
                    </p>
                    <p style="margin-top: 10px; font-size: 14px; color: #666;">
                        O copia y pega este enlace en tu navegador:<br>
                        <span style="word-break: break-all; color: #0066cc;">{reset_url}</span>
                    </p>
                    <p>Si no fuiste tú, ignora este mensaje.</p>
                    <p style="margin-top: 30px; color: #666; font-size: 12px;">UniGO</p>
                </div>
            </body>
            </html>
            """
            
            text_body = f"""Recuperación de contraseña

Has solicitado restablecer tu contraseña.

Pulsa este enlace para crear una nueva contraseña:
{reset_url}

Si no fuiste tú, ignora este mensaje.

UniGO"""
            
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
                        "Subject": "Recuperación de contraseña",
                        "TextPart": text_body,
                        "HTMLPart": html_body,
                    }
                ]
            }
            
            # Enviar con httpx síncrono
            import httpx
            with httpx.Client(timeout=httpx.Timeout(5.0, read=10.0)) as client:
                print(f"[Email] Enviando a Mailjet API...", flush=True)
                log.info(f"[Email] Enviando a Mailjet API...")
                response = client.post(url, json=payload, headers=headers)
                print(f"[Email] Respuesta recibida: Status {response.status_code}", flush=True)
                log.info(f"[Email] Respuesta recibida: Status {response.status_code}")
                response.raise_for_status()
                
                if response.status_code == 200:
                    try:
                        result = response.json()
                        if result.get("Messages"):
                            msg = result["Messages"][0]
                            if msg.get("Status") == "success":
                                print(f"[Email] ✅ Mailjet aceptó el email inmediatamente", flush=True)
                                log.info(f"[Email] ✅ Mailjet aceptó el email inmediatamente")
                    except:
                        pass
            
            print("=" * 70, flush=True)
            print(f"[Email] ✅ EMAIL DE RECUPERACIÓN ENVIADO EXITOSAMENTE", flush=True)
            print(f"[Email] Email: {email}", flush=True)
            print("=" * 70, flush=True)
            
            log.info("=" * 70)
            log.info(f"[Email] ✅ EMAIL DE RECUPERACIÓN ENVIADO EXITOSAMENTE")
            log.info(f"[Email] Email: {email}")
            log.info("=" * 70)
        else:
            log.warning(f"[Email] Email backend '{email_backend}' not configured for password reset")
    except Exception as e:
        print("=" * 70, flush=True)
        print(f"[Email] ❌ ERROR al enviar email de recuperación", flush=True)
        print(f"[Email] Error: {str(e)}", flush=True)
        print("=" * 70, flush=True)
        log.error(f"[Email] Error enviando email de recuperación a {email}: {e}", exc_info=True)
