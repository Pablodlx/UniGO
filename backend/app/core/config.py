# app/core/config.py
import json

from pydantic import EmailStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    secret_key: str = "change-me"
    access_token_expire_minutes: int = 60
    database_url: str

    # --- RF-01 dominios ---
    # Importante: permitir str O list[str] para que Pydantic no fuerce json.loads() antes del validador
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

    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="",
        case_sensitive=False,
        extra="ignore",
    )

    @field_validator("allowed_email_domains", mode="before")
    @classmethod
    def _parse_domains(cls, v):
        """
        Acepta:
        - JSON: ["ugr.es","us.es"]
        - CSV:  ugr.es, us.es
        Normaliza: minúsculas, sin espacios, sin '@', sin duplicados.
        """
        if v is None or v == "":
            return []
        # Ya es lista
        if isinstance(v, list):
            raw = v
        else:
            s = str(v).strip()
            # intenta JSON primero
            try:
                parsed = json.loads(s)
                if isinstance(parsed, list):
                    raw = parsed
                else:
                    raw = [s]
            except Exception:
                # fallback CSV
                raw = [x for x in (p.strip() for p in s.split(",")) if x]

        norm: list[str] = []
        seen: set[str] = set()
        for d in raw:
            d = d.strip().lower().lstrip("@")
            if d and d not in seen:
                seen.add(d)
                norm.append(d)
        return norm


settings = Settings()
