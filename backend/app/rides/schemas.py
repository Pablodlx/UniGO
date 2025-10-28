from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class RideBase(BaseModel):
    departure_city: str = Field(..., max_length=100)
    destination_city: str = Field(..., max_length=100)
    departure_date: datetime
    departure_time: str = Field(..., pattern=r"^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$")  # HH:MM format
    available_seats: int = Field(..., ge=0, le=8)
    price_per_seat: float = Field(..., gt=0, le=1000)
    vehicle_info: Optional[str] = Field(None, max_length=200)
    additional_details: Optional[str] = Field(None, max_length=500)


class RideCreate(RideBase):
    pass


class RideOut(RideBase):
    id: int
    driver_id: int
    driver_name: str
    driver_university: Optional[str]
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class RideSearch(BaseModel):
    departure_city: Optional[str] = None
    destination_city: Optional[str] = None
    departure_date: Optional[datetime] = None
