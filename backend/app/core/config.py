# app/core/config.py
import json

from pydantic import EmailStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    secret_key: str = "change-me"
    access_token_expire_minutes: int = 60

    # --- RF-01 dominios ---
    # Importante: permitir str O list[str].
    # Así Pydantic no intenta json.loads() antes del validador.
    allowed_email_domains: list[str] | str = []
    email_code_expire_minutes: int = 15

    # --- Mail (MailHog en dev) ---
    mail_username: str | None = ""
    mail_password: str | None = ""
    mail_from: EmailStr = "unigo@soporte.com"
    mail_port: int = 1025
    mail_server: str = "127.0.0.1"
    mail_starttls: bool = False
    mail_ssl_tls: bool = False

    # Opción simple (recomendada si arrancas desde backend/)
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @field_validator("allowed_email_domains", mode="before")
    @classmethod
    def parse_domains(cls, v):
        if v is None or v == "":
            return []
        if isinstance(v, list):
            return v
        s = str(v).strip()
        if s.startswith("["):
            try:
                data = json.loads(s)
                return [d.strip().lower() for d in data]
            except Exception:
                pass
        # CSV
        return [d.strip().lower() for d in s.split(",") if d.strip()]


settings = Settings()
