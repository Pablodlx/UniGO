from typing import List
from datetime import datetime, timezone
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Header, BackgroundTasks
from sqlalchemy.orm import Session

from app.auth.models import Ride, User, Booking, BookingStatus, Notification
from app.auth.router import get_current_user
from app.db.session import get_db
from app.rides import service
from app.rides.schemas import RideCreate, RideOut, RideSearch, Passenger, RouteInfoResponse
from app.rides import favorites_service
from app.rides.favorites_schemas import FavoriteRideCreate, FavoriteRideOut
from app.utils.profile_validation import is_profile_complete
from app.payments.schemas import CompleteRideRequest, CompleteRideResponse

router = APIRouter(prefix="/rides", tags=["Rides"])

log = logging.getLogger(__name__)


@router.post("/", response_model=RideOut)
def create_ride(
    ride_data: RideCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new ride"""
    # Validate profile is complete before allowing ride creation
    if not is_profile_complete(current_user):
        raise HTTPException(
            status_code=400,
            detail="Debes completar tu perfil antes de publicar un viaje."
        )
    
    try:
        return service.create_ride(db, ride_data, current_user.id)
    except Exception as e:
        import traceback
        print(f"Error creating ride: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error creating ride: {str(e)}")


@router.get("/search", response_model=dict)
def search_rides(
    departure_city: str = Query(None, description="Filter by departure city"),
    destination_city: str = Query(None, description="Filter by destination city"),
    departure_date: str = Query(None, description="Filter by departure date (YYYY-MM-DD)"),
    departure_lat: float = Query(None, description="Departure latitude for nearby search"),
    departure_lng: float = Query(None, description="Departure longitude for nearby search"),
    destination_lat: float = Query(None, description="Destination latitude for nearby search"),
    destination_lng: float = Query(None, description="Destination longitude for nearby search"),
    db: Session = Depends(get_db),
    authorization: str = Header(None)  # Get authorization header
):
    """Search rides with optional filters. Returns exact_matches and nearby_matches."""
    from datetime import datetime
    from jose import JWTError, jwt
    from app.core.config import settings
    from app.rides.schemas import SearchRidesResponse
    
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
    
    # Add coordinates if provided
    if departure_lat is not None:
        search_params.departure_lat = departure_lat
    if departure_lng is not None:
        search_params.departure_lng = departure_lng
    if destination_lat is not None:
        search_params.destination_lat = destination_lat
    if destination_lng is not None:
        search_params.destination_lng = destination_lng
    
    # Try to get user ID from authorization header
    user_id = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]  # Remove "Bearer " prefix
        try:
            payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
            user_id = int(payload.get("sub"))
        except (JWTError, ValueError, KeyError):
            pass  # Invalid token, continue as anonymous
    
    exact_matches, nearby_matches = service.search_rides(db, search_params, exclude_booked_by_user_id=user_id)
    
    return {
        "exact_matches": [ride.model_dump() for ride in exact_matches],
        "nearby_matches": nearby_matches
    }


@router.get("/route-info", response_model=RouteInfoResponse)
def get_route_info_endpoint(
    origin_lat: float = Query(..., description="Origin latitude"),
    origin_lng: float = Query(..., description="Origin longitude"),
    destination_lat: float = Query(..., description="Destination latitude"),
    destination_lng: float = Query(..., description="Destination longitude"),
):
    """
    Get route information including distance, duration, suggested price, and polyline.
    Uses Google Directions API if available, otherwise falls back to haversine calculation.
    """
    from app.core.maps import get_route_info as get_route_info_func
    
    try:
        route_info = get_route_info_func(
            origin_lat=origin_lat,
            origin_lng=origin_lng,
            destination_lat=destination_lat,
            destination_lng=destination_lng,
        )
        
        return RouteInfoResponse(
            distance_km=route_info["distance_km"],
            duration_minutes=route_info["duration_minutes"],
            suggested_price=route_info["suggested_price"],
            polyline=route_info.get("polyline"),
        )
    except Exception as e:
        import traceback
        print(f"Error getting route info: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error getting route info: {str(e)}")


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
    """Get all bookings made by the current user (excluding rides in registro - past or cancelled)"""
    from sqlalchemy import and_
    from datetime import datetime, timezone
    from app.rides.service import get_ride_check_datetime, calculate_departure_datetime
    
    # Mark completed rides for bookings owned by this user
    # Get all rides where user has bookings and mark them as completed if needed
    from app.auth.models import Booking
    user_booking_rides = db.query(Booking.ride_id).filter(
        Booking.passenger_id == current_user.id
    ).distinct().all()
    ride_ids = [r[0] for r in user_booking_rides]
    
    if ride_ids:
        # Mark completed rides directly by ride_id
        now = datetime.now(timezone.utc)
        rides_to_mark = db.query(Ride).filter(
            Ride.id.in_(ride_ids),
            Ride.is_active == True
        ).all()
        
        for ride in rides_to_mark:
            try:
                departure_datetime = calculate_departure_datetime(ride)
                if departure_datetime < now:
                    ride.is_active = False
            except Exception:
                continue
        
        if rides_to_mark:
            db.commit()
    
    try:
        # Get all bookings for this user (exclude canceled bookings)
        bookings = db.query(Booking).filter(
            and_(
                Booking.passenger_id == current_user.id,
                Booking.status != BookingStatus.canceled
            )
        ).all()
        
        now = datetime.now(timezone.utc)
        # Get ride details for each booking
        result = []
        for booking in bookings:
            try:
                ride = db.query(Ride).filter(Ride.id == booking.ride_id).first()
                if not ride:
                    continue
                
                # Get the datetime to check if ride has passed (arrival time if available, else departure)
                check_datetime = get_ride_check_datetime(ride)
                
                # Include bookings if:
                # 1. The ride hasn't passed yet (future rides), OR
                # 2. The booking is still pending (user needs to see pending status even if ride passed)
                # 3. The ride is active
                should_include = (
                    ride.is_active and 
                    (check_datetime >= now or booking.status == BookingStatus.pending)
                )
                
                if should_include:
                    driver = db.query(User).filter(User.id == ride.driver_id).first()
                    if not driver:
                        continue
                    
                    # Get driver's average rating (gracefully handle if ratings table doesn't exist)
                    driver_average_rating = None
                    try:
                        from app.ratings import service as ratings_service
                        driver_average_rating = ratings_service.get_user_average_rating(db, driver.id)
                    except Exception as e:
                        # If ratings service fails, just continue without rating
                        print(f"Warning: Could not get rating for driver {driver.id}: {e}")
                        driver_average_rating = None
                    
                    from app.rides.service import calculate_arrival_time_string, _get_ride_passengers, _get_driver_trip_stats
                    arrival_time = calculate_arrival_time_string(ride)
                    
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
                    
                    # Get booking status for this user's booking
                    booking_status = booking.status.value if booking else None
                    
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
                        booking_status=booking_status,  # Add booking status
                    ))
            except Exception as e:
                print(f"Error processing booking {booking.id}: {e}")
                import traceback
                traceback.print_exc()
                # Continue with next booking if this one fails
                continue
        
        return result
    except Exception as e:
        print(f"Error in get_my_bookings: {e}")
        import traceback
        traceback.print_exc()
        # Return empty list instead of crashing
        return []


@router.get("/registro", response_model=List[dict])
def get_ride_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get ride history (past rides) with role indicator (conductor/pasajero)"""
    from datetime import datetime, timezone, timedelta
    from sqlalchemy import and_
    from app.auth.models import Rating
    from app.rides.service import get_ride_check_datetime, calculate_arrival_datetime, calculate_arrival_time_string
    
    now = datetime.now(timezone.utc)
    
    # Get all rides where user was driver
    all_driver_rides = db.query(Ride).filter(
        Ride.driver_id == current_user.id
    ).all()
    
    # Get all bookings where user was passenger (include canceled for registro)
    all_bookings = db.query(Booking).filter(
        Booking.passenger_id == current_user.id
    ).all()
    
    result = []
    
    # Filter driver rides: include past rides OR canceled rides
    # Group by ride_id to show one entry per ride with all passengers
    driver_rides_map = {}  # ride_id -> ride entry
    
    for ride in all_driver_rides:
        # Get the datetime to check if ride has passed (arrival time if available, else departure)
        check_datetime = get_ride_check_datetime(ride)
        
        # Calculate arrival time string for display
        arrival_time = calculate_arrival_time_string(ride)
        
        # Calculate arrival datetime for rating window calculations
        arrival_datetime = calculate_arrival_datetime(ride)
        
        # Include if the ride has passed (based on arrival time) OR if it's canceled
        if check_datetime < now or not ride.is_active:
            driver = db.query(User).filter(User.id == ride.driver_id).first()
            
            # For driver: find all bookings to rate passengers
            # Get all confirmed bookings for this ride (driver can rate each passenger)
            bookings = db.query(Booking).filter(
                and_(
                    Booking.ride_id == ride.id,
                    Booking.status == BookingStatus.confirmed
                )
            ).all()
            
            # Determine status: If ride has confirmed bookings and has passed, it's completed
            # Only mark as cancelled if ride was cancelled AND has no confirmed bookings
            if not ride.is_active and len(bookings) == 0:
                # Ride was cancelled and had no confirmed passengers
                status = "cancelled"
            elif check_datetime < now:
                # Ride has passed (with or without passengers) -> completed
                status = "completed"
            else:
                # Default to completed
                status = "completed"
            
            # Build passengers array for this ride
            passengers = []
            has_pending_ratings = False
            
            if bookings:
                for booking in bookings:
                    has_rated = False
                    can_rate = False
                    
                    if status == "completed":
                        # Check if rating is within 7 days from arrival time
                        rating_reference_time = arrival_datetime if arrival_datetime else check_datetime
                        days_since_ride = (now - rating_reference_time).days
                        within_rating_window = days_since_ride <= 7
                        
                        if within_rating_window:
                            # Driver can rate passengers - check if they've rated this booking
                            try:
                                has_rated = db.query(Rating).filter(
                                    and_(
                                        Rating.booking_id == booking.id,
                                        Rating.rater_id == current_user.id
                                    )
                                ).first() is not None
                                can_rate = not has_rated
                            except Exception:
                                has_rated = False
                                can_rate = False
                        else:
                            has_rated = False
                            can_rate = False
                    else:
                        has_rated = False
                        can_rate = False
                    
                    # Get passenger info for this booking (driver rates passenger)
                    passenger = db.query(User).filter(User.id == booking.passenger_id).first()
                    if not passenger:
                        continue  # Skip if passenger not found
                    
                    passenger_name = passenger.full_name or passenger.email
                    
                    if can_rate:
                        has_pending_ratings = True
                    
                    passengers.append({
                        "booking_id": booking.id,
                        "passenger_id": booking.passenger_id,
                        "passenger_name": passenger_name,
                        "passenger_avatar": passenger.avatar_url,
                        "has_rated": has_rated,
                        "can_rate": can_rate,
                    })
            
            # Create ride entry (one per ride, not per booking)
            driver_rides_map[ride.id] = {
                "id": ride.id,
                "driver_id": ride.driver_id,
                "driver_name": driver.full_name or driver.email,
                "driver_university": driver.university,
                "driver_avatar_url": driver.avatar_url,
                "departure_city": ride.departure_city,
                "departure_lat": ride.departure_lat,
                "departure_lng": ride.departure_lng,
                "destination_city": ride.destination_city,
                "destination_lat": ride.destination_lat,
                "destination_lng": ride.destination_lng,
                "departure_date": ride.departure_date,
                "departure_time": ride.departure_time,
                "arrival_time": arrival_time,
                "available_seats": ride.available_seats,
                "price_per_seat": ride.price_per_seat,
                "vehicle_brand": ride.vehicle_brand,
                "vehicle_color": ride.vehicle_color,
                "additional_details": ride.additional_details,
                "estimated_duration_minutes": ride.estimated_duration_minutes,
                "is_active": ride.is_active,
                "created_at": ride.created_at,
                "role": "conductor",
                "status": status,
                "passengers": passengers,
                "has_pending_ratings": has_pending_ratings,
                # Keep old fields for backward compatibility with passenger rides
                "booking_id": None,
                "has_rated": False,
                "can_rate": False,
            }
    
    # Add all driver rides to result
    result.extend(driver_rides_map.values())
    
    # Filter passenger bookings: include past rides OR canceled rides OR rejected bookings
    for booking in all_bookings:
        ride = db.query(Ride).filter(Ride.id == booking.ride_id).first()
        if ride:
            # Get the datetime to check if ride has passed (arrival time if available, else departure)
            check_datetime = get_ride_check_datetime(ride)
            
            # Calculate arrival time string for display
            arrival_time = calculate_arrival_time_string(ride)
            
            # Calculate arrival datetime for rating window calculations
            arrival_datetime = calculate_arrival_datetime(ride)
            
            # Include if the ride has passed (based on arrival time) OR if it's canceled OR if booking is rejected
            is_rejected = booking.status == BookingStatus.rejected
            is_canceled = booking.status == BookingStatus.canceled
            if check_datetime < now or not ride.is_active or is_rejected or is_canceled:
                driver = db.query(User).filter(User.id == ride.driver_id).first()
                # Determine status: ALWAYS prioritize trip status over booking status
                # Trip status is the source of truth
                if not ride.is_active:
                    # Trip was cancelled by driver
                    status = "cancelled"
                elif check_datetime < now:
                    # Trip has passed and is still active -> completed
                    status = "completed"
                elif is_rejected:
                    # Booking was rejected (but trip is still active/upcoming)
                    status = "rejected"
                elif is_canceled:
                    # Booking was cancelled by passenger (but trip might still be active)
                    status = "cancelled"
                else:
                    # Default to completed for past rides
                    status = "completed"
                
                # For passenger: check if they've rated the driver
                has_rated = False
                can_rate = False
                
                if status == "completed":
                    # Check if rating is within 7 days from arrival time
                    # Use arrival time if available, otherwise use departure time
                    rating_reference_time = arrival_datetime if arrival_datetime else check_datetime
                    days_since_ride = (now - rating_reference_time).days
                    within_rating_window = days_since_ride <= 7
                    
                    if within_rating_window:
                        try:
                            has_rated = db.query(Rating).filter(
                                and_(
                                    Rating.booking_id == booking.id,
                                    Rating.rater_id == current_user.id
                                )
                            ).first() is not None
                            can_rate = not has_rated
                        except Exception:
                            # If ratings table doesn't exist, default to False
                            has_rated = False
                            can_rate = False
                    else:
                        # Outside 7-day window
                        has_rated = False
                        can_rate = False
                else:
                    # Ride not completed (cancelled)
                    has_rated = False
                    can_rate = False
                
                # Include driver profile info for rating modal (passenger rates driver)
                # This is the person BEING RATED by the passenger
                if not driver:
                    continue  # Skip if driver not found
                
                driver_name = driver.full_name or driver.email
                rated_user_info = {
                    "rated_user_id": ride.driver_id,
                    "rated_user_name": driver_name,
                    "rated_user_avatar": driver.avatar_url,
                }
                
                result.append({
                    "id": ride.id,
                    "driver_id": ride.driver_id,
                    "driver_name": driver.full_name or driver.email,
                    "driver_university": driver.university,
                    "driver_avatar_url": driver.avatar_url,
                    "departure_city": ride.departure_city,
                    "departure_lat": ride.departure_lat,
                    "departure_lng": ride.departure_lng,
                    "destination_city": ride.destination_city,
                    "destination_lat": ride.destination_lat,
                    "destination_lng": ride.destination_lng,
                    "departure_date": ride.departure_date,
                    "departure_time": ride.departure_time,
                    "arrival_time": arrival_time,
                    "available_seats": ride.available_seats,
                    "price_per_seat": ride.price_per_seat,
                    "vehicle_brand": ride.vehicle_brand,
                    "vehicle_color": ride.vehicle_color,
                    "additional_details": ride.additional_details,
                    "estimated_duration_minutes": ride.estimated_duration_minutes,
                    "is_active": ride.is_active,
                    "created_at": ride.created_at,
                    "role": "pasajero",
                    "status": status,
                    "booking_id": booking.id,
                    "has_rated": has_rated,
                    "can_rate": can_rate,
                    **rated_user_info
                })
    
    # Sort by departure date (most recent first)
    result.sort(key=lambda x: (x["departure_date"], x["departure_time"]), reverse=True)
    
    return result


# --- Favorite Rides Endpoints ---
# These must come before /{ride_id} routes to avoid routing conflicts

@router.post("/favorites", response_model=FavoriteRideOut)
def create_favorite_ride(
    favorite_data: FavoriteRideCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new favorite ride"""
    try:
        return favorites_service.create_favorite_ride(db, favorite_data, current_user.id)
    except Exception as e:
        import traceback
        print(f"Error creating favorite ride: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error creating favorite ride: {str(e)}")


@router.get("/favorites", response_model=List[FavoriteRideOut])
def get_my_favorite_rides(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all favorite rides for the current user"""
    return favorites_service.get_user_favorite_rides(db, current_user.id)


@router.get("/favorites/{favorite_id}", response_model=FavoriteRideOut)
def get_favorite_ride(
    favorite_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific favorite ride by ID"""
    favorite = favorites_service.get_favorite_ride(db, favorite_id, current_user.id)
    if not favorite:
        raise HTTPException(status_code=404, detail="Favorite ride not found")
    return favorite


@router.delete("/favorites/{favorite_id}")
def delete_favorite_ride(
    favorite_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a favorite ride"""
    success = favorites_service.delete_favorite_ride(db, favorite_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Favorite ride not found")
    return {"message": "Favorite ride deleted successfully"}


@router.get("/{ride_id}", response_model=RideOut)
def get_ride(
    ride_id: int,
    db: Session = Depends(get_db),
):
    """Get a specific ride by ID"""
    # Mark as completed if needed before fetching
    from app.rides.service import calculate_departure_datetime
    from datetime import timezone
    from app.auth.models import Ride
    
    ride_obj = db.query(Ride).filter(Ride.id == ride_id).first()
    if ride_obj and ride_obj.is_active:
        try:
            now = datetime.now(timezone.utc)
            departure_datetime = calculate_departure_datetime(ride_obj)
            if departure_datetime < now:
                ride_obj.is_active = False
                db.commit()
        except Exception:
            pass  # Continue even if marking fails
    
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
    """Book a ride - creates booking in pending status, waiting for driver confirmation"""
    # Validate profile is complete before allowing booking
    if not is_profile_complete(current_user):
        raise HTTPException(
            status_code=400,
            detail="Debes completar tu perfil antes de reservar un viaje."
        )
    # Check if ride exists
    ride = db.query(Ride).filter(Ride.id == ride_id, Ride.is_active == True).first()
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    # Check if user is trying to book their own ride
    if ride.driver_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot book your own ride")
    
    # Check if user already has a pending or confirmed booking for this ride
    existing_booking = db.query(Booking).filter(
        Booking.ride_id == ride_id,
        Booking.passenger_id == current_user.id,
        Booking.status.in_([BookingStatus.pending, BookingStatus.confirmed])
    ).first()
    if existing_booking:
        raise HTTPException(status_code=400, detail="You already have a booking for this ride")
    
    # OVERBOOKING CONTROLADO: Permitir crear reservas PENDING sin verificar capacidad
    # Solo verificamos que el viaje tenga al menos 1 asiento disponible para mostrar que hay capacidad
    # Las reservas PENDING no consumen asientos; solo las CONFIRMED lo hacen
    if ride.available_seats <= 0:
        raise HTTPException(status_code=400, detail="This ride has no available seats")
    
    try:
        print(f"[BOOKING CREATION] Creating pending booking for user {current_user.id} on ride {ride_id} ({seats} seats)")
        # Create booking record in pending status
        # IMPORTANTE: No decrementamos available_seats aquí porque la reserva está en PENDING
        booking = Booking(
            ride_id=ride_id,
            passenger_id=current_user.id,
            status=BookingStatus.pending,
            seats=seats,
        )
        db.add(booking)
        db.commit()
        db.refresh(booking)
        
        print(f"[BOOKING CREATION] ✅ Created pending booking {booking.id} for user {current_user.id} on ride {ride_id}")
        
        # Send email to driver about new booking request
        try:
            from app.core.email import send_new_booking_request_email_sync
            
            driver = db.query(User).filter(User.id == ride.driver_id).first()
            if driver and driver.email:
                # Format date for email
                departure_date_str = ride.departure_date.strftime("%d/%m/%Y") if ride.departure_date else "N/A"
                
                send_new_booking_request_email_sync(
                    to_email=driver.email,
                    driver_name=driver.full_name or driver.email.split("@")[0],
                    passenger_name=current_user.full_name or current_user.email.split("@")[0],
                    departure_city=ride.departure_city,
                    destination_city=ride.destination_city,
                    departure_date=departure_date_str,
                    departure_time=ride.departure_time,
                    seats=seats,
                )
                print(f"[BOOKING CREATION] ✅ Email sent to driver {driver.email}")
            else:
                print(f"[BOOKING CREATION] ⚠️ Driver email not available, skipping email")
        except Exception as email_error:
            # Don't fail booking creation if email fails
            print(f"[BOOKING CREATION] ⚠️ Error sending email to driver: {email_error}")
            log.error(f"[BOOKING CREATION] Error sending email: {email_error}", exc_info=True)
        
        # Return success with pending status
        return {"success": True, "status": "pending", "booking_id": booking.id}
    except Exception as e:
        db.rollback()
        print(f"Error creating booking: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create booking: {str(e)}")


@router.post("/{ride_id}/cancel")
def cancel_ride(
    ride_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cancel a ride (driver can cancel their own ride)"""
    ride = db.query(Ride).filter(Ride.id == ride_id).first()
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    # Check if user is the driver
    if ride.driver_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only cancel your own rides")
    
    try:
        # Cancel the ride
        ride.is_active = False
        
        # Get all confirmed bookings for this ride to notify passengers
        confirmed = (
            db.query(Booking)
            .filter(
                Booking.ride_id == ride_id,
                Booking.status == BookingStatus.confirmed
            )
            .all()
        )
        
        # Create notifications for all confirmed passengers (same logic as when passenger cancels)
        for booking in confirmed:
            notification = Notification(
                receiver_id=booking.passenger_id,
                type="ride_cancelled_by_driver",
                ride_id=ride.id,
                message=f"El conductor ha cancelado el viaje {ride.departure_city} → {ride.destination_city}.",
            )
            db.add(notification)
        
        db.commit()
        db.refresh(ride)
        
        return {"message": "Ride canceled successfully", "ride_id": ride_id}
    except Exception as e:
        db.rollback()
        print(f"Error canceling ride: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to cancel ride: {str(e)}")


@router.post("/{ride_id}/cancel-booking")
def cancel_booking(
    ride_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cancel a booking (passenger can cancel their reservation)"""
    # Find the booking
    booking = db.query(Booking).filter(
        Booking.ride_id == ride_id,
        Booking.passenger_id == current_user.id,
        Booking.status != BookingStatus.canceled
    ).first()
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Get the ride to restore seats
    ride = db.query(Ride).filter(Ride.id == ride_id).first()
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    try:
        # Use centralized cancellation function
        from app.bookings.service import cancel_booking_from_passenger
        
        cancel_booking_from_passenger(
            db=db,
            booking=booking,
            reason="",
            final_status=BookingStatus.canceled,
            background_tasks=background_tasks,
        )
        
        # Refresh ride to get updated available_seats
        db.refresh(ride)
        
        return {
            "message": "Booking canceled successfully", 
            "ride_id": ride_id, 
            "available_seats": ride.available_seats
        }
    except Exception as e:
        db.rollback()
        print(f"Error canceling booking: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to cancel booking: {str(e)}")


@router.post("/{ride_id}/complete", response_model=CompleteRideResponse)
def complete_ride(
    ride_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Mark a ride as completed and capture all pending payments.
    Only the driver can complete their own ride.
    
    This will:
    - Mark ride as inactive (is_active=False)
    - Capture all PaymentIntents for confirmed bookings
    - Calculate and save app commission and driver amounts
    """
    ride = db.query(Ride).filter(Ride.id == ride_id).first()
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    # Check if user is the driver
    if ride.driver_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="Only the driver can complete their own ride"
        )
    
    try:
        # Mark ride as inactive
        ride.is_active = False
        
        # Get all confirmed bookings for this ride
        confirmed_bookings = db.query(Booking).filter(
            Booking.ride_id == ride_id,
            Booking.status == BookingStatus.confirmed
        ).all()
        
        total_captured = 0
        total_app_fee = 0
        total_driver_amount = 0
        
        # Capture payments for each confirmed booking
        for booking in confirmed_bookings:
            try:
                from app.payments.models import Payment, PaymentStatus
                from app.payments.service import get_app_commission_percent
                
                import stripe
                if not stripe.api_key:
                    log.info(f"[COMPLETE RIDE] Stripe not enabled, skipping payment capture for booking {booking.id}")
                    continue
                
                # Get payment record
                payment = db.query(Payment).filter(Payment.booking_id == booking.id).first()
                if not payment or not payment.stripe_payment_intent_id:
                    log.info(f"[COMPLETE RIDE] No payment found for booking {booking.id}, skipping")
                    continue
                
                # Check if already captured
                if payment.status == PaymentStatus.succeeded:
                    log.info(f"[COMPLETE RIDE] Payment {payment.id} already captured")
                    continue
                
                # Capture PaymentIntent
                pi = stripe.PaymentIntent.retrieve(payment.stripe_payment_intent_id)
                if pi.status == "requires_capture":
                    captured_pi = stripe.PaymentIntent.capture(payment.stripe_payment_intent_id)
                    
                    # Calculate app commission and driver amount
                    commission_percent = get_app_commission_percent()
                    app_fee_cents = int(payment.amount_cents * commission_percent)
                    driver_amount_cents = payment.amount_cents - app_fee_cents
                    
                    # Update payment record
                    payment.status = PaymentStatus.succeeded
                    payment.app_fee_cents = app_fee_cents
                    payment.driver_amount_cents = driver_amount_cents
                    payment.captured_at = datetime.now(timezone.utc)
                    
                    total_captured += payment.amount_cents
                    total_app_fee += app_fee_cents
                    total_driver_amount += driver_amount_cents
                    
                    log.info(
                        f"[COMPLETE RIDE] Captured payment {payment.id}: "
                        f"{payment.amount_cents} cents (app_fee: {app_fee_cents}, driver: {driver_amount_cents})"
                    )
                    
                    # TRANSFER TO DRIVER (Stripe Connect)
                    # Send driver_amount_cents to driver's Stripe Connect account
                    try:
                        driver = db.query(User).filter(User.id == ride.driver_id).first()
                        
                        log.info(f"[COMPLETE RIDE] [TRANSFER] Starting transfer process for driver {ride.driver_id}")
                        log.info(f"[COMPLETE RIDE] [TRANSFER] Driver found: {driver is not None}")
                        log.info(f"[COMPLETE RIDE] [TRANSFER] Driver stripe_account_id: {driver.stripe_account_id if driver else 'N/A'}")
                        log.info(f"[COMPLETE RIDE] [TRANSFER] Amount to transfer: {driver_amount_cents} cents")
                        
                        if driver and driver.stripe_account_id:
                            # Verify account status before creating transfer
                            try:
                                account = stripe.Account.retrieve(driver.stripe_account_id)
                                log.info(f"[COMPLETE RIDE] [TRANSFER] Account status: {account.id}")
                                log.info(f"[COMPLETE RIDE] [TRANSFER] Account capabilities.transfers: {account.capabilities.get('transfers', {})}")
                                log.info(f"[COMPLETE RIDE] [TRANSFER] Account charges_enabled: {account.charges_enabled}")
                                log.info(f"[COMPLETE RIDE] [TRANSFER] Account payouts_enabled: {account.payouts_enabled}")
                                
                                if account.capabilities.get('transfers') != 'active':
                                    log.warning(
                                        f"[COMPLETE RIDE] [TRANSFER] Account {driver.stripe_account_id} transfers capability "
                                        f"is not active: {account.capabilities.get('transfers')}"
                                    )
                            except Exception as account_error:
                                log.error(f"[COMPLETE RIDE] [TRANSFER] Error retrieving account: {account_error}")
                            
                            # Create transfer to driver's Connect account
                            log.info(f"[COMPLETE RIDE] [TRANSFER] Creating transfer...")
                            transfer = stripe.Transfer.create(
                                amount=driver_amount_cents,
                                currency="eur",
                                destination=driver.stripe_account_id,
                                transfer_group=f"trip_{ride_id}",
                                metadata={
                                    "ride_id": str(ride_id),
                                    "booking_id": str(booking.id),
                                    "driver_id": str(driver.id),
                                    "payment_id": str(payment.id),
                                }
                            )
                            log.info(
                                f"[COMPLETE RIDE] [TRANSFER] ✅ Transfer created successfully!"
                            )
                            log.info(f"[COMPLETE RIDE] [TRANSFER] Transfer ID: {transfer.id}")
                            log.info(f"[COMPLETE RIDE] [TRANSFER] Transfer amount: {transfer.amount} cents")
                            log.info(f"[COMPLETE RIDE] [TRANSFER] Transfer destination: {transfer.destination}")
                            log.info(f"[COMPLETE RIDE] [TRANSFER] Transfer status: {transfer.get('status', 'N/A')}")
                        else:
                            log.warning(
                                f"[COMPLETE RIDE] [TRANSFER] Cannot create transfer: "
                                f"driver={driver is not None}, stripe_account_id={driver.stripe_account_id if driver else 'N/A'}"
                            )
                    except stripe.error.StripeError as stripe_error:
                        log.error(
                            f"[COMPLETE RIDE] [TRANSFER] ❌ Stripe error creating transfer: {stripe_error}",
                            exc_info=True
                        )
                        log.error(f"[COMPLETE RIDE] [TRANSFER] Stripe error type: {type(stripe_error).__name__}")
                        log.error(f"[COMPLETE RIDE] [TRANSFER] Stripe error message: {str(stripe_error)}")
                    except Exception as transfer_error:
                        log.error(
                            f"[COMPLETE RIDE] [TRANSFER] ❌ Unexpected error creating transfer: {transfer_error}",
                            exc_info=True
                        )
                    
                else:
                    log.warning(
                        f"[COMPLETE RIDE] PaymentIntent {payment.stripe_payment_intent_id} "
                        f"status is {pi.status}, cannot capture"
                    )
                    
            except Exception as e:
                log.error(
                    f"[COMPLETE RIDE] Error capturing payment for booking {booking.id}: {e}",
                    exc_info=True
                )
                # Continue with other bookings even if one fails
        
        # Commit all changes
        db.commit()
        db.refresh(ride)
        
        log.info(
            f"[COMPLETE RIDE] ✅ Ride {ride_id} completed. "
            f"Captured {len([b for b in confirmed_bookings if db.query(Payment).filter(Payment.booking_id == b.id).first()])} payments"
        )
        
        return CompleteRideResponse(
            success=True,
            message=f"Ride completed successfully. Captured {len(confirmed_bookings)} payment(s).",
            payment_captured=total_captured > 0,
            app_fee_cents=total_app_fee if total_captured > 0 else None,
            driver_amount_cents=total_driver_amount if total_captured > 0 else None,
        )
        
    except Exception as e:
        db.rollback()
        log.error(f"[COMPLETE RIDE] ❌ Error completing ride {ride_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to complete ride: {str(e)}"
        )


@router.get("/{ride_id}/passengers", response_model=List[Passenger])
def get_ride_passengers(
    ride_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get passengers for a ride (only driver can access)"""
    ride = db.query(Ride).filter(Ride.id == ride_id).first()
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    if ride.driver_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the driver can view passengers")
    
    bookings = db.query(Booking).filter(
        and_(
            Booking.ride_id == ride_id,
            Booking.status == BookingStatus.confirmed
        )
    ).all()
    
    passengers = []
    for booking in bookings:
        passenger = db.query(User).filter(User.id == booking.passenger_id).first()
        if passenger:
            passengers.append(Passenger(
                booking_id=booking.id,
                passenger_id=passenger.id,
                passenger_name=passenger.full_name or passenger.email,
                passenger_avatar=passenger.avatar_url,
                has_rated=False,  # We could check this if needed
                can_rate=False,   # We could check this if needed
            ))
    
    return passengers