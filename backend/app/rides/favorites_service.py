from typing import List
import json

from sqlalchemy.orm import Session

from app.auth.models import FavoriteRide, User
from app.rides.favorites_schemas import FavoriteRideCreate, FavoriteRideOut


def create_favorite_ride(db: Session, favorite_data: FavoriteRideCreate, user_id: int) -> FavoriteRideOut:
    """Create a new favorite ride"""
    # Convert address objects to JSON strings
    from_address_json = None
    if favorite_data.from_address:
        from_address_json = json.dumps({
            "placeId": favorite_data.from_address.placeId,
            "formattedAddress": favorite_data.from_address.formattedAddress,
            "lat": favorite_data.from_address.lat,
            "lng": favorite_data.from_address.lng,
        })
    
    to_address_json = None
    if favorite_data.to_address:
        to_address_json = json.dumps({
            "placeId": favorite_data.to_address.placeId,
            "formattedAddress": favorite_data.to_address.formattedAddress,
            "lat": favorite_data.to_address.lat,
            "lng": favorite_data.to_address.lng,
        })
    
    favorite_ride = FavoriteRide(
        user_id=user_id,
        name=favorite_data.name,
        departure_city=favorite_data.departure_city,
        destination_city=favorite_data.destination_city,
        departure_lat=favorite_data.departure_lat,
        departure_lng=favorite_data.departure_lng,
        destination_lat=favorite_data.destination_lat,
        destination_lng=favorite_data.destination_lng,
        departure_time=favorite_data.departure_time,
        available_seats=favorite_data.available_seats,
        price_per_seat=favorite_data.price_per_seat,
        vehicle_brand=favorite_data.vehicle_brand,
        vehicle_color=favorite_data.vehicle_color,
        additional_details=favorite_data.additional_details,
        from_address=from_address_json,
        to_address=to_address_json,
    )
    
    db.add(favorite_ride)
    db.commit()
    db.refresh(favorite_ride)
    
    return FavoriteRideOut.from_orm_with_addresses(favorite_ride)


def get_user_favorite_rides(db: Session, user_id: int) -> List[FavoriteRideOut]:
    """Get all favorite rides for a user"""
    favorite_rides = db.query(FavoriteRide).filter(
        FavoriteRide.user_id == user_id
    ).order_by(FavoriteRide.updated_at.desc()).all()
    
    return [FavoriteRideOut.from_orm_with_addresses(fav) for fav in favorite_rides]


def get_favorite_ride(db: Session, favorite_id: int, user_id: int) -> FavoriteRideOut:
    """Get a specific favorite ride by ID (ensuring it belongs to the user)"""
    favorite_ride = db.query(FavoriteRide).filter(
        FavoriteRide.id == favorite_id,
        FavoriteRide.user_id == user_id
    ).first()
    
    if not favorite_ride:
        return None
    
    return FavoriteRideOut.from_orm_with_addresses(favorite_ride)


def delete_favorite_ride(db: Session, favorite_id: int, user_id: int) -> bool:
    """Delete a favorite ride (ensuring it belongs to the user)"""
    favorite_ride = db.query(FavoriteRide).filter(
        FavoriteRide.id == favorite_id,
        FavoriteRide.user_id == user_id
    ).first()
    
    if not favorite_ride:
        return False
    
    db.delete(favorite_ride)
    db.commit()
    return True

