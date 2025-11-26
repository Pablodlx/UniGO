from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from app.auth.models import Rating, Booking, Ride, User, BookingStatus, Notification


def create_rating(
    db: Session,
    booking_id: int,
    rater_id: int,
    rating: int,
    comment: Optional[str] = None
) -> Rating:
    """
    Create a rating for a completed booking.
    Validates that:
    - Booking exists and is confirmed
    - Ride has passed (departure date/time is in the past)
    - User was part of the booking (either driver or passenger)
    - Rating doesn't already exist for this booking by this rater
    """
    # Check if booking exists
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found"
        )
    
    # Check if booking is confirmed
    if booking.status != BookingStatus.confirmed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only rate confirmed bookings"
        )
    
    # Get the ride
    ride = db.query(Ride).filter(Ride.id == booking.ride_id).first()
    if not ride:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ride not found"
        )
    
    # Check if ride has passed (use arrival time if available, otherwise departure time)
    # Use the same timezone logic as the rides service (Spain timezone)
    from app.rides.service import get_ride_check_datetime
    
    ride_completion_datetime = get_ride_check_datetime(ride)
    
    now = datetime.now(timezone.utc)
    if ride_completion_datetime >= now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only rate rides that have already occurred"
        )
    
    # Check if rating is within 7 days after ride completion
    days_since_ride = (now - ride_completion_datetime).days
    if days_since_ride > 7:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Rating is only available for 7 days after the ride is finished"
        )
    
    # Determine who should be rated
    # If rater is the driver, they're rating the passenger
    # If rater is the passenger, they're rating the driver
    if rater_id == ride.driver_id:
        rated_id = booking.passenger_id
    elif rater_id == booking.passenger_id:
        rated_id = ride.driver_id
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only rate bookings you participated in"
        )
    
    # Check if rating already exists
    existing_rating = db.query(Rating).filter(
        and_(
            Rating.booking_id == booking_id,
            Rating.rater_id == rater_id
        )
    ).first()
    
    if existing_rating:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already rated this booking"
        )
    
    # Create the rating
    new_rating = Rating(
        booking_id=booking_id,
        rater_id=rater_id,
        rated_id=rated_id,
        rating=rating,
        comment=comment
    )
    
    db.add(new_rating)
    
    # Create notification for the rated user
    rater_user = db.query(User).filter(User.id == rater_id).first()
    rater_name = rater_user.full_name or rater_user.email if rater_user else "Un usuario"
    
    notification = Notification(
        receiver_id=rated_id,
        type="new_rating",
        ride_id=ride.id,
        message=f"{rater_name} te ha dejado una valoración en el viaje {ride.departure_city} → {ride.destination_city}.",
    )
    db.add(notification)
    
    db.commit()
    db.refresh(new_rating)
    db.refresh(notification)
    
    return new_rating


def get_user_ratings(db: Session, user_id: int) -> list[Rating]:
    """Get all ratings received by a user"""
    return db.query(Rating).filter(Rating.rated_id == user_id).all()


def get_user_average_rating(db: Session, user_id: int) -> Optional[float]:
    """Calculate and return the average rating for a user"""
    try:
        result = db.query(func.avg(Rating.rating)).filter(
            Rating.rated_id == user_id
        ).scalar()
        
        if result is None:
            return None
        
        # Round to 1 decimal place
        return round(float(result), 1)
    except Exception as e:
        # If ratings table doesn't exist or any other error, return None
        print(f"Error getting average rating: {e}")
        return None


def get_rating_count(db: Session, user_id: int) -> int:
    """Get the total number of ratings received by a user"""
    try:
        return db.query(Rating).filter(Rating.rated_id == user_id).count()
    except Exception as e:
        # If ratings table doesn't exist or any other error, return 0
        print(f"Error getting rating count: {e}")
        return 0


def get_booking_rating(db: Session, booking_id: int, user_id: int) -> Optional[Rating]:
    """Check if a user has already rated a specific booking"""
    return db.query(Rating).filter(
        and_(
            Rating.booking_id == booking_id,
            Rating.rater_id == user_id
        )
    ).first()


def create_rating_by_ride(
    db: Session,
    ride_id: int,
    rater_id: int,
    rated_id: int,
    score: int,
    comment: Optional[str] = None
) -> Rating:
    """
    Create a rating using ride_id instead of booking_id.
    Finds the appropriate booking based on ride_id and users involved.
    """
    # Get the ride
    ride = db.query(Ride).filter(Ride.id == ride_id).first()
    if not ride:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ride not found"
        )
    
    # Verify ride is completed
    from app.rides.service import get_ride_check_datetime
    ride_completion_datetime = get_ride_check_datetime(ride)
    now = datetime.now(timezone.utc)
    if ride_completion_datetime >= now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only rate rides that have already occurred"
        )
    
    # Find the booking that connects rater and rated for this ride
    # If rater is driver, find booking where passenger is rated_id
    # If rater is passenger, find booking where passenger is rater_id and driver is rated_id
    booking = None
    if rater_id == ride.driver_id:
        # Driver rating passenger
        booking = db.query(Booking).filter(
            and_(
                Booking.ride_id == ride_id,
                Booking.passenger_id == rated_id,
                Booking.status == BookingStatus.confirmed
            )
        ).first()
    else:
        # Passenger rating driver
        booking = db.query(Booking).filter(
            and_(
                Booking.ride_id == ride_id,
                Booking.passenger_id == rater_id,
                Booking.status == BookingStatus.confirmed
            )
        ).first()
        # Verify the driver matches rated_id
        if booking and ride.driver_id != rated_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid rated_id for this ride"
            )
    
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No confirmed booking found for this ride and users"
        )
    
    # Check if rating already exists
    existing_rating = db.query(Rating).filter(
        and_(
            Rating.booking_id == booking.id,
            Rating.rater_id == rater_id
        )
    ).first()
    
    if existing_rating:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already rated this ride"
        )
    
    # Create the rating
    new_rating = Rating(
        booking_id=booking.id,
        rater_id=rater_id,
        rated_id=rated_id,
        rating=score,
        comment=comment
    )
    
    db.add(new_rating)
    db.commit()
    db.refresh(new_rating)
    
    return new_rating


def has_rated(db: Session, ride_id: int, rater_id: int, rated_id: int) -> bool:
    """
    Check if a user has already rated another user for a specific ride.
    """
    # Get the ride
    ride = db.query(Ride).filter(Ride.id == ride_id).first()
    if not ride:
        return False
    
    # Find the booking
    booking = None
    if rater_id == ride.driver_id:
        # Driver rating passenger
        booking = db.query(Booking).filter(
            and_(
                Booking.ride_id == ride_id,
                Booking.passenger_id == rated_id,
                Booking.status == BookingStatus.confirmed
            )
        ).first()
    else:
        # Passenger rating driver
        booking = db.query(Booking).filter(
            and_(
                Booking.ride_id == ride_id,
                Booking.passenger_id == rater_id,
                Booking.status == BookingStatus.confirmed
            )
        ).first()
    
    if not booking:
        return False
    
    # Check if rating exists
    existing_rating = db.query(Rating).filter(
        and_(
            Rating.booking_id == booking.id,
            Rating.rater_id == rater_id
        )
    ).first()
    
    return existing_rating is not None

