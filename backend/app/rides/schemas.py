from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, Field, ConfigDict


class RideBase(BaseModel):
    departure_city: str = Field(..., max_length=100)
    destination_city: str = Field(..., max_length=100)
    departure_date: datetime
    departure_time: str = Field(..., pattern=r"^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$")  # HH:MM format
    available_seats: int = Field(..., ge=0, le=8)
    price_per_seat: float = Field(..., gt=0, le=1000)
    vehicle_brand: Optional[str] = Field(None, max_length=100)
    vehicle_color: Optional[str] = Field(None, max_length=50)
    additional_details: Optional[str] = Field(None, max_length=500)


class AddressData(BaseModel):
    """Address data with coordinates"""
    placeId: Optional[str] = None
    formattedAddress: str
    lat: float
    lng: float


class RideCreate(RideBase):
    # Optional: coordinates can be provided via 'from' and 'to' objects
    # or will be extracted from departure_city/destination_city if not provided
    departure_lat: Optional[float] = None
    departure_lng: Optional[float] = None
    destination_lat: Optional[float] = None
    destination_lng: Optional[float] = None
    # Support for frontend format with 'from' and 'to' objects
    from_: Optional[AddressData] = Field(None, alias="from")
    to: Optional[AddressData] = None
    
    model_config = ConfigDict(populate_by_name=True)


class PassengerInfo(BaseModel):
    """Simplified passenger info for ride responses"""
    id: int
    name: str
    avatar_url: Optional[str] = None


class RideOut(RideBase):
    id: int
    driver_id: int
    driver_name: str
    driver_university: Optional[str]
    driver_avatar_url: Optional[str] = None
    departure_lat: Optional[float] = None
    departure_lng: Optional[float] = None
    destination_lat: Optional[float] = None
    destination_lng: Optional[float] = None
    estimated_duration_minutes: Optional[int] = None
    arrival_time: Optional[str] = None  # "HH:MM" format, calculated from departure_time + duration
    is_active: bool
    created_at: datetime
    driver_average_rating: Optional[float] = None
    reserved_by_user_id: Optional[int] = None  # ID of the first passenger with confirmed booking
    passengers: List[PassengerInfo] = []  # List of all confirmed passengers
    passengers_ids: List[int] = []  # List of all confirmed passenger IDs
    booking_status: Optional[str] = None  # Status of the booking: "pending", "confirmed", "rejected"

    class Config:
        from_attributes = True


class RideSearch(BaseModel):
    departure_city: Optional[str] = None
    destination_city: Optional[str] = None
    departure_date: Optional[datetime] = None


class Passenger(BaseModel):
    booking_id: int
    passenger_id: int
    passenger_name: str
    passenger_avatar: Optional[str] = None
    has_rated: bool = False
    can_rate: bool = False
