from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, Header
from sqlalchemy.orm import Session

from app.auth.models import Ride, User, Booking, BookingStatus
from app.auth.router import get_current_user
from app.db.session import get_db
from app.rides import service
from app.rides.schemas import RideCreate, RideOut, RideSearch

router = APIRouter(prefix="/rides", tags=["Rides"])


@router.post("/", response_model=RideOut)
def create_ride(
    ride_data: RideCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new ride"""
    return service.create_ride(db, ride_data, current_user.id)


@router.get("/search", response_model=List[RideOut])
def search_rides(
    departure_city: str = Query(None, description="Filter by departure city"),
    destination_city: str = Query(None, description="Filter by destination city"),
    departure_date: str = Query(None, description="Filter by departure date (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
    authorization: str = Header(None)  # Get authorization header
):
    """Search rides with optional filters. If no filters provided, returns all active rides ordered by departure date."""
    from datetime import datetime
    from jose import JWTError, jwt
    from app.core.config import settings
    
    search_params = RideSearch()
    
    if departure_city:
        search_params.departure_city = departure_city
    if destination_city:
        search_params.destination_city = destination_city
    if departure_date:
        try:
            search_params.departure_date = datetime.fromisoformat(departure_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    # Try to get user ID from authorization header
    user_id = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]  # Remove "Bearer " prefix
        try:
            payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
            user_id = int(payload.get("sub"))
        except (JWTError, ValueError, KeyError):
            pass  # Invalid token, continue as anonymous
    
    return service.search_rides(db, search_params, exclude_booked_by_user_id=user_id)


@router.get("/my-rides", response_model=List[RideOut])
def get_my_rides(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all rides created by the current user"""
    return service.get_user_rides(db, current_user.id)


@router.get("/my-bookings", response_model=List[RideOut])
def get_my_bookings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all bookings made by the current user"""
    from sqlalchemy import and_
    
    # Get all bookings for this user
    bookings = db.query(Booking).filter(
        and_(
            Booking.passenger_id == current_user.id,
            Booking.status != "canceled"
        )
    ).all()
    
    # Get ride details for each booking
    result = []
    for booking in bookings:
        ride = db.query(Ride).filter(Ride.id == booking.ride_id).first()
        if ride:
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


@router.get("/{ride_id}", response_model=RideOut)
def get_ride(
    ride_id: int,
    db: Session = Depends(get_db),
):
    """Get a specific ride by ID"""
    ride = service.get_ride_with_driver_info(db, ride_id)
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    return ride


@router.post("/{ride_id}/book")
def book_ride(
    ride_id: int,
    seats: int = Query(1, ge=1, le=8),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Book a ride (simplified version - just confirms booking)"""
    # Check if ride exists
    ride = db.query(Ride).filter(Ride.id == ride_id, Ride.is_active == True).first()
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    # Check if user is trying to book their own ride
    if ride.driver_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot book your own ride")
    
    # Check if there are enough seats
    if ride.available_seats < seats:
        raise HTTPException(status_code=400, detail="Not enough available seats")
    
    try:
        # Create booking record
        booking = Booking(
            ride_id=ride_id,
            passenger_id=current_user.id,
            status=BookingStatus.confirmed,
            seats=seats,
        )
        db.add(booking)
        
        # Decrease available seats
        ride.available_seats -= seats
        db.commit()
        db.refresh(ride)
        db.refresh(booking)
        
        # For now, just return success message
        return {"message": "Booking confirmed successfully", "ride_id": ride_id, "seats": seats, "available_seats": ride.available_seats}
    except Exception as e:
        db.rollback()
        print(f"Error creating booking: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create booking: {str(e)}")