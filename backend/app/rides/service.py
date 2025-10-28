from datetime import datetime
from typing import List, Optional

from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.auth.models import Ride, User
from app.rides.schemas import RideCreate, RideOut, RideSearch


def create_ride(db: Session, ride_data: RideCreate, driver_id: int) -> RideOut:
    """Create a new ride"""
    ride = Ride(
        driver_id=driver_id,
        departure_city=ride_data.departure_city,
        destination_city=ride_data.destination_city,
        departure_date=ride_data.departure_date,
        departure_time=ride_data.departure_time,
        available_seats=ride_data.available_seats,
        price_per_seat=ride_data.price_per_seat,
        vehicle_info=ride_data.vehicle_info,
        additional_details=ride_data.additional_details,
    )
    
    db.add(ride)
    db.commit()
    db.refresh(ride)
    
    return get_ride_with_driver_info(db, ride.id)


def get_ride_with_driver_info(db: Session, ride_id: int) -> RideOut:
    """Get ride with driver information"""
    ride = db.query(Ride).filter(Ride.id == ride_id).first()
    if not ride:
        return None
    
    driver = db.query(User).filter(User.id == ride.driver_id).first()
    
    return RideOut(
        id=ride.id,
        driver_id=ride.driver_id,
        driver_name=driver.full_name or driver.email,
        driver_university=driver.university,
        departure_city=ride.departure_city,
        destination_city=ride.destination_city,
        departure_date=ride.departure_date,
        departure_time=ride.departure_time,
        available_seats=ride.available_seats,
        price_per_seat=ride.price_per_seat,
        vehicle_info=ride.vehicle_info,
        additional_details=ride.additional_details,
        is_active=ride.is_active,
        created_at=ride.created_at,
    )


def search_rides(db: Session, search_params: RideSearch, exclude_booked_by_user_id: int = None) -> List[RideOut]:
    """Search rides with optional filters"""
    query = db.query(Ride).join(User).filter(Ride.is_active == True, Ride.available_seats > 0)
    
    # Apply filters if provided
    if search_params.departure_city:
        query = query.filter(Ride.departure_city.ilike(f"%{search_params.departure_city}%"))
    
    if search_params.destination_city:
        query = query.filter(Ride.destination_city.ilike(f"%{search_params.destination_city}%"))
    
    if search_params.departure_date:
        # Filter by date (same day)
        start_of_day = search_params.departure_date.replace(hour=0, minute=0, second=0, microsecond=0)
        end_of_day = start_of_day.replace(hour=23, minute=59, second=59, microsecond=999999)
        query = query.filter(
            and_(
                Ride.departure_date >= start_of_day,
                Ride.departure_date <= end_of_day
            )
        )
    
    # Order by departure date (soonest first)
    rides = query.order_by(Ride.departure_date.asc(), Ride.departure_time.asc()).all()
    
    # If user ID is provided, filter out rides they've already booked
    if exclude_booked_by_user_id:
        from app.auth.models import Booking
        booked_ride_ids = {b.ride_id for b in db.query(Booking).filter(Booking.passenger_id == exclude_booked_by_user_id, Booking.status != "canceled").all()}
        rides = [r for r in rides if r.id not in booked_ride_ids]
    
    # Convert to RideOut with driver info
    result = []
    for ride in rides:
        driver = db.query(User).filter(User.id == ride.driver_id).first()
        result.append(RideOut(
            id=ride.id,
            driver_id=ride.driver_id,
            driver_name=driver.full_name or driver.email,
            driver_university=driver.university,
            departure_city=ride.departure_city,
            destination_city=ride.destination_city,
            departure_date=ride.departure_date,
            departure_time=ride.departure_time,
            available_seats=ride.available_seats,
            price_per_seat=ride.price_per_seat,
            vehicle_info=ride.vehicle_info,
            additional_details=ride.additional_details,
            is_active=ride.is_active,
            created_at=ride.created_at,
        ))
    
    return result


def get_user_rides(db: Session, user_id: int) -> List[RideOut]:
    """Get all rides created by a user"""
    try:
        rides = db.query(Ride).filter(
            and_(Ride.driver_id == user_id, Ride.is_active == True)
        ).order_by(Ride.departure_date.desc()).all()
        
        result = []
        for ride in rides:
            driver = db.query(User).filter(User.id == ride.driver_id).first()
            try:
                result.append(RideOut(
                    id=ride.id,
                    driver_id=ride.driver_id,
                    driver_name=driver.full_name or driver.email,
                    driver_university=driver.university,
                    departure_city=ride.departure_city,
                    destination_city=ride.destination_city,
                    departure_date=ride.departure_date,
                    departure_time=ride.departure_time,
                    available_seats=ride.available_seats,
                    price_per_seat=ride.price_per_seat,
                    vehicle_info=ride.vehicle_info,
                    additional_details=ride.additional_details,
                    is_active=ride.is_active,
                    created_at=ride.created_at,
                ))
            except Exception as e:
                print(f"Error creating RideOut for ride {ride.id}: {e}")
                # Skip rides with validation errors for now
                continue
        
        return result
    except Exception as e:
        print(f"Error in get_user_rides: {e}")
        return []
