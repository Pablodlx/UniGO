from datetime import datetime, timedelta, time as dt_time, timezone
from typing import List, Optional, Tuple
import math

import pytz
from sqlalchemy.orm import Session
from sqlalchemy import and_, not_

from app.auth.models import Ride, User, Booking, BookingStatus, SearchAlert
from app.rides.schemas import RideCreate, RideOut, RideSearch, PassengerInfo
from app.core.maps import calculate_travel_time_sync
from app.notifications.utils import create_notification


def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great circle distance between two points on Earth (in kilometers).
    
    Args:
        lat1: Latitude of first point in degrees
        lon1: Longitude of first point in degrees
        lat2: Latitude of second point in degrees
        lon2: Longitude of second point in degrees
    
    Returns:
        Distance in kilometers
    """
    # Convert latitude and longitude from degrees to radians
    lat1_rad = math.radians(lat1)
    lon1_rad = math.radians(lon1)
    lat2_rad = math.radians(lat2)
    lon2_rad = math.radians(lon2)
    
    # Haversine formula
    dlat = lat2_rad - lat1_rad
    dlon = lon2_rad - lon1_rad
    
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon / 2) ** 2
    c = 2 * math.asin(math.sqrt(a))
    
    # Radius of Earth in kilometers
    R = 6371.0
    
    return R * c
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
    # PROBLEMA CORREGIDO: Se añadió logging detallado y mejor manejo de errores
    print(f"[RIDE CREATION] Created ride {ride.id} for driver {driver_id}, checking matching alerts...")
    try:
        match_search_alerts_with_trip(db, ride)
        print(f"[RIDE CREATION] ✅ Finished matching alerts for ride {ride.id}")
    except Exception as e:
        # Log error but don't fail ride creation
        print(f"[RIDE CREATION] ❌ ERROR matching search alerts with trip {ride.id}: {e}")
        import traceback
        print(traceback.format_exc())
        # Re-raise to ensure we see the error, but ride creation still succeeds
    
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


def _convert_ride_to_rideout(db: Session, ride: Ride, exclude_booked_by_user_id: int = None) -> Optional[RideOut]:
    """Helper function to convert a Ride to RideOut with driver info"""
    from app.auth.models import Booking, BookingStatus
    
    driver = db.query(User).filter(User.id == ride.driver_id).first()
    if not driver:
        return None
    
    # Get driver's average rating
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


def search_rides(db: Session, search_params: RideSearch, exclude_booked_by_user_id: int = None) -> Tuple[List[RideOut], List[dict]]:
    """
    Search rides with optional filters.
    Returns a tuple of (exact_matches, nearby_matches).
    """
    from datetime import timezone
    
    # Get booked ride IDs if user ID is provided
    booked_ride_ids = set()
    if exclude_booked_by_user_id:
        from app.auth.models import Booking
        booked_ride_ids = {b.ride_id for b in db.query(Booking).filter(
            Booking.passenger_id == exclude_booked_by_user_id,
            Booking.status != "canceled"
        ).all()}
    
    # Build query for exact matches
    query = db.query(Ride).join(User).filter(Ride.is_active == True, Ride.available_seats > 0)
    
    # Apply filters if provided
    if search_params.departure_city:
        query = query.filter(Ride.departure_city.ilike(f"%{search_params.departure_city}%"))
    
    if search_params.destination_city:
        query = query.filter(Ride.destination_city.ilike(f"%{search_params.destination_city}%"))
    
    if search_params.departure_date:
        # Filter by date - show rides on or after the search date
        search_date_start = search_params.departure_date.replace(hour=0, minute=0, second=0, microsecond=0)
        if search_date_start.tzinfo is None:
            search_date_start = search_date_start.replace(tzinfo=timezone.utc)
        query = query.filter(Ride.departure_date >= search_date_start)
    else:
        # If no date provided, filter out past rides
        now = datetime.now(timezone.utc)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        query = query.filter(Ride.departure_date >= today_start)
    
    # Order by departure date (soonest first)
    exact_rides = query.order_by(Ride.departure_date.asc(), Ride.departure_time.asc()).all()
    
    # Filter out booked rides
    exact_rides = [r for r in exact_rides if r.id not in booked_ride_ids]
    
    # Convert to RideOut
    exact_matches = []
    for ride in exact_rides:
        ride_out = _convert_ride_to_rideout(db, ride, exclude_booked_by_user_id)
        if ride_out:
            exact_matches.append(ride_out)
    
    # If there are exact matches, return them and empty nearby_matches
    if len(exact_matches) > 0:
        return exact_matches, []
    
    # If no exact matches and coordinates are provided, search for nearby rides
    nearby_matches = []
    if (search_params.departure_lat is not None and search_params.departure_lng is not None and
        search_params.destination_lat is not None and search_params.destination_lng is not None):
        
        # Query all active rides with available seats and coordinates
        nearby_query = db.query(Ride).join(User).filter(
            Ride.is_active == True,
            Ride.available_seats > 0,
            Ride.departure_lat.isnot(None),
            Ride.departure_lng.isnot(None),
            Ride.destination_lat.isnot(None),
            Ride.destination_lng.isnot(None),
        )
        
        # Apply date filter if provided
        if search_params.departure_date:
            search_date_start = search_params.departure_date.replace(hour=0, minute=0, second=0, microsecond=0)
            if search_date_start.tzinfo is None:
                search_date_start = search_date_start.replace(tzinfo=timezone.utc)
            nearby_query = nearby_query.filter(Ride.departure_date >= search_date_start)
        else:
            now = datetime.now(timezone.utc)
            today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            nearby_query = nearby_query.filter(Ride.departure_date >= today_start)
        
        all_nearby_rides = nearby_query.order_by(Ride.departure_date.asc(), Ride.departure_time.asc()).all()
        
        # Filter out booked rides
        all_nearby_rides = [r for r in all_nearby_rides if r.id not in booked_ride_ids]
        
        # Check distance for each ride
        for ride in all_nearby_rides:
            if ride.departure_lat is None or ride.departure_lng is None or ride.destination_lat is None or ride.destination_lng is None:
                continue
            
            # Calculate distances
            origin_dist = haversine(
                search_params.departure_lat,
                search_params.departure_lng,
                ride.departure_lat,
                ride.departure_lng
            )
            
            dest_dist = haversine(
                search_params.destination_lat,
                search_params.destination_lng,
                ride.destination_lat,
                ride.destination_lng
            )
            
            # If both distances are <= 1 km, add to nearby matches
            if origin_dist <= 1.0 and dest_dist <= 1.0:
                ride_out = _convert_ride_to_rideout(db, ride, exclude_booked_by_user_id)
                if ride_out:
                    # Convert RideOut to dict and add distance info
                    ride_dict = ride_out.model_dump()
                    ride_dict["origin_distance_km"] = origin_dist
                    ride_dict["destination_distance_km"] = dest_dist
                    nearby_matches.append(ride_dict)
    
    return exact_matches, nearby_matches


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
    MATCHING BIDIRECCIONAL: Procesar viaje nuevo contra alertas existentes.
    
    Cuando un conductor crea un viaje NUEVO, esta función:
    1. Busca todas las alertas activas compatibles
    2. Crea reservas PENDING para cada alerta que coincida
    3. Envía notificaciones a los usuarios
    
    REGLAS CRÍTICAS:
    - Solo bloquea si hay reserva PENDING/CONFIRMED para el MISMO viaje
    - NO bloquea por reservas REJECTED (la alerta sigue activa)
    - NO bloquea por reservas PENDING en OTROS viajes (permite overbooking)
    - Permite múltiples reservas PENDING para el mismo viaje (overbooking controlado)
    
    Args:
        db: Database session
        trip: The newly created Ride object
    """
    from datetime import date as date_type
    
    print("=" * 70)
    print(f"[TRIP MATCHING] Processing trip {trip.id} against existing alerts")
    print(f"  Trip driver_id: {trip.driver_id}")
    print(f"  Trip origin: {trip.departure_city}")
    print(f"  Trip destination: {trip.destination_city}")
    print(f"  Trip date: {trip.departure_date.date()}")
    print(f"  Trip time: {trip.departure_time}")
    print(f"  Trip available_seats: {trip.available_seats}")
    print("=" * 70)
    
    # Get day of week from trip departure_date (0=Monday, 6=Sunday)
    trip_day_of_week = trip.departure_date.weekday()
    
    # Parse trip departure_time (format: "HH:MM")
    try:
        trip_time_parts = trip.departure_time.split(":")
        trip_hour = int(trip_time_parts[0])
        trip_minute = int(trip_time_parts[1])
        trip_time_minutes = trip_hour * 60 + trip_minute
        print(f"  Parsed trip time: {trip_hour:02d}:{trip_minute:02d} ({trip_time_minutes} minutes)")
    except (ValueError, IndexError) as e:
        print(f"[TRIP MATCHING] ❌ Invalid trip departure_time format: {trip.departure_time}, error: {e}")
        return
    
    # Get trip date (without time)
    trip_date = trip.departure_date.date()
    
    # Find all active search alerts
    # We'll check both text matching and distance matching
    all_alerts = db.query(SearchAlert).filter(
        SearchAlert.active == True,
    ).all()
    
    print(f"  Found {len(all_alerts)} active search alerts")
    
    # Filter in Python to check:
    # 1. Destination matches (text OR distance ≤1 km)
    # 2. Origin matches (text OR distance ≤1 km) - optional
    # 3. Date matches (specific_dates has priority over days_of_week)
    # 4. Time is within flexibility range
    matching_alerts = []
    for alert in all_alerts:
        # Normalize alert specific_dates to Python date objects for comparison
        alert_specific_dates_normalized = None
        if alert.specific_dates and len(alert.specific_dates) > 0:
            try:
                alert_specific_dates_normalized = []
                for d in alert.specific_dates:
                    if isinstance(d, date_type):
                        alert_specific_dates_normalized.append(d)
                    elif isinstance(d, str):
                        alert_specific_dates_normalized.append(date_type.fromisoformat(d))
                    else:
                        alert_specific_dates_normalized.append(d.date() if hasattr(d, 'date') else date_type.fromisoformat(str(d)))
            except Exception as e:
                print(f"  Alert {alert.id}: Error normalizing specific_dates: {e}")
                continue
        
        # Check destination match (text OR distance)
        destination_matches = False
        if trip.destination_city and alert.destination:
            # Text match - check both directions
            trip_dest_lower = trip.destination_city.lower().strip()
            alert_dest_lower = alert.destination.lower().strip()
            destination_matches = trip_dest_lower in alert_dest_lower or alert_dest_lower in trip_dest_lower
        
        # Distance match (only if allow_nearby_search is True and coordinates available)
        if not destination_matches and alert.allow_nearby_search:
            if (alert.destination_lat is not None and alert.destination_lng is not None and 
                trip.destination_lat is not None and trip.destination_lng is not None):
                dest_dist = haversine(
                    alert.destination_lat,
                    alert.destination_lng,
                    trip.destination_lat,
                    trip.destination_lng
                )
                destination_matches = dest_dist <= 1.0
        
        if not destination_matches:
            continue
        
        # Check origin match - optional
        origin_matches = True  # Default to True if no origin specified
        if alert.origin:
            origin_matches = False
            if trip.departure_city:
                # Text match - check both directions
                trip_orig_lower = trip.departure_city.lower().strip()
                alert_orig_lower = alert.origin.lower().strip()
                origin_matches = trip_orig_lower in alert_orig_lower or alert_orig_lower in trip_orig_lower
            
            # Distance match (only if allow_nearby_search is True and coordinates available and text didn't match)
            if not origin_matches and alert.allow_nearby_search:
                if (alert.origin_lat is not None and alert.origin_lng is not None and 
                    trip.departure_lat is not None and trip.departure_lng is not None):
                    origin_dist = haversine(
                        alert.origin_lat,
                        alert.origin_lng,
                        trip.departure_lat,
                        trip.departure_lng
                    )
                    origin_matches = origin_dist <= 1.0
        
        if not origin_matches:
            continue
        
        # Check date matching - CRITICAL: Normalize dates for comparison
        date_matches = False
        # CASE 1: Alert uses specific_dates (PRIORITY)
        if alert_specific_dates_normalized and len(alert_specific_dates_normalized) > 0:
            date_matches = trip_date in alert_specific_dates_normalized
        # CASE 2: Alert uses days_of_week (only if no specific_dates)
        elif alert.days_of_week and len(alert.days_of_week) > 0:
            date_matches = trip_day_of_week in alert.days_of_week
        else:
            # No date criteria, skip
            continue
        
        # Alert matches if date matches
        if date_matches:
            print(f"  ✅ Alert {alert.id} MATCHES trip {trip.id} (date check passed)")
            matching_alerts.append(alert)
    
    print(f"[TRIP MATCHING] Found {len(matching_alerts)} active search alerts matching trip {trip.id}")
    
    bookings_created = 0
    for alert in matching_alerts:
        # Parse alert target_time (format: "HH:MM")
        try:
            alert_time_parts = alert.target_time.split(":")
            alert_hour = int(alert_time_parts[0])
            alert_minute = int(alert_time_parts[1])
            alert_time_minutes = alert_hour * 60 + alert_minute
        except (ValueError, IndexError) as e:
            print(f"  Alert {alert.id}: Invalid target_time format: {alert.target_time}, error: {e}")
            continue
        
        # Check if trip time is within flexibility range
        time_diff = abs(trip_time_minutes - alert_time_minutes)
        if time_diff > alert.flexibility_minutes:
            print(f"  Alert {alert.id}: Time {alert.target_time} does not match trip {trip.departure_time} (diff: {time_diff} min, max: {alert.flexibility_minutes} min)")
            continue
        
        # Skip if user is the driver (can't book their own ride)
        if alert.user_id == trip.driver_id:
            print(f"  Skipping alert {alert.id}: User {alert.user_id} is the driver of trip {trip.id}")
            continue
        
        # REGLA CRÍTICA: Solo bloquear si hay una reserva PENDING o CONFIRMED para ESTE MISMO viaje
        # NO bloquear por reservas en otros viajes (incluso si es la misma fecha)
        # Las reservas REJECTED NO bloquean nuevas reservas (la alerta sigue activa)
        # Permitir múltiples reservas PENDING en diferentes viajes para la misma fecha
        existing_booking = db.query(Booking).filter(
            Booking.ride_id == trip.id,
            Booking.passenger_id == alert.user_id,
            Booking.status.in_([BookingStatus.pending, BookingStatus.confirmed])
        ).first()
        
        if existing_booking:
            print(f"  Skipping alert {alert.id}: User {alert.user_id} already has a booking for trip {trip.id} (status: {existing_booking.status})")
            continue
        
        # Log si hay una reserva REJECTED para este viaje (para debugging)
        rejected_booking = db.query(Booking).filter(
            Booking.ride_id == trip.id,
            Booking.passenger_id == alert.user_id,
            Booking.status == BookingStatus.rejected
        ).first()
        
        if rejected_booking:
            print(f"[ALERT MATCHING] Processing active alert {alert.id} for trip {trip.id} after previous rejection (booking {rejected_booking.id} was rejected - alert remains active)")
        
        # OVERBOOKING CONTROLADO: Permitir crear reservas PENDING sin verificar capacidad
        # Solo verificamos que el viaje tenga al menos 1 asiento disponible para mostrar que hay capacidad
        # Las reservas PENDING no consumen asientos; solo las CONFIRMED lo hacen
        if trip.available_seats <= 0:
            print(f"  Skipping alert {alert.id}: Trip {trip.id} has no available seats (available_seats: {trip.available_seats})")
            continue
        
        try:
            print(f"[ALERT MATCHING] Creating pending booking from alert {alert.id} for trip {trip.id} and user {alert.user_id}")
            # Create automatic booking in pending status
            # IMPORTANTE: No decrementamos available_seats aquí porque la reserva está en PENDING
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
            bookings_created += 1
            print(f"  ✅✅✅ SUCCESS: Created auto-booking {auto_booking.id} and notification for user {alert.user_id} (alert {alert.id}) on trip {trip.id}")
            
        except Exception as e:
            db.rollback()
            print(f"  ❌ ERROR creating auto-booking for user {alert.user_id} (alert {alert.id}) on trip {trip.id}: {e}")
            import traceback
            traceback.print_exc()
            continue
    
    print("=" * 70)
    print(f"[TRIP MATCHING] ✅ Completed: Created {bookings_created} auto-bookings for trip {trip.id}")
    print("=" * 70)


def _get_trip_score(db: Session, trip: Ride, alert: SearchAlert) -> tuple[float, float]:
    """
    Calculate a score for a trip to determine if it's better than another.
    Returns (rating_score, distance_score) where:
    - rating_score: driver's average rating (higher is better, None = 0)
    - distance_score: distance from alert origin to trip origin (lower is better, None = infinity)
    """
    # Get driver rating
    rating_score = 0.0
    if ratings_service:
        try:
            driver_rating = ratings_service.get_user_average_rating(db, trip.driver_id)
            rating_score = driver_rating if driver_rating is not None else 0.0
        except Exception:
            rating_score = 0.0
    
    # Get distance (if coordinates available)
    distance_score = float('inf')
    if alert.origin_lat is not None and alert.origin_lng is not None and trip.departure_lat is not None and trip.departure_lng is not None:
        distance_score = haversine(
            alert.origin_lat, alert.origin_lng,
            trip.departure_lat, trip.departure_lng
        )
    
    return (rating_score, distance_score)


def _select_best_trip(db: Session, trips: List[Ride], alert: SearchAlert) -> Optional[Ride]:
    """
    Select the best trip from a list based on:
    1. Higher driver rating (if available)
    2. Closer distance (if same rating or no rating)
    
    Returns the best trip or None if list is empty.
    """
    if not trips or len(trips) == 0:
        return None
    
    if len(trips) == 1:
        return trips[0]
    
    # Calculate scores for all trips
    trip_scores = []
    for trip in trips:
        rating_score, distance_score = _get_trip_score(db, trip, alert)
        trip_scores.append((trip, rating_score, distance_score))
    
    # Sort by rating (descending), then by distance (ascending)
    trip_scores.sort(key=lambda x: (-x[1], x[2]))
    
    return trip_scores[0][0]


def match_existing_trips_with_alert(db: Session, alert: SearchAlert) -> None:
    """
    MATCHING BIDIRECCIONAL: Procesar alerta nueva contra viajes existentes.
    
    Cuando un usuario crea una alerta, esta función:
    1. Busca todos los viajes existentes compatibles
    2. Crea reservas PENDING para cada viaje que coincida (uno por fecha, el mejor)
    3. Envía notificaciones al usuario
    
    REGLAS CRÍTICAS:
    - Solo bloquea si hay reserva PENDING/CONFIRMED para el MISMO viaje
    - NO bloquea por reservas REJECTED (la alerta sigue activa)
    - NO bloquea por reservas PENDING en OTROS viajes (permite múltiples intentos)
    - Selecciona el mejor viaje por fecha (rating más alto, distancia más corta)
    
    Args:
        db: Database session
        alert: The newly created SearchAlert object
    """
    from datetime import datetime, timezone, date as date_type
    
    print("=" * 70)
    print(f"[ALERT MATCHING] Processing alert {alert.id} against existing trips")
    print(f"  Alert user_id: {alert.user_id}")
    print(f"  Alert origin: {alert.origin}")
    print(f"  Alert destination: {alert.destination}")
    print(f"  Alert target_time: {alert.target_time}")
    print(f"  Alert flexibility: {alert.flexibility_minutes} min")
    print(f"  Alert specific_dates: {alert.specific_dates}")
    print(f"  Alert days_of_week: {alert.days_of_week}")
    print(f"  Alert allow_nearby_search: {alert.allow_nearby_search}")
    print("=" * 70)
    
    # Parse alert target_time (format: "HH:MM")
    try:
        alert_time_parts = alert.target_time.split(":")
        alert_hour = int(alert_time_parts[0])
        alert_minute = int(alert_time_parts[1])
        alert_time_minutes = alert_hour * 60 + alert_minute
        print(f"  Parsed alert time: {alert_hour:02d}:{alert_minute:02d} ({alert_time_minutes} minutes)")
    except (ValueError, IndexError) as e:
        print(f"[ALERT MATCHING] ❌ Invalid alert target_time format: {alert.target_time}, error: {e}")
        return
    
    # Get current date to filter out past trips
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    print(f"  Filtering trips from: {today_start.date()}")
    
    # Find all active trips in the future
    # We'll check both text matching and distance matching
    all_trips = db.query(Ride).filter(
        Ride.is_active == True,
        Ride.available_seats > 0,
        Ride.departure_date >= today_start,  # Only future trips
    ).all()
    
    print(f"  Found {len(all_trips)} active trips with available seats")
    
    # Normalize alert specific_dates to Python date objects for comparison
    alert_specific_dates_normalized = None
    if alert.specific_dates and len(alert.specific_dates) > 0:
        try:
            # Convert to list of Python date objects
            alert_specific_dates_normalized = []
            for d in alert.specific_dates:
                if isinstance(d, date_type):
                    alert_specific_dates_normalized.append(d)
                elif isinstance(d, str):
                    alert_specific_dates_normalized.append(date_type.fromisoformat(d))
                else:
                    # Try to convert to date
                    alert_specific_dates_normalized.append(d.date() if hasattr(d, 'date') else date_type.fromisoformat(str(d)))
            print(f"  Normalized specific_dates: {alert_specific_dates_normalized}")
        except Exception as e:
            print(f"[ALERT MATCHING] ❌ Error normalizing specific_dates: {e}")
            import traceback
            traceback.print_exc()
            return
    
    # Filter trips that match the alert criteria:
    # 1. Destination matches (text OR distance ≤1 km)
    # 2. Origin matches (text OR distance ≤1 km) - optional
    # 3. Date matches (specific_dates has priority over days_of_week)
    # 4. Time is within flexibility range
    matching_trips = []
    for trip in all_trips:
        # Check destination match (text OR distance)
        destination_matches = False
        if trip.destination_city and alert.destination:
            # Text match - check both directions
            trip_dest_lower = trip.destination_city.lower().strip()
            alert_dest_lower = alert.destination.lower().strip()
            destination_matches = trip_dest_lower in alert_dest_lower or alert_dest_lower in trip_dest_lower
        
        # Distance match (only if allow_nearby_search is True and coordinates available)
        if not destination_matches and alert.allow_nearby_search:
            if (alert.destination_lat is not None and alert.destination_lng is not None and 
                trip.destination_lat is not None and trip.destination_lng is not None):
                dest_dist = haversine(
                    alert.destination_lat,
                    alert.destination_lng,
                    trip.destination_lat,
                    trip.destination_lng
                )
                destination_matches = dest_dist <= 1.0
                if destination_matches:
                    print(f"  Trip {trip.id}: Destination matches by distance ({dest_dist:.2f} km)")
        
        if not destination_matches:
            continue
        
        # Check origin match - optional
        origin_matches = True  # Default to True if no origin specified
        if alert.origin:
            origin_matches = False
            if trip.departure_city:
                # Text match - check both directions
                trip_orig_lower = trip.departure_city.lower().strip()
                alert_orig_lower = alert.origin.lower().strip()
                origin_matches = trip_orig_lower in alert_orig_lower or alert_orig_lower in trip_orig_lower
            
            # Distance match (only if allow_nearby_search is True and coordinates available and text didn't match)
            if not origin_matches and alert.allow_nearby_search:
                if (alert.origin_lat is not None and alert.origin_lng is not None and 
                    trip.departure_lat is not None and trip.departure_lng is not None):
                    origin_dist = haversine(
                        alert.origin_lat,
                        alert.origin_lng,
                        trip.departure_lat,
                        trip.departure_lng
                    )
                    origin_matches = origin_dist <= 1.0
                    if origin_matches:
                        print(f"  Trip {trip.id}: Origin matches by distance ({origin_dist:.2f} km)")
        
        if not origin_matches:
            continue
        
        # Check date matching - CRITICAL: Normalize dates for comparison
        trip_date = trip.departure_date.date()
        trip_day_of_week = trip.departure_date.weekday()
        date_matches = False
        
        # CASE 1: Alert uses specific_dates (PRIORITY)
        if alert_specific_dates_normalized and len(alert_specific_dates_normalized) > 0:
            # Compare normalized dates
            date_matches = trip_date in alert_specific_dates_normalized
            if not date_matches:
                print(f"  Trip {trip.id}: Date {trip_date} not in alert specific_dates {alert_specific_dates_normalized}")
        # CASE 2: Alert uses days_of_week (only if no specific_dates)
        elif alert.days_of_week and len(alert.days_of_week) > 0:
            date_matches = trip_day_of_week in alert.days_of_week
            if not date_matches:
                print(f"  Trip {trip.id}: Day of week {trip_day_of_week} not in alert days_of_week {alert.days_of_week}")
        else:
            # No date criteria, skip
            print(f"  Trip {trip.id}: Alert has no date criteria")
            continue
        
        if not date_matches:
            continue
        
        # Parse trip departure_time (format: "HH:MM")
        try:
            trip_time_parts = trip.departure_time.split(":")
            trip_hour = int(trip_time_parts[0])
            trip_minute = int(trip_time_parts[1])
            trip_time_minutes = trip_hour * 60 + trip_minute
        except (ValueError, IndexError) as e:
            print(f"  Trip {trip.id}: Invalid departure_time format: {trip.departure_time}, error: {e}")
            continue
        
        # Check if trip time is within flexibility range
        time_diff = abs(trip_time_minutes - alert_time_minutes)
        if time_diff > alert.flexibility_minutes:
            print(f"  Trip {trip.id}: Time {trip.departure_time} does not match alert {alert.target_time} (diff: {time_diff} min, max: {alert.flexibility_minutes} min)")
            continue
        
        # Trip matches all criteria
        print(f"  ✅ Trip {trip.id} MATCHES alert {alert.id}: {trip.departure_city} → {trip.destination_city} on {trip_date} at {trip.departure_time}")
        matching_trips.append(trip)
    
    print(f"[ALERT MATCHING] Found {len(matching_trips)} existing trips matching alert {alert.id} for destination '{alert.destination}'")
    
    if len(matching_trips) == 0:
        print(f"[ALERT MATCHING] ⚠️ No matching trips found. Alert details:")
        print(f"   - Origin: {alert.origin}")
        print(f"   - Destination: {alert.destination}")
        print(f"   - Time: {alert.target_time} (±{alert.flexibility_minutes} min)")
        print(f"   - Dates: {alert_specific_dates_normalized or alert.days_of_week}")
        print(f"   - Total trips checked: {len(all_trips)}")
        return
    
    # Group trips by date and select only the best trip per date
    from collections import defaultdict
    trips_by_date = defaultdict(list)
    for trip in matching_trips:
        trip_date = trip.departure_date.date()
        trips_by_date[trip_date].append(trip)
    
    # Select best trip for each date
    best_trips = []
    for trip_date, date_trips in trips_by_date.items():
        best_trip = _select_best_trip(db, date_trips, alert)
        if best_trip:
            best_trips.append(best_trip)
    
    print(f"[ALERT MATCHING] Selected {len(best_trips)} best trips (one per date) for alert {alert.id}")
    
    # Create bookings and notifications for best trips only
    bookings_created = 0
    for trip in best_trips:
        # Skip if user is the driver (can't book their own ride)
        if alert.user_id == trip.driver_id:
            print(f"  Skipping trip {trip.id}: User {alert.user_id} is the driver")
            continue
        
        # REGLA CRÍTICA: Solo bloquear si hay una reserva PENDING o CONFIRMED para ESTE MISMO viaje
        # NO bloquear por reservas en otros viajes (incluso si es la misma fecha)
        # Las reservas REJECTED NO bloquean nuevas reservas (la alerta sigue activa)
        # Permitir múltiples reservas PENDING en diferentes viajes para la misma fecha
        existing_booking = db.query(Booking).filter(
            Booking.ride_id == trip.id,
            Booking.passenger_id == alert.user_id,
            Booking.status.in_([BookingStatus.pending, BookingStatus.confirmed])
        ).first()
        
        if existing_booking:
            print(f"  Skipping trip {trip.id}: User {alert.user_id} already has a booking (status: {existing_booking.status})")
            continue
        
        # Log si hay una reserva REJECTED para este viaje (para debugging)
        rejected_booking = db.query(Booking).filter(
            Booking.ride_id == trip.id,
            Booking.passenger_id == alert.user_id,
            Booking.status == BookingStatus.rejected
        ).first()
        
        if rejected_booking:
            print(f"[ALERT MATCHING] Processing active alert {alert.id} for trip {trip.id} after previous rejection (booking {rejected_booking.id} was rejected - alert remains active)")
        
        # OVERBOOKING CONTROLADO: Permitir crear reservas PENDING sin verificar capacidad
        # Solo verificamos que el viaje tenga al menos 1 asiento disponible para mostrar que hay capacidad
        # Las reservas PENDING no consumen asientos; solo las CONFIRMED lo hacen
        if trip.available_seats <= 0:
            print(f"  Skipping trip {trip.id}: Trip has no available seats (available_seats: {trip.available_seats})")
            continue
        
        try:
            # Log si es una nueva reserva después de un rechazo previo
            if rejected_booking:
                print(f"[ALERT MATCHING] Creating new pending booking from alert {alert.id} for new matching trip {trip.id} (previous booking {rejected_booking.id} was rejected)")
            else:
                print(f"[ALERT MATCHING] Creating pending booking from alert {alert.id} for trip {trip.id} and user {alert.user_id}")
            
            # Create automatic booking in pending status
            # IMPORTANTE: No decrementamos available_seats aquí porque la reserva está en PENDING
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
            bookings_created += 1
            print(f"  ✅✅✅ SUCCESS: Created auto-booking {auto_booking.id} and notification for user {alert.user_id} on trip {trip.id}")
            
        except Exception as e:
            db.rollback()
            print(f"  ❌ ERROR creating auto-booking for user {alert.user_id} on trip {trip.id}: {e}")
            import traceback
            traceback.print_exc()
            continue
    
    print("=" * 70)
    print(f"[ALERT MATCHING] ✅ Completed: Created {bookings_created} auto-bookings for alert {alert.id}")
    print("=" * 70)


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
    
    # Find all active trips in the future
    # We'll check both text matching and distance matching
    all_trips = db.query(Ride).filter(
        Ride.is_active == True,
        Ride.available_seats > 0,
        Ride.departure_date >= today_start,
    ).all()
    
    matching_trips = []
    for trip in all_trips:
        # Check destination match (text OR distance)
        destination_matches = False
        if trip.destination_city and alert.destination:
            # Text match
            destination_matches = trip.destination_city.lower() in alert.destination.lower() or alert.destination.lower() in trip.destination_city.lower()
        
        # Distance match (only if allow_nearby_search is True and coordinates available)
        if not destination_matches and alert.allow_nearby_search and alert.destination_lat is not None and alert.destination_lng is not None and trip.destination_lat is not None and trip.destination_lng is not None:
            dest_dist = haversine(
                alert.destination_lat,
                alert.destination_lng,
                trip.destination_lat,
                trip.destination_lng
            )
            destination_matches = dest_dist <= 1.0
        
        if not destination_matches:
            continue
        
        # Check origin match - optional
        origin_matches = True  # Default to True if no origin specified
        if alert.origin:
            origin_matches = False
            if trip.departure_city:
                # Text match
                origin_matches = trip.departure_city.lower() in alert.origin.lower() or alert.origin.lower() in trip.departure_city.lower()
            
            # Distance match (only if allow_nearby_search is True and coordinates available and text didn't match)
            if not origin_matches and alert.allow_nearby_search and alert.origin_lat is not None and alert.origin_lng is not None and trip.departure_lat is not None and trip.departure_lng is not None:
                origin_dist = haversine(
                    alert.origin_lat,
                    alert.origin_lng,
                    trip.departure_lat,
                    trip.departure_lng
                )
                origin_matches = origin_dist <= 1.0
        
        if not origin_matches:
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
    
    # Group trips by date and select only the best trip per date
    from collections import defaultdict
    trips_by_date = defaultdict(list)
    for trip in matching_trips:
        trip_date = trip.departure_date.date()
        trips_by_date[trip_date].append(trip)
    
    # Select best trip for each date
    best_trips = []
    for trip_date, date_trips in trips_by_date.items():
        best_trip = _select_best_trip(db, date_trips, alert)
        if best_trip:
            best_trips.append(best_trip)
    
    print(f"Selected {len(best_trips)} best trips (one per date) for alert {alert.id} for added dates")
    
    # Create bookings and notifications for best trips only
    for trip in best_trips:
        # Skip if user is the driver
        if alert.user_id == trip.driver_id:
            continue
        
        # REGLA CRÍTICA: Solo bloquear si hay una reserva PENDING o CONFIRMED para ESTE MISMO viaje
        # NO bloquear por reservas en otros viajes (incluso si es la misma fecha)
        # Las reservas REJECTED NO bloquean nuevas reservas (la alerta sigue activa)
        # Permitir múltiples reservas PENDING en diferentes viajes para la misma fecha
        existing_booking = db.query(Booking).filter(
            Booking.ride_id == trip.id,
            Booking.passenger_id == alert.user_id,
            Booking.status.in_([BookingStatus.pending, BookingStatus.confirmed])
        ).first()
        
        if existing_booking:
            print(f"  Skipping trip {trip.id}: User {alert.user_id} already has a booking (status: {existing_booking.status})")
            continue
        
        # OVERBOOKING CONTROLADO: Permitir crear reservas PENDING sin verificar capacidad
        # Solo verificamos que el viaje tenga al menos 1 asiento disponible para mostrar que hay capacidad
        if trip.available_seats <= 0:
            continue
        
        try:
            print(f"[ALERT MATCHING] Creating pending booking from alert {alert.id} for trip {trip.id} and user {alert.user_id}")
            # Create automatic booking in pending status
            # IMPORTANTE: No decrementamos available_seats aquí porque la reserva está en PENDING
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


def cancel_all_auto_bookings_for_alert(db: Session, alert: SearchAlert) -> None:
    """
    Cancel all automatic bookings associated with an alert when the alert is deleted.
    Marks them as 'rejected' and notifies the driver if they were confirmed.
    
    Args:
        db: Database session
        alert: The SearchAlert object being deleted
    """
    from datetime import date as date_type
    
    # Parse alert target_time
    try:
        alert_time_parts = alert.target_time.split(":")
        alert_hour = int(alert_time_parts[0])
        alert_minute = int(alert_time_parts[1])
        alert_time_minutes = alert_hour * 60 + alert_minute
    except (ValueError, IndexError):
        print(f"Invalid alert target_time format: {alert.target_time}")
        return
    
    # Get alert dates (specific_dates has priority over days_of_week)
    alert_dates = set()
    if alert.specific_dates and len(alert.specific_dates) > 0:
        alert_dates = set(alert.specific_dates)
    elif alert.days_of_week and len(alert.days_of_week) > 0:
        # Convert days_of_week to dates (we'll check if ride date's weekday matches)
        # For now, we'll match any ride that matches the criteria
        pass
    
    # Find all bookings for the alert user that are pending or confirmed
    user_bookings = db.query(Booking).join(Ride).filter(
        Booking.passenger_id == alert.user_id,
        Booking.status.in_([BookingStatus.pending, BookingStatus.confirmed]),
        Ride.is_active == True,
    ).all()
    
    canceled_count = 0
    for booking in user_bookings:
        ride = booking.ride
        if not ride:
            continue
        
        # Check if ride matches alert criteria
        # Destination match (text OR distance if allow_nearby_search)
        destination_matches = False
        if ride.destination_city and alert.destination:
            destination_matches = ride.destination_city.lower() in alert.destination.lower() or alert.destination.lower() in ride.destination_city.lower()
        
        if not destination_matches and alert.allow_nearby_search and alert.destination_lat is not None and alert.destination_lng is not None and ride.destination_lat is not None and ride.destination_lng is not None:
            dest_dist = haversine(
                alert.destination_lat,
                alert.destination_lng,
                ride.destination_lat,
                ride.destination_lng
            )
            destination_matches = dest_dist <= 1.0
        
        if not destination_matches:
            continue
        
        # Origin match (text OR distance if allow_nearby_search)
        origin_matches = True  # Default to True if no origin specified
        if alert.origin:
            origin_matches = False
            if ride.departure_city:
                origin_matches = ride.departure_city.lower() in alert.origin.lower() or alert.origin.lower() in ride.departure_city.lower()
            
            if not origin_matches and alert.allow_nearby_search and alert.origin_lat is not None and alert.origin_lng is not None and ride.departure_lat is not None and ride.departure_lng is not None:
                origin_dist = haversine(
                    alert.origin_lat,
                    alert.origin_lng,
                    ride.departure_lat,
                    ride.departure_lng
                )
                origin_matches = origin_dist <= 1.0
        
        if not origin_matches:
            continue
        
        # Date match
        ride_date = ride.departure_date.date()
        ride_day_of_week = ride.departure_date.weekday()
        date_matches = False
        
        if alert.specific_dates and len(alert.specific_dates) > 0:
            date_matches = ride_date in alert.specific_dates
        elif alert.days_of_week and len(alert.days_of_week) > 0:
            date_matches = ride_day_of_week in alert.days_of_week
        else:
            continue  # No date criteria, skip
        
        if not date_matches:
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
        if time_diff > alert.flexibility_minutes:
            continue
        
        # This booking matches the alert criteria - reject it (so it appears in registro)
        try:
            was_confirmed = booking.status == BookingStatus.confirmed
            
            # Reject the booking (so it appears in registro as rejected)
            booking.status = BookingStatus.rejected
            
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
                        f"{ride.departure_city} → {ride.destination_city} "
                        f"debido a que eliminó su alerta de búsqueda automática."
                    ),
                    ride_id=ride.id,
                )
                db.add(notification)
            
            db.commit()
            canceled_count += 1
            print(f"Rejected auto-booking {booking.id} for deleted alert {alert.id}")
            
        except Exception as e:
            db.rollback()
            print(f"Error rejecting booking {booking.id}: {e}")
            import traceback
            traceback.print_exc()
            continue
    
    print(f"Rejected {canceled_count} auto-bookings for deleted alert {alert.id}")


def retry_search_for_rejected_auto_booking(db: Session, passenger_id: int, rejected_ride_id: int) -> None:
    """
    When an automatic booking is rejected, re-search for matching trips for the passenger's active alerts.
    This allows the system to find other drivers who publish matching trips.
    
    Args:
        db: Database session
        passenger_id: ID of the passenger whose booking was rejected
        rejected_ride_id: ID of the ride that was rejected (to exclude it from new searches)
    """
    # Find all active search alerts for this passenger
    active_alerts = db.query(SearchAlert).filter(
        SearchAlert.user_id == passenger_id,
        SearchAlert.active == True,
    ).all()
    
    if not active_alerts or len(active_alerts) == 0:
        print(f"No active alerts found for passenger {passenger_id}")
        return
    
    print(f"Found {len(active_alerts)} active alerts for passenger {passenger_id}, re-searching for matching trips...")
    
    # Get all bookings for this passenger to exclude rides they already have bookings for
    existing_bookings = db.query(Booking).filter(
        Booking.passenger_id == passenger_id,
        Booking.status.in_([BookingStatus.pending, BookingStatus.confirmed])
    ).all()
    excluded_ride_ids = {b.ride_id for b in existing_bookings}
    excluded_ride_ids.add(rejected_ride_id)  # Also exclude the ride that was just rejected
    
    # Get current date to filter out past trips
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    # For each alert, find matching trips (excluding already booked rides and the rejected ride)
    for alert in active_alerts:
        # Parse alert target_time
        try:
            alert_time_parts = alert.target_time.split(":")
            alert_hour = int(alert_time_parts[0])
            alert_minute = int(alert_time_parts[1])
            alert_time_minutes = alert_hour * 60 + alert_minute
        except (ValueError, IndexError):
            print(f"Invalid alert target_time format: {alert.target_time}")
            continue
        
        # Find all active trips that match the alert criteria
        # Exclude already booked rides and the rejected ride
        query = db.query(Ride).filter(
            Ride.is_active == True,
            Ride.available_seats > 0,
            Ride.departure_date >= today_start,
        )
        
        if excluded_ride_ids:
            query = query.filter(not_(Ride.id.in_(excluded_ride_ids)))
        
        all_trips = query.all()
        
        # Filter trips that match the alert criteria
        matching_trips = []
        for trip in all_trips:
            # Check destination match
            destination_matches = False
            if trip.destination_city and alert.destination:
                destination_matches = trip.destination_city.lower() in alert.destination.lower() or alert.destination.lower() in trip.destination_city.lower()
            
            if not destination_matches and alert.allow_nearby_search and alert.destination_lat is not None and alert.destination_lng is not None and trip.destination_lat is not None and trip.destination_lng is not None:
                dest_dist = haversine(
                    alert.destination_lat,
                    alert.destination_lng,
                    trip.destination_lat,
                    trip.destination_lng
                )
                destination_matches = dest_dist <= 1.0
            
            if not destination_matches:
                continue
            
            # Check origin match
            origin_matches = True
            if alert.origin:
                origin_matches = False
                if trip.departure_city:
                    origin_matches = trip.departure_city.lower() in alert.origin.lower() or alert.origin.lower() in trip.departure_city.lower()
                
                if not origin_matches and alert.allow_nearby_search and alert.origin_lat is not None and alert.origin_lng is not None and trip.departure_lat is not None and trip.departure_lng is not None:
                    origin_dist = haversine(
                        alert.origin_lat,
                        alert.origin_lng,
                        trip.departure_lat,
                        trip.departure_lng
                    )
                    origin_matches = origin_dist <= 1.0
            
            if not origin_matches:
                continue
            
            # Check date matching
            trip_date = trip.departure_date.date()
            trip_day_of_week = trip.departure_date.weekday()
            date_matches = False
            
            if alert.specific_dates and len(alert.specific_dates) > 0:
                date_matches = trip_date in alert.specific_dates
            elif alert.days_of_week and len(alert.days_of_week) > 0:
                date_matches = trip_day_of_week in alert.days_of_week
            else:
                continue
            
            if not date_matches:
                continue
            
            # Check time match
            try:
                trip_time_parts = trip.departure_time.split(":")
                trip_hour = int(trip_time_parts[0])
                trip_minute = int(trip_time_parts[1])
                trip_time_minutes = trip_hour * 60 + trip_minute
            except (ValueError, IndexError):
                continue
            
            time_diff = abs(trip_time_minutes - alert_time_minutes)
            if time_diff > alert.flexibility_minutes:
                continue
            
            # Skip if user is the driver
            if alert.user_id == trip.driver_id:
                continue
            
            # Trip matches all criteria
            matching_trips.append(trip)
        
        # Group trips by date and select only the best trip per date
        from collections import defaultdict
        trips_by_date = defaultdict(list)
        for trip in matching_trips:
            trip_date = trip.departure_date.date()
            trips_by_date[trip_date].append(trip)
        
        # Select best trip for each date
        best_trips = []
        for trip_date, date_trips in trips_by_date.items():
            best_trip = _select_best_trip(db, date_trips, alert)
            if best_trip:
                best_trips.append(best_trip)
        
        print(f"Selected {len(best_trips)} best trips (one per date) for alert {alert.id} after rejection")
        
        # Create bookings and notifications for best trips only
        for trip in best_trips:
            # REGLA CRÍTICA: Solo bloquear si hay una reserva PENDING o CONFIRMED para ESTE MISMO viaje
            # NO bloquear por reservas en otros viajes (incluso si es la misma fecha)
            # Las reservas REJECTED NO bloquean nuevas reservas (la alerta sigue activa)
            # Permitir múltiples reservas PENDING en diferentes viajes para la misma fecha
            existing_booking = db.query(Booking).filter(
                Booking.ride_id == trip.id,
                Booking.passenger_id == alert.user_id,
                Booking.status.in_([BookingStatus.pending, BookingStatus.confirmed])
            ).first()
            
            if existing_booking:
                print(f"  Skipping trip {trip.id}: User {alert.user_id} already has a booking (status: {existing_booking.status})")
                continue
            
            # OVERBOOKING CONTROLADO: Permitir crear reservas PENDING sin verificar capacidad
            # Solo verificamos que el viaje tenga al menos 1 asiento disponible para mostrar que hay capacidad
            if trip.available_seats <= 0:
                continue
            
            try:
                print(f"[ALERT MATCHING] Creating pending booking from alert {alert.id} for trip {trip.id} and user {alert.user_id} (after rejection)")
                # Create automatic booking in pending status
                # IMPORTANTE: No decrementamos available_seats aquí porque la reserva está en PENDING
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
                print(f"✅✅✅ SUCCESS: Created new auto-booking {auto_booking.id} and notification for user {alert.user_id} on ride {trip.id} after rejection")
                
            except Exception as e:
                db.rollback()
                print(f"Error creating auto-booking for user {alert.user_id} on ride {trip.id}: {e}")
                import traceback
                traceback.print_exc()
                continue
    
    print(f"Finished re-searching for passenger {passenger_id} after rejection of ride {rejected_ride_id}")
