from datetime import datetime, timedelta, time as dt_time, timezone
from typing import List, Optional

import pytz
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.auth.models import Ride, User, Booking, BookingStatus
from app.rides.schemas import RideCreate, RideOut, RideSearch, PassengerInfo
from app.core.maps import calculate_travel_time_sync
# Import ratings service defensively to avoid breaking if ratings module has issues
try:
    from app.ratings import service as ratings_service
except ImportError:
    # If ratings module doesn't exist or has import errors, create a dummy service
    ratings_service = None


def _get_ride_passengers(db: Session, ride_id: int) -> tuple[List[PassengerInfo], List[int]]:
    """Helper function to get all confirmed passengers for a ride"""
    bookings = db.query(Booking).filter(
        Booking.ride_id == ride_id,
        Booking.status == BookingStatus.confirmed
    ).all()
    
    passengers_info = []
    passengers_ids = []
    
    for booking in bookings:
        passenger_user = db.query(User).filter(User.id == booking.passenger_id).first()
        if passenger_user:
            passengers_info.append(PassengerInfo(
                id=passenger_user.id,
                name=passenger_user.full_name or passenger_user.email,
                avatar_url=passenger_user.avatar_url
            ))
            passengers_ids.append(passenger_user.id)
    
    return passengers_info, passengers_ids


def get_ride_check_datetime(ride: Ride) -> datetime:
    """
    Get the datetime to check if a ride has passed.
    Uses arrival datetime if available, otherwise uses departure datetime.
    Always returns a timezone-aware UTC datetime.
    
    IMPORTANT: The departure_time string (e.g., "19:01") is interpreted as being in
    Europe/Madrid timezone (Spain), then converted to UTC for comparison.
    This assumes the user enters times in their local Spanish timezone.
    """
    arrival_datetime = calculate_arrival_datetime(ride)
    
    if arrival_datetime is not None:
        return arrival_datetime
    
    # Fall back to departure datetime
    time_parts = ride.departure_time.split(':')
    hour = int(time_parts[0])
    minute = int(time_parts[1]) if len(time_parts) > 1 else 0
    
    # Get the date part - if it has timezone, use it; otherwise assume it's a date only
    if ride.departure_date.tzinfo is not None:
        # departure_date is timezone-aware, use its timezone
        departure_date_only = ride.departure_date.date()
    else:
        # departure_date is naive, get just the date part
        departure_date_only = ride.departure_date.date() if hasattr(ride.departure_date, 'date') else ride.departure_date
    
    # Assume the time entered by user is in Spain timezone (Europe/Madrid)
    # Create datetime in Spain timezone, then convert to UTC
    spain_tz = pytz.timezone('Europe/Madrid')
    
    # Create naive datetime with date and time
    naive_datetime = datetime.combine(departure_date_only, dt_time(hour=hour, minute=minute))
    
    # Localize to Spain timezone, then convert to UTC
    spain_datetime = spain_tz.localize(naive_datetime)
    check_datetime = spain_datetime.astimezone(timezone.utc)
    
    return check_datetime


def calculate_arrival_datetime(ride: Ride) -> Optional[datetime]:
    """
    Calculate the arrival datetime for a ride based on departure time and estimated duration.
    Returns None if duration is not available.
    
    IMPORTANT: The departure_time string (e.g., "18:55") is interpreted as being in
    Europe/Madrid timezone (Spain), then converted to UTC.
    This assumes the user enters times in their local Spanish timezone.
    """
    if ride.estimated_duration_minutes is None:
        return None
    
    # Combine departure_date and departure_time to get full datetime
    time_parts = ride.departure_time.split(':')
    hour = int(time_parts[0])
    minute = int(time_parts[1]) if len(time_parts) > 1 else 0
    
    # Get the date part
    if ride.departure_date.tzinfo is not None:
        departure_date_only = ride.departure_date.date()
    else:
        departure_date_only = ride.departure_date.date() if hasattr(ride.departure_date, 'date') else ride.departure_date
    
    # Assume the time entered by user is in Spain timezone (Europe/Madrid)
    # Create datetime in Spain timezone, then convert to UTC
    spain_tz = pytz.timezone('Europe/Madrid')
    
    # Create naive datetime with date and time
    naive_datetime = datetime.combine(departure_date_only, dt_time(hour=hour, minute=minute))
    
    # Localize to Spain timezone, then convert to UTC
    spain_datetime = spain_tz.localize(naive_datetime)
    departure_datetime = spain_datetime.astimezone(timezone.utc)
    
    # Add estimated duration
    arrival_datetime = departure_datetime + timedelta(minutes=ride.estimated_duration_minutes)
    return arrival_datetime


def calculate_arrival_time_string(ride: Ride) -> Optional[str]:
    """
    Calculate the arrival time as a string in "HH:MM" format.
    Returns None if duration is not available.
    
    IMPORTANT: The arrival time is returned in Spain timezone (Europe/Madrid)
    to match what the user expects to see (same timezone as departure time).
    """
    arrival_datetime_utc = calculate_arrival_datetime(ride)
    if arrival_datetime_utc is None:
        return None
    
    # Convert UTC arrival time back to Spain timezone for display
    spain_tz = pytz.timezone('Europe/Madrid')
    arrival_datetime_spain = arrival_datetime_utc.astimezone(spain_tz)
    
    # Format as HH:MM in Spain timezone
    return arrival_datetime_spain.strftime("%H:%M")


def create_ride(db: Session, ride_data: RideCreate, driver_id: int) -> RideOut:
    """Create a new ride"""
    # Extract coordinates from ride_data
    # Priority: direct fields > from_/to objects
    departure_lat = ride_data.departure_lat
    departure_lng = ride_data.departure_lng
    destination_lat = ride_data.destination_lat
    destination_lng = ride_data.destination_lng
    
    # If coordinates not provided directly, try to get from 'from' and 'to' objects
    if departure_lat is None and ride_data.from_:
        departure_lat = ride_data.from_.lat
        departure_lng = ride_data.from_.lng
    
    if destination_lat is None and ride_data.to:
        destination_lat = ride_data.to.lat
        destination_lng = ride_data.to.lng
    
    # Calculate estimated travel time if we have coordinates
    estimated_duration_minutes = None
    if departure_lat is not None and departure_lng is not None and \
       destination_lat is not None and destination_lng is not None:
        print(f"Calculating travel time from ({departure_lat}, {departure_lng}) to ({destination_lat}, {destination_lng})")
        estimated_duration_minutes = calculate_travel_time_sync(
            origin_lat=departure_lat,
            origin_lng=departure_lng,
            destination_lat=destination_lat,
            destination_lng=destination_lng
        )
        print(f"Estimated duration: {estimated_duration_minutes} minutes")
    else:
        print(f"Missing coordinates - lat: {departure_lat}, lng: {departure_lng}, dest_lat: {destination_lat}, dest_lng: {destination_lng}")
    
    # Ensure departure_date is timezone-aware UTC
    # If frontend sends date without timezone, assume it's meant to be in UTC
    # (or you can adjust this to use a specific timezone like Europe/Madrid)
    departure_date = ride_data.departure_date
    from datetime import timezone as tz
    if departure_date.tzinfo is None:
        # Naive datetime - assume it's UTC
        departure_date = departure_date.replace(tzinfo=tz.utc)
    else:
        # Already timezone-aware - convert to UTC for storage
        departure_date = departure_date.astimezone(tz.utc)
    
    ride = Ride(
        driver_id=driver_id,
        departure_city=ride_data.departure_city,
        destination_city=ride_data.destination_city,
        departure_lat=departure_lat,
        departure_lng=departure_lng,
        destination_lat=destination_lat,
        destination_lng=destination_lng,
        estimated_duration_minutes=estimated_duration_minutes,
        departure_date=departure_date,
        departure_time=ride_data.departure_time,
        available_seats=ride_data.available_seats,
        price_per_seat=ride_data.price_per_seat,
        vehicle_brand=ride_data.vehicle_brand,
        vehicle_color=ride_data.vehicle_color,
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
    if not driver:
        raise ValueError(f"Driver not found for ride {ride_id}")
    
    # Get driver's average rating (gracefully handle if ratings table doesn't exist)
    driver_average_rating = None
    if ratings_service:
        try:
            driver_average_rating = ratings_service.get_user_average_rating(db, driver.id)
        except Exception:
            driver_average_rating = None
    
    # Get first confirmed booking's passenger_id for reserved_by_user_id
    reserved_by_user_id = None
    first_booking = db.query(Booking).filter(
        Booking.ride_id == ride_id,
        Booking.status == BookingStatus.confirmed
    ).first()
    if first_booking:
        reserved_by_user_id = first_booking.passenger_id
    
    # Get all confirmed passengers for this ride
    passengers_info, passengers_ids = _get_ride_passengers(db, ride_id)
    
    arrival_time = calculate_arrival_time_string(ride)
    
    return RideOut(
        id=ride.id,
        driver_id=ride.driver_id,
        driver_name=driver.full_name or driver.email,
        driver_university=driver.university,
        departure_city=ride.departure_city,
        destination_city=ride.destination_city,
        departure_lat=ride.departure_lat,
        departure_lng=ride.departure_lng,
        destination_lat=ride.destination_lat,
        destination_lng=ride.destination_lng,
        departure_date=ride.departure_date,
        departure_time=ride.departure_time,
        available_seats=ride.available_seats,
        price_per_seat=ride.price_per_seat,
        vehicle_brand=ride.vehicle_brand,
        vehicle_color=ride.vehicle_color,
        additional_details=ride.additional_details,
        estimated_duration_minutes=ride.estimated_duration_minutes,
        arrival_time=arrival_time,
        is_active=ride.is_active,
        created_at=ride.created_at,
        driver_average_rating=driver_average_rating,
        reserved_by_user_id=reserved_by_user_id,
        passengers=passengers_info,
        passengers_ids=passengers_ids,
    )


def search_rides(db: Session, search_params: RideSearch, exclude_booked_by_user_id: int = None) -> List[RideOut]:
    """Search rides with optional filters"""
    from datetime import timezone
    
    query = db.query(Ride).join(User).filter(Ride.is_active == True, Ride.available_seats > 0)
    
    # Apply filters if provided
    if search_params.departure_city:
        query = query.filter(Ride.departure_city.ilike(f"%{search_params.departure_city}%"))
    
    if search_params.destination_city:
        query = query.filter(Ride.destination_city.ilike(f"%{search_params.destination_city}%"))
    
    if search_params.departure_date:
        # Filter by date - show rides on or after the search date
        # Normalize search date to start of day for comparison
        search_date_start = search_params.departure_date.replace(hour=0, minute=0, second=0, microsecond=0)
        # Ensure timezone awareness
        if search_date_start.tzinfo is None:
            search_date_start = search_date_start.replace(tzinfo=timezone.utc)
        query = query.filter(Ride.departure_date >= search_date_start)
    else:
        # If no date provided, filter out past rides by comparing with today
        now = datetime.now(timezone.utc)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        query = query.filter(Ride.departure_date >= today_start)
    
    # Order by departure date (soonest first)
    rides = query.order_by(Ride.departure_date.asc(), Ride.departure_time.asc()).all()
    
    # If user ID is provided, filter out rides they've already booked
    if exclude_booked_by_user_id:
        from app.auth.models import Booking
        booked_ride_ids = {b.ride_id for b in db.query(Booking).filter(Booking.passenger_id == exclude_booked_by_user_id, Booking.status != "canceled").all()}
        rides = [r for r in rides if r.id not in booked_ride_ids]
    
    # Convert to RideOut with driver info
    from app.auth.models import Booking, BookingStatus
    
    result = []
    for ride in rides:
        driver = db.query(User).filter(User.id == ride.driver_id).first()
        # Get driver's average rating (gracefully handle if ratings table doesn't exist)
        driver_average_rating = None
        if ratings_service:
            try:
                driver_average_rating = ratings_service.get_user_average_rating(db, driver.id)
            except Exception:
                driver_average_rating = None
        
        # Get first confirmed booking's passenger_id for reserved_by_user_id
        reserved_by_user_id = None
        first_booking = db.query(Booking).filter(
            Booking.ride_id == ride.id,
            Booking.status == BookingStatus.confirmed
        ).first()
        if first_booking:
            reserved_by_user_id = first_booking.passenger_id
        
        # Get all confirmed passengers for this ride
        passengers_info, passengers_ids = _get_ride_passengers(db, ride.id)
        
        arrival_time = calculate_arrival_time_string(ride)
        
        result.append(RideOut(
            id=ride.id,
            driver_id=ride.driver_id,
            driver_name=driver.full_name or driver.email,
            driver_university=driver.university,
            departure_city=ride.departure_city,
            destination_city=ride.destination_city,
            departure_lat=ride.departure_lat,
            departure_lng=ride.departure_lng,
            destination_lat=ride.destination_lat,
            destination_lng=ride.destination_lng,
            departure_date=ride.departure_date,
            departure_time=ride.departure_time,
            available_seats=ride.available_seats,
            price_per_seat=ride.price_per_seat,
            vehicle_brand=ride.vehicle_brand,
            vehicle_color=ride.vehicle_color,
            additional_details=ride.additional_details,
            estimated_duration_minutes=ride.estimated_duration_minutes,
            arrival_time=arrival_time,
            is_active=ride.is_active,
            created_at=ride.created_at,
            driver_average_rating=driver_average_rating,
            reserved_by_user_id=reserved_by_user_id,
            passengers=passengers_info,
            passengers_ids=passengers_ids,
        ))
    
    return result


def get_user_rides(db: Session, user_id: int) -> List[RideOut]:
    """Get all rides created by a user (excluding rides in registro - past or cancelled)"""
    from datetime import timezone
    
    try:
        rides = db.query(Ride).filter(
            and_(Ride.driver_id == user_id, Ride.is_active == True)
        ).order_by(Ride.departure_date.desc()).all()
        
        now = datetime.now(timezone.utc)
        result = []
        for ride in rides:
            try:
                # Get the datetime to check if ride has passed (arrival time if available, else departure)
                check_datetime = get_ride_check_datetime(ride)
                
                # Debug: Log the comparison for troubleshooting
                # print(f"Ride {ride.id}: check_datetime={check_datetime} (UTC), now={now} (UTC), passed={check_datetime < now}")
                
                # Exclude rides that are in registro (past or cancelled)
                # Only include active rides that haven't passed yet (based on arrival time)
                if check_datetime >= now:
                    driver = db.query(User).filter(User.id == ride.driver_id).first()
                    if not driver:
                        continue
                        
                    # Get driver's average rating (gracefully handle if ratings table doesn't exist)
                    driver_average_rating = None
                    if ratings_service:
                        try:
                            driver_average_rating = ratings_service.get_user_average_rating(db, driver.id)
                        except Exception as e:
                            print(f"Warning: Could not get rating for driver {driver.id}: {e}")
                            driver_average_rating = None
                    
                    arrival_time = calculate_arrival_time_string(ride)
                    
                    # Get first confirmed booking's passenger_id for reserved_by_user_id
                    reserved_by_user_id = None
                    first_booking = db.query(Booking).filter(
                        Booking.ride_id == ride.id,
                        Booking.status == BookingStatus.confirmed
                    ).first()
                    if first_booking:
                        reserved_by_user_id = first_booking.passenger_id
                    
                    # Get all confirmed passengers for this ride
                    passengers_info, passengers_ids = _get_ride_passengers(db, ride.id)
                    
                    result.append(RideOut(
                        id=ride.id,
                        driver_id=ride.driver_id,
                        driver_name=driver.full_name or driver.email,
                        driver_university=driver.university,
                        departure_city=ride.departure_city,
                        destination_city=ride.destination_city,
                        departure_lat=ride.departure_lat,
                        departure_lng=ride.departure_lng,
                        destination_lat=ride.destination_lat,
                        destination_lng=ride.destination_lng,
                        departure_date=ride.departure_date,
                        departure_time=ride.departure_time,
                        available_seats=ride.available_seats,
                        price_per_seat=ride.price_per_seat,
                        vehicle_brand=ride.vehicle_brand,
                        vehicle_color=ride.vehicle_color,
                        additional_details=ride.additional_details,
                        estimated_duration_minutes=ride.estimated_duration_minutes,
                        arrival_time=arrival_time,
                        is_active=ride.is_active,
                        created_at=ride.created_at,
                        driver_average_rating=driver_average_rating,
                        reserved_by_user_id=reserved_by_user_id,
                        passengers=passengers_info,
                        passengers_ids=passengers_ids,
                    ))
            except Exception as e:
                print(f"Error processing ride {ride.id}: {e}")
                import traceback
                traceback.print_exc()
                continue
        
        return result
    except Exception as e:
        print(f"Error in get_user_rides: {e}")
        import traceback
        traceback.print_exc()
        return []
