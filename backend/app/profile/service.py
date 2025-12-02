import hashlib
import os

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.auth.models import User
from app.profile.schemas import ProfileOut, ProfileUpdate
from app.ratings import service as ratings_service

AVATAR_DIR = os.getenv("AVATAR_DIR", "data/avatars")
PUBLIC_PREFIX = os.getenv("AVATAR_PUBLIC_PREFIX", "/static/avatars")
REQUIRED = ("full_name", "university", "degree", "course")


def get_profile(db: Session, user: User) -> ProfileOut:
    from app.profile.schemas import HomeAddress
    from app.auth.models import Ride, Booking, BookingStatus
    from datetime import datetime, timezone
    
    # Calculate average rating and rating count
    average_rating = ratings_service.get_user_average_rating(db, user.id)
    rating_count = ratings_service.get_rating_count(db, user.id)
    
    # Set display text for average rating
    average_rating_display = "No hay valoraciones" if average_rating is None else str(average_rating)
    
    # Calculate completed driver trips
    # Viaje completado como conductor = ride.driver_id == user.id AND ride.is_active == True 
    # AND departure_date + departure_time < now
    now = datetime.now(timezone.utc)
    completed_driver_trips = db.query(Ride).filter(
        Ride.driver_id == user.id,
        Ride.is_active == True,
        Ride.departure_date < now
    ).count()
    
    # Calculate completed passenger trips
    # Viaje completado como pasajero = booking.passenger_id == user.id 
    # AND booking.status == "confirmed" AND ride.departure_date < now
    completed_passenger_trips = db.query(Booking).join(Ride).filter(
        Booking.passenger_id == user.id,
        Booking.status == BookingStatus.confirmed,
        Ride.departure_date < now
    ).count()
    
    # Build home address if available
    home_address = None
    if user.home_address_formatted and user.home_address_place_id:
        home_address = HomeAddress(
            formatted_address=user.home_address_formatted,
            place_id=user.home_address_place_id,
            lat=user.home_address_lat or 0.0,
            lng=user.home_address_lng or 0.0,
        )
    
    return ProfileOut(
        email=user.email,
        full_name=user.full_name,
        university=user.university,
        degree=user.degree,
        course=user.course,
        home_address=home_address,
        avatar_url=user.avatar_url,
        average_rating=average_rating,
        rating_count=rating_count,
        average_rating_display=average_rating_display,
        completed_driver_trips=completed_driver_trips,
        completed_passenger_trips=completed_passenger_trips,
        stripe_account_id=user.stripe_account_id,  # Include Stripe Connect account ID
    )


def update_profile(db: Session, user: User, payload: ProfileUpdate) -> ProfileOut:
    # Handle home_address first, before converting to dict
    from app.profile.schemas import HomeAddress
    
    if payload.home_address:
        # home_address is a HomeAddress Pydantic model
        user.home_address_formatted = payload.home_address.formatted_address
        user.home_address_place_id = payload.home_address.place_id
        user.home_address_lat = payload.home_address.lat
        user.home_address_lng = payload.home_address.lng
    else:
        # home_address is None or not provided
        user.home_address_formatted = None
        user.home_address_place_id = None
        user.home_address_lat = None
        user.home_address_lng = None
    
    # Use model_dump for Pydantic v2 compatibility (or dict() for v1)
    try:
        data = payload.model_dump(exclude_unset=True, exclude={"home_address", "university"})
    except AttributeError:
        # Fallback for Pydantic v1
        data = payload.dict(exclude_unset=True, exclude={"home_address", "university"})
    
    # University is auto-detected from email and cannot be edited
    data.pop("university", None)
    data.pop("home_address", None)
    
    # Set other fields
    for k, v in data.items():
        setattr(user, k, v)

    # Validación extra RF-02 por si el validator se cambia
    missing = [k for k in REQUIRED if getattr(user, k, None) in (None, "", 0)]
    
    # Validate home_address - all fields must be present together
    has_home_address = bool(user.home_address_formatted and user.home_address_place_id and user.home_address_lat is not None and user.home_address_lng is not None)
    if not has_home_address:
        missing.append("home_address")
    
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Faltan campos obligatorios: {', '.join(missing)}",
        )

    db.add(user)
    db.commit()
    db.refresh(user)
    return get_profile(db, user)


async def upload_avatar(db: Session, user: User, file: UploadFile) -> ProfileOut:
    # Simple validation: check if it's an image
    content_type = file.content_type or ""
    if not content_type.startswith("image/"):
        raise HTTPException(
            status_code=400, 
            detail="El archivo debe ser una imagen"
        )

    os.makedirs(AVATAR_DIR, exist_ok=True)
    raw = await file.read()
    
    # Optional: validate file size (max 5MB)
    max_size = 5 * 1024 * 1024  # 5MB
    if len(raw) > max_size:
        raise HTTPException(
            status_code=400,
            detail="El archivo es demasiado grande. El tamaño máximo es 5MB."
        )
    
    # Generate filename
    digest = hashlib.sha256(raw).hexdigest()[:16]
    # Get extension from content type or filename
    if content_type == "image/png":
        ext = ".png"
    elif content_type in {"image/jpeg", "image/jpg"}:
        ext = ".jpg"
    else:
        # Fallback: try to get from filename
        filename = file.filename or ""
        if filename.lower().endswith(".png"):
            ext = ".png"
        else:
            ext = ".jpg"  # Default to jpg
    
    fname = f"{user.id}_{digest}{ext}"
    filepath = os.path.join(AVATAR_DIR, fname)
    
    # Save file
    with open(filepath, "wb") as f:
        f.write(raw)

    # Update user avatar_url
    user.avatar_url = f"{PUBLIC_PREFIX}/{fname}"
    db.add(user)
    db.commit()
    db.refresh(user)
    
    # Return profile with updated avatar_url
    return get_profile(db, user)
