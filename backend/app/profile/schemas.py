from pydantic import BaseModel, HttpUrl, constr, conint, model_validator
from typing import Optional, Literal

RideIntent = Literal["offers", "seeks", "both"]

class ProfileBase(BaseModel):
    # Campos obligatorios (RF-02) — pueden ser None en GET si aún no configurados
    full_name: Optional[constr(strip_whitespace=True, max_length=150)] = None
    university: Optional[constr(strip_whitespace=True, max_length=150)] = None
    degree: Optional[constr(strip_whitespace=True, max_length=150)] = None
    course: Optional[conint(ge=1, le=6)] = None
    ride_intent: Optional[RideIntent] = None

    # Opcional
    avatar_url: Optional[HttpUrl | str] = None

class ProfileUpdate(ProfileBase):
    # Pydantic v2: validator de modelo "after" (antes llamado root_validator)
    @model_validator(mode="after")
    def _rf02_required(self) -> "ProfileUpdate":
        required = ["full_name", "university", "degree", "course", "ride_intent"]
        missing = [k for k in required if getattr(self, k) in (None, "", 0)]
        if missing:
            # Lanzamos ValueError para que Pydantic lo reporte como error de validación
            raise ValueError(f"Faltan campos obligatorios: {', '.join(missing)}")
        return self

class ProfileOut(ProfileBase):
    email: str
