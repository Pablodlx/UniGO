from datetime import datetime, timedelta, time as dt_time, timezone
from typing import List, Optional

import pytz
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.auth.models import Ride, User, Booking, BookingStatus, SearchAlert
from app.rides.schemas import RideCreate, RideOut, RideSearch, PassengerInfo
from app.core.maps import calculate_travel_time_sync
from app.notifications.utils import create_notification
# Import ratings service defensively to avoid breaking if ratings module has issues
try:
    from app.ratings import service as ratings_service
except ImportError:
    # If ratings module doesn't exist or has import errors, create a dummy service
    ratings_service = None


def _get_driver_trip_stats(db: Session, driver_id: int) -> tuple[int, int]:
    """Helper function to calculate driver's completed trip statistics"""
    from datetime import datetime, timezone
    
    now = datetime.now(timezone.utc)
    completed_driver_trips = db.query(Ride).filter(
        Ride.driver_id == driver_id,
        Ride.is_active == True,
        Ride.departure_date < now
    ).count()
    
    completed_passenger_trips = db.query(Booking).join(Ride).filter(
        Booking.passenger_id == driver_id,
        Booking.status == BookingStatus.confirmed,
        Ride.departure_date < now
    ).count()
    
    return completed_driver_trips, completed_passenger_trips


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
    
    # Ensure available_seats is correctly parsed as int
    available_seats_value = int(ride_data.available_seats) if ride_data.available_seats is not None else 1
    
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
        available_seats=available_seats_value,
        price_per_seat=ride_data.price_per_seat,
        vehicle_brand=ride_data.vehicle_brand,
        vehicle_color=ride_data.vehicle_color,
        additional_details=ride_data.additional_details,
    )
    
    db.add(ride)
    db.commit()
    db.refresh(ride)
    
    # Match search alerts with the new ride
    try:
        match_search_alerts_with_trip(db, ride)
    except Exception as e:
        # Log error but don't fail ride creation
        print(f"Error matching search alerts with trip {ride.id}: {e}")
        import traceback
        print(traceback.format_exc())
    
    return get_ride_with_driver_info(db, ride.id)


def get_ride_with_driver_info(db: Session, ride_id: int) -> RideOut:
    """Get ride with driver information"""
    from datetime import datetime, timezone
    
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
    
    # Calculate driver's completed trips statistics
    driver_completed_trips, driver_completed_passenger_trips = _get_driver_trip_stats(db, driver.id)
    
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
        driver_avatar_url=driver.avatar_url,
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
        driver_completed_trips=driver_completed_trips,
        driver_completed_passenger_trips=driver_completed_passenger_trips,
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
        
        # Calculate driver's completed trips statistics
        driver_completed_trips, driver_completed_passenger_trips = _get_driver_trip_stats(db, driver.id)
        
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
            driver_avatar_url=driver.avatar_url,
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
            driver_completed_trips=driver_completed_trips,
            driver_completed_passenger_trips=driver_completed_passenger_trips,
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
                    
                    # Calculate driver's completed trips statistics
                    driver_completed_trips, driver_completed_passenger_trips = _get_driver_trip_stats(db, driver.id)
                    
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
                        driver_avatar_url=driver.avatar_url,
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
                        driver_completed_trips=driver_completed_trips,
                        driver_completed_passenger_trips=driver_completed_passenger_trips,
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


def match_search_alerts_with_trip(db: Session, trip: Ride) -> None:
    """
    Match active search alerts with a newly created trip and automatically:
    1. Create pending bookings for matching users
    2. Send notifications to those users
    
    Args:
        db: Database session
        trip: The newly created Ride object
    """
    # Get day of week from trip departure_date (0=Monday, 6=Sunday)
    trip_day_of_week = trip.departure_date.weekday()
    
    # Parse trip departure_time (format: "HH:MM")
    try:
        trip_time_parts = trip.departure_time.split(":")
        trip_hour = int(trip_time_parts[0])
        trip_minute = int(trip_time_parts[1])
        trip_time_minutes = trip_hour * 60 + trip_minute
    except (ValueError, IndexError):
        print(f"Invalid trip departure_time format: {trip.departure_time}")
        return
    
    # Get trip date (without time)
    trip_date = trip.departure_date.date()
    
    # Find all active search alerts that match:
    # 1. Destination matches (case-insensitive, partial match)
    # 2. Origin matches (case-insensitive, partial match) - optional
    # 3. Date matches (specific_dates has priority over days_of_week)
    # 4. Time is within flexibility range
    from sqlalchemy import func, text
    
    # Query alerts that match destination
    all_alerts = db.query(SearchAlert).filter(
        SearchAlert.active == True,
        SearchAlert.destination.ilike(f"%{trip.destination_city}%"),
    ).all()
    
    # Filter in Python to check date matching (specific_dates has priority)
    matching_alerts = []
    for alert in all_alerts:
        date_matches = False
        
        # CASE 1: Alert uses specific_dates (PRIORITY)
        if alert.specific_dates and len(alert.specific_dates) > 0:
            date_matches = trip_date in alert.specific_dates
        # CASE 2: Alert uses days_of_week (only if no specific_dates)
        elif alert.days_of_week and len(alert.days_of_week) > 0:
            date_matches = trip_day_of_week in alert.days_of_week
        else:
            # No date criteria, skip
            continue
        
        # Alert matches if date matches
        if date_matches:
            matching_alerts.append(alert)
    
    print(f"Found {len(matching_alerts)} active search alerts for destination '{trip.destination_city}' on date {trip_date} (day {trip_day_of_week})")
    
    for alert in matching_alerts:
        # Skip if origin doesn't match (optional check)
        if alert.origin and not trip.departure_city.lower() in alert.origin.lower() and not alert.origin.lower() in trip.departure_city.lower():
            continue
        
        # Parse alert target_time (format: "HH:MM")
        try:
            alert_time_parts = alert.target_time.split(":")
            alert_hour = int(alert_time_parts[0])
            alert_minute = int(alert_time_parts[1])
            alert_time_minutes = alert_hour * 60 + alert_minute
        except (ValueError, IndexError):
            print(f"Invalid alert target_time format: {alert.target_time}")
            continue
        
        # Check if trip time is within flexibility range
        time_diff = abs(trip_time_minutes - alert_time_minutes)
        if time_diff > alert.flexibility_minutes:
            continue
        
        # Skip if user is the driver (can't book their own ride)
        if alert.user_id == trip.driver_id:
            continue
        
        # Check if user already has a booking for this ride
        existing_booking = db.query(Booking).filter(
            Booking.ride_id == trip.id,
            Booking.passenger_id == alert.user_id,
            Booking.status.in_([BookingStatus.pending, BookingStatus.confirmed])
        ).first()
        
        if existing_booking:
            print(f"User {alert.user_id} already has a booking for ride {trip.id}")
            continue
        
        # Check if there are available seats
        if trip.available_seats <= 0:
            print(f"No available seats in ride {trip.id}")
            continue
        
        try:
            # Create automatic booking in pending status
            auto_booking = Booking(
                ride_id=trip.id,
                passenger_id=alert.user_id,
                status=BookingStatus.pending,
                seats=1,  # Default to 1 seat for auto-bookings
            )
            db.add(auto_booking)
            
            # Create notification
            notification = create_notification(
                db=db,
                receiver_id=alert.user_id,
                type="auto_trip_match",
                message="¡Hemos encontrado un viaje para ti! Se ha encontrado un viaje que coincide con tu búsqueda automática.",
                ride_id=trip.id,
            )
            
            db.commit()
            print(f"Created auto-booking and notification for user {alert.user_id} on ride {trip.id}")
            
        except Exception as e:
            db.rollback()
            print(f"Error creating auto-booking for user {alert.user_id} on ride {trip.id}: {e}")
            import traceback
            traceback.print_exc()
            continue


def match_existing_trips_with_alert(db: Session, alert: SearchAlert) -> None:
    """
    Match a newly created search alert with existing trips and automatically:
    1. Create pending bookings for matching trips
    2. Send notifications to the alert owner
    
    Args:
        db: Database session
        alert: The newly created SearchAlert object
    """
    from datetime import datetime, timezone, date as date_type
    
    # Parse alert target_time (format: "HH:MM")
    try:
        alert_time_parts = alert.target_time.split(":")
        alert_hour = int(alert_time_parts[0])
        alert_minute = int(alert_time_parts[1])
        alert_time_minutes = alert_hour * 60 + alert_minute
    except (ValueError, IndexError):
        print(f"Invalid alert target_time format: {alert.target_time}")
        return
    
    # Get current date to filter out past trips
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Find all active trips that match:
    # 1. Destination matches (case-insensitive, partial match)
    # 2. Origin matches (case-insensitive, partial match) - optional
    # 3. Date matches (specific_dates has priority over days_of_week)
    # 4. Time is within flexibility range
    # 5. Trip is in the future
    all_trips = db.query(Ride).filter(
        Ride.is_active == True,
        Ride.available_seats > 0,
        Ride.departure_date >= today_start,  # Only future trips
        Ride.destination_city.ilike(f"%{alert.destination}%"),
    ).all()
    
    # Filter trips that match the alert criteria
    matching_trips = []
    for trip in all_trips:
        # Skip if origin doesn't match (optional check)
        if alert.origin and not trip.departure_city.lower() in alert.origin.lower() and not alert.origin.lower() in trip.departure_city.lower():
            continue
        
        # Check date matching
        trip_date = trip.departure_date.date()
        trip_day_of_week = trip.departure_date.weekday()
        date_matches = False
        
        # CASE 1: Alert uses specific_dates (PRIORITY)
        if alert.specific_dates and len(alert.specific_dates) > 0:
            date_matches = trip_date in alert.specific_dates
        # CASE 2: Alert uses days_of_week (only if no specific_dates)
        elif alert.days_of_week and len(alert.days_of_week) > 0:
            date_matches = trip_day_of_week in alert.days_of_week
        else:
            # No date criteria, skip
            continue
        
        if not date_matches:
            continue
        
        # Parse trip departure_time (format: "HH:MM")
        try:
            trip_time_parts = trip.departure_time.split(":")
            trip_hour = int(trip_time_parts[0])
            trip_minute = int(trip_time_parts[1])
            trip_time_minutes = trip_hour * 60 + trip_minute
        except (ValueError, IndexError):
            print(f"Invalid trip departure_time format: {trip.departure_time}")
            continue
        
        # Check if trip time is within flexibility range
        time_diff = abs(trip_time_minutes - alert_time_minutes)
        if time_diff > alert.flexibility_minutes:
            continue
        
        # Trip matches all criteria
        matching_trips.append(trip)
    
    print(f"Found {len(matching_trips)} existing trips matching alert {alert.id} for destination '{alert.destination}'")
    
    # Create bookings and notifications for matching trips
    for trip in matching_trips:
        # Skip if user is the driver (can't book their own ride)
        if alert.user_id == trip.driver_id:
            continue
        
        # Check if user already has a booking for this ride
        existing_booking = db.query(Booking).filter(
            Booking.ride_id == trip.id,
            Booking.passenger_id == alert.user_id,
            Booking.status.in_([BookingStatus.pending, BookingStatus.confirmed])
        ).first()
        
        if existing_booking:
            print(f"User {alert.user_id} already has a booking for ride {trip.id}")
            continue
        
        # Check if there are available seats
        if trip.available_seats <= 0:
            print(f"No available seats in ride {trip.id}")
            continue
        
        try:
            # Create automatic booking in pending status
            auto_booking = Booking(
                ride_id=trip.id,
                passenger_id=alert.user_id,
                status=BookingStatus.pending,
                seats=1,  # Default to 1 seat for auto-bookings
            )
            db.add(auto_booking)
            
            # Create notification
            notification = create_notification(
                db=db,
                receiver_id=alert.user_id,
                type="auto_trip_match",
                message="¡Hemos encontrado un viaje para ti! Se ha encontrado un viaje que coincide con tu búsqueda automática.",
                ride_id=trip.id,
            )
            
            db.commit()
            print(f"Created auto-booking and notification for user {alert.user_id} on existing ride {trip.id}")
            
        except Exception as e:
            db.rollback()
            print(f"Error creating auto-booking for user {alert.user_id} on existing ride {trip.id}: {e}")
            import traceback
            traceback.print_exc()
            continue


def match_trips_for_specific_dates(
    db: Session,
    alert: SearchAlert,
    target_dates: list,
) -> None:
    """
    Match existing trips with an alert for specific dates only.
    This is used when dates are added to an existing alert.
    
    Args:
        db: Database session
        alert: The SearchAlert object
        target_dates: List of date objects to match
    """
    if not target_dates or len(target_dates) == 0:
        return
    
    from datetime import datetime, timezone, date as date_type
    
    # Parse alert target_time
    try:
        alert_time_parts = alert.target_time.split(":")
        alert_hour = int(alert_time_parts[0])
        alert_minute = int(alert_time_parts[1])
        alert_time_minutes = alert_hour * 60 + alert_minute
    except (ValueError, IndexError):
        print(f"Invalid alert target_time format: {alert.target_time}")
        return
    
    # Get current date to filter out past trips
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Find all active trips that match destination
    all_trips = db.query(Ride).filter(
        Ride.is_active == True,
        Ride.available_seats > 0,
        Ride.departure_date >= today_start,
        Ride.destination_city.ilike(f"%{alert.destination}%"),
    ).all()
    
    matching_trips = []
    for trip in all_trips:
        # Skip if origin doesn't match
        if alert.origin and not trip.departure_city.lower() in alert.origin.lower() and not alert.origin.lower() in trip.departure_city.lower():
            continue
        
        # Check if trip date is in target_dates
        trip_date = trip.departure_date.date()
        if trip_date not in target_dates:
            continue
        
        # Parse trip departure_time
        try:
            trip_time_parts = trip.departure_time.split(":")
            trip_hour = int(trip_time_parts[0])
            trip_minute = int(trip_time_parts[1])
            trip_time_minutes = trip_hour * 60 + trip_minute
        except (ValueError, IndexError):
            continue
        
        # Check if trip time is within flexibility range
        time_diff = abs(trip_time_minutes - alert_time_minutes)
        if time_diff > alert.flexibility_minutes:
            continue
        
        # Trip matches all criteria
        matching_trips.append(trip)
    
    print(f"Found {len(matching_trips)} existing trips matching alert {alert.id} for added dates")
    
    # Create bookings and notifications for matching trips
    for trip in matching_trips:
        # Skip if user is the driver
        if alert.user_id == trip.driver_id:
            continue
        
        # Check if user already has a booking for this ride
        existing_booking = db.query(Booking).filter(
            Booking.ride_id == trip.id,
            Booking.passenger_id == alert.user_id,
            Booking.status.in_([BookingStatus.pending, BookingStatus.confirmed])
        ).first()
        
        if existing_booking:
            continue
        
        # Check if there are available seats
        if trip.available_seats <= 0:
            continue
        
        try:
            # Create automatic booking in pending status
            auto_booking = Booking(
                ride_id=trip.id,
                passenger_id=alert.user_id,
                status=BookingStatus.pending,
                seats=1,
            )
            db.add(auto_booking)
            
            # Create notification
            notification = create_notification(
                db=db,
                receiver_id=alert.user_id,
                type="auto_trip_match",
                message="¡Hemos encontrado un viaje para ti! Se ha encontrado un viaje que coincide con tu búsqueda automática.",
                ride_id=trip.id,
            )
            
            db.commit()
            print(f"Created auto-booking and notification for user {alert.user_id} on existing ride {trip.id} for added date")
            
        except Exception as e:
            db.rollback()
            print(f"Error creating auto-booking for user {alert.user_id} on existing ride {trip.id}: {e}")
            import traceback
            traceback.print_exc()
            continue


def cancel_auto_bookings_for_dates(
    db: Session,
    alert: SearchAlert,
    removed_dates: list,
    alert_origin: str,
    alert_destination: str,
    alert_target_time: str,
    alert_flexibility_minutes: int,
) -> None:
    """
    Cancel automatic bookings for specific dates that were removed from an alert.
    
    Args:
        db: Database session
        alert: The SearchAlert object
        removed_dates: List of date objects that were removed from the alert
        alert_origin: Origin of the alert
        alert_destination: Destination of the alert
        alert_target_time: Target time of the alert (HH:MM format)
        alert_flexibility_minutes: Flexibility in minutes
    """
    if not removed_dates or len(removed_dates) == 0:
        return
    
    from datetime import date as date_type
    
    # Parse alert target_time
    try:
        alert_time_parts = alert_target_time.split(":")
        alert_hour = int(alert_time_parts[0])
        alert_minute = int(alert_time_parts[1])
        alert_time_minutes = alert_hour * 60 + alert_minute
    except (ValueError, IndexError):
        print(f"Invalid alert target_time format: {alert_target_time}")
        return
    
    # Find all bookings for the alert user that are pending or confirmed
    user_bookings = db.query(Booking).join(Ride).filter(
        Booking.passenger_id == alert.user_id,
        Booking.status.in_([BookingStatus.pending, BookingStatus.confirmed]),
        Ride.is_active == True,
    ).all()
    
    canceled_count = 0
    for booking in user_bookings:
        ride = booking.ride
        
        # Check if ride date is in removed dates
        ride_date = ride.departure_date.date()
        if ride_date not in removed_dates:
            continue
        
        # Check if ride matches alert criteria (destination, origin, time)
        # Destination match
        if not ride.destination_city.lower() in alert_destination.lower() and not alert_destination.lower() in ride.destination_city.lower():
            continue
        
        # Origin match (optional)
        if alert_origin and not ride.departure_city.lower() in alert_origin.lower() and not alert_origin.lower() in ride.departure_city.lower():
            continue
        
        # Time match (within flexibility)
        try:
            ride_time_parts = ride.departure_time.split(":")
            ride_hour = int(ride_time_parts[0])
            ride_minute = int(ride_time_parts[1])
            ride_time_minutes = ride_hour * 60 + ride_minute
        except (ValueError, IndexError):
            continue
        
        time_diff = abs(ride_time_minutes - alert_time_minutes)
        if time_diff > alert_flexibility_minutes:
            continue
        
        # This booking matches the removed date criteria - cancel it (so it appears in registro)
        try:
            was_confirmed = booking.status == BookingStatus.confirmed
            
            # Cancel the booking (so it appears in registro as cancelled)
            booking.status = BookingStatus.canceled
            
            # If it was confirmed, restore seats and notify driver
            if was_confirmed:
                ride.available_seats += booking.seats
                
                # Get passenger user for notification
                passenger = db.query(User).filter(User.id == alert.user_id).first()
                passenger_name = passenger.full_name if passenger and passenger.full_name else (passenger.email if passenger else "Un pasajero")
                
                # Create notification for the driver (same as when passenger cancels)
                notification = create_notification(
                    db=db,
                    receiver_id=ride.driver_id,
                    type="booking_cancelled",
                    message=(
                        f"El pasajero {passenger_name} "
                        f"ha cancelado su reserva para el viaje "
                        f"{ride.departure_city} → {ride.destination_city}."
                    ),
                    ride_id=ride.id,
                )
                db.add(notification)
            
            db.commit()
            canceled_count += 1
            print(f"Canceled auto-booking {booking.id} for removed date {ride_date}")
            
        except Exception as e:
            db.rollback()
            print(f"Error canceling booking {booking.id}: {e}")
            import traceback
            traceback.print_exc()
            continue
    
    print(f"Canceled {canceled_count} auto-bookings for removed dates from alert {alert.id}")
