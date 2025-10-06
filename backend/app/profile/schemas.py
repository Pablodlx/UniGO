from typing import Literal

from pydantic import BaseModel, HttpUrl, conint, constr, model_validator

RideIntent = Literal["offers", "seeks", "both"]


class ProfileBase(BaseModel):
    # Campos obligatorios (RF-02) — pueden ser None en GET si aún no configurados
    full_name: constr(strip_whitespace=True, max_length=150) | None = None
    university: constr(strip_whitespace=True, max_length=150) | None = None
    degree: constr(strip_whitespace=True, max_length=150) | None = None
    course: conint(ge=1, le=6) | None = None
    ride_intent: RideIntent | None = None

    # Opcional
    avatar_url: HttpUrl | str | None = None


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
