from typing import Literal

from pydantic import BaseModel, HttpUrl, conint, constr, model_validator


class HomeAddress(BaseModel):
    formatted_address: str
    place_id: str
    lat: float
    lng: float


class ProfileBase(BaseModel):
    # Campos obligatorios (RF-02) — pueden ser None en GET si aún no configurados
    full_name: constr(strip_whitespace=True, max_length=150) | None = None
    university: constr(strip_whitespace=True, max_length=150) | None = None
    degree: constr(strip_whitespace=True, max_length=150) | None = None
    course: conint(ge=1, le=6) | None = None
    home_address: HomeAddress | None = None

    # Opcional - puede ser URL completa o ruta relativa
    avatar_url: str | None = None


class ProfileUpdate(ProfileBase):
    # University is auto-detected from email, so it's not part of the update schema
    university: None = None  # Always None, cannot be updated
    
    # Pydantic v2: validator de modelo "after" (antes llamado root_validator)
    @model_validator(mode="after")
    def _rf02_required(self) -> "ProfileUpdate":
        # University is not required in updates since it's auto-detected
        required = ["full_name", "degree", "course", "home_address"]
        missing = [k for k in required if getattr(self, k) in (None, "", 0)]
        if missing:
            # Lanzamos ValueError para que Pydantic lo reporte como error de validación
            raise ValueError(f"Faltan campos obligatorios: {', '.join(missing)}")
        return self


class ProfileOut(ProfileBase):
    email: str
    average_rating: float | None = None
    rating_count: int = 0
    average_rating_display: str = "No hay valoraciones"  # Display text for average rating
