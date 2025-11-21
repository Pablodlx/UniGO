from datetime import datetime
from typing import Optional
import json

from pydantic import BaseModel, Field, ConfigDict

from app.rides.schemas import AddressData


class FavoriteRideCreate(BaseModel):
    name: str = Field(..., max_length=100, description="Name for the favorite ride")
    departure_city: str = Field(..., max_length=100)
    destination_city: str = Field(..., max_length=100)
    departure_lat: Optional[float] = None
    departure_lng: Optional[float] = None
    destination_lat: Optional[float] = None
    destination_lng: Optional[float] = None
    departure_time: Optional[str] = Field(None, pattern=r"^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$")
    available_seats: Optional[int] = Field(None, ge=0, le=8)
    price_per_seat: Optional[float] = Field(None, gt=0, le=1000)
    vehicle_brand: Optional[str] = Field(None, max_length=100)
    vehicle_color: Optional[str] = Field(None, max_length=50)
    additional_details: Optional[str] = Field(None, max_length=500)
    from_address: Optional[AddressData] = Field(None, alias="from")
    to_address: Optional[AddressData] = Field(None, alias="to")
    
    model_config = ConfigDict(populate_by_name=True)


class FavoriteRideOut(BaseModel):
    id: int
    user_id: int
    name: str
    departure_city: str
    destination_city: str
    departure_lat: Optional[float] = None
    departure_lng: Optional[float] = None
    destination_lat: Optional[float] = None
    destination_lng: Optional[float] = None
    departure_time: Optional[str] = None
    available_seats: Optional[int] = None
    price_per_seat: Optional[float] = None
    vehicle_brand: Optional[str] = None
    vehicle_color: Optional[str] = None
    additional_details: Optional[str] = None
    from_address: Optional[AddressData] = None
    to_address: Optional[AddressData] = None
    created_at: datetime
    updated_at: datetime
    
    @classmethod
    def from_orm_with_addresses(cls, favorite_ride):
        """Create FavoriteRideOut from ORM model, parsing JSON address strings"""
        data = {
            "id": favorite_ride.id,
            "user_id": favorite_ride.user_id,
            "name": favorite_ride.name,
            "departure_city": favorite_ride.departure_city,
            "destination_city": favorite_ride.destination_city,
            "departure_lat": favorite_ride.departure_lat,
            "departure_lng": favorite_ride.departure_lng,
            "destination_lat": favorite_ride.destination_lat,
            "destination_lng": favorite_ride.destination_lng,
            "departure_time": favorite_ride.departure_time,
            "available_seats": favorite_ride.available_seats,
            "price_per_seat": favorite_ride.price_per_seat,
            "vehicle_brand": favorite_ride.vehicle_brand,
            "vehicle_color": favorite_ride.vehicle_color,
            "additional_details": favorite_ride.additional_details,
            "created_at": favorite_ride.created_at,
            "updated_at": favorite_ride.updated_at,
        }
        
        # Parse JSON address strings
        if favorite_ride.from_address:
            try:
                data["from_address"] = AddressData(**json.loads(favorite_ride.from_address))
            except (json.JSONDecodeError, TypeError):
                data["from_address"] = None
        
        if favorite_ride.to_address:
            try:
                data["to_address"] = AddressData(**json.loads(favorite_ride.to_address))
            except (json.JSONDecodeError, TypeError):
                data["to_address"] = None
        
        return cls(**data)
    
    class Config:
        from_attributes = True



