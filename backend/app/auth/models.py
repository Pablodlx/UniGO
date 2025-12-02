import enum
from datetime import UTC, datetime

from typing import Optional
from sqlalchemy import Boolean, Column, DateTime, Enum, Integer, String, Text, Float, ForeignKey, UniqueConstraint, ARRAY, Time, Date
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class RideIntent(str, enum.Enum):
    offers = "offers"
    seeks = "seeks"
    both = "both"


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    full_name = Column(String(150), nullable=True)
    university = Column(String(150), nullable=True)
    degree = Column(String(150), nullable=True)
    course = Column(Integer, nullable=True)
    home_address_formatted = Column(String(500), nullable=True)
    home_address_place_id = Column(String(255), nullable=True)
    home_address_lat = Column(Float, nullable=True)
    home_address_lng = Column(Float, nullable=True)
    avatar_url = Column(String(300), nullable=True)
    # Stripe fields
    stripe_customer_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    stripe_payment_method_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    # Blocked trips: list of trip IDs that this user has cancelled and should not see again
    blocked_trip_ids: Mapped[Optional[list[int]]] = mapped_column(ARRAY(Integer), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    
    # Relationships
    rides: Mapped[list["Ride"]] = relationship("Ride", back_populates="driver")
    bookings: Mapped[list["Booking"]] = relationship("Booking", back_populates="passenger")
    ratings_given: Mapped[list["Rating"]] = relationship("Rating", foreign_keys="Rating.rater_id", back_populates="rater")
    ratings_received: Mapped[list["Rating"]] = relationship("Rating", foreign_keys="Rating.rated_id", back_populates="rated")
    favorite_rides: Mapped[list["FavoriteRide"]] = relationship("FavoriteRide", back_populates="user")


class EmailCode(Base):
    __tablename__ = "email_codes"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    code: Mapped[str] = mapped_column(String(10), nullable=False)
    purpose: Mapped[str] = mapped_column(String(50), default="verify_email", nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    consumed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )


class BookingStatus(str, enum.Enum):
    pending = "pending"
    confirmed = "confirmed"
    rejected = "rejected"
    canceled = "canceled"


class Ride(Base):
    __tablename__ = "rides"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    driver_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    departure_city: Mapped[str] = mapped_column(String(100), nullable=False)
    destination_city: Mapped[str] = mapped_column(String(100), nullable=False)
    departure_lat: Mapped[float] = mapped_column(Float, nullable=True)
    departure_lng: Mapped[float] = mapped_column(Float, nullable=True)
    destination_lat: Mapped[float] = mapped_column(Float, nullable=True)
    destination_lng: Mapped[float] = mapped_column(Float, nullable=True)
    estimated_duration_minutes: Mapped[int] = mapped_column(Integer, nullable=True)
    departure_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    departure_time: Mapped[str] = mapped_column(String(10), nullable=False)  # "HH:MM" format
    available_seats: Mapped[int] = mapped_column(Integer, nullable=False)
    price_per_seat: Mapped[float] = mapped_column(Float, nullable=False)
    vehicle_brand: Mapped[str] = mapped_column(String(100), nullable=True)
    vehicle_color: Mapped[str] = mapped_column(String(50), nullable=True)
    additional_details: Mapped[str] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    
    # Relationship to User
    driver: Mapped["User"] = relationship("User", back_populates="rides")
    # Relationship to Bookings
    bookings: Mapped[list["Booking"]] = relationship("Booking", back_populates="ride")
    # Relationship to Group Messages
    group_messages: Mapped[list["TripGroupMessage"]] = relationship("TripGroupMessage", back_populates="trip")


class Booking(Base):
    __tablename__ = "bookings"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    ride_id: Mapped[int] = mapped_column(ForeignKey("rides.id"), nullable=False)
    passenger_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    status: Mapped[BookingStatus] = mapped_column(Enum(BookingStatus), default=BookingStatus.pending, nullable=False)
    seats: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    search_alert_id: Mapped[Optional[int]] = mapped_column(ForeignKey("search_alerts.id"), nullable=True, index=True)  # ID of the alert that created this booking
    created_by_alert: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)  # Flag to identify automatic bookings
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    
    # Relationships
    ride: Mapped["Ride"] = relationship("Ride", back_populates="bookings")
    passenger: Mapped["User"] = relationship("User", back_populates="bookings")
    ratings: Mapped[list["Rating"]] = relationship("Rating", back_populates="booking")
    search_alert: Mapped[Optional["SearchAlert"]] = relationship("SearchAlert", foreign_keys=[search_alert_id])
    payment: Mapped[Optional["Payment"]] = relationship("Payment", back_populates="booking", uselist=False)


class Rating(Base):
    __tablename__ = "ratings"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id"), nullable=False)
    rater_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)  # Who gave the rating
    rated_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)  # Who was rated
    rating: Mapped[int] = mapped_column(Integer, nullable=False)  # 1-5 stars
    comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # Optional text review
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    
    # Relationships
    booking: Mapped["Booking"] = relationship("Booking", back_populates="ratings")
    rater: Mapped["User"] = relationship("User", foreign_keys=[rater_id], back_populates="ratings_given")
    rated: Mapped["User"] = relationship("User", foreign_keys=[rated_id], back_populates="ratings_received")
    
    # Unique constraint: one rating per booking per rater
    __table_args__ = (
        UniqueConstraint('booking_id', 'rater_id', name='uq_rating_booking_rater'),
    )


class TripGroupMessage(Base):
    __tablename__ = "trip_group_messages"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    trip_id: Mapped[int] = mapped_column(ForeignKey("rides.id"), nullable=False, index=True)
    sender_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    sender_name: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    
    # Relationships
    trip: Mapped["Ride"] = relationship("Ride", back_populates="group_messages")
    sender: Mapped["User"] = relationship("User")


class FavoriteRide(Base):
    __tablename__ = "favorite_rides"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    # Store ride template data as JSON fields
    departure_city: Mapped[str] = mapped_column(String(100), nullable=False)
    destination_city: Mapped[str] = mapped_column(String(100), nullable=False)
    departure_lat: Mapped[float] = mapped_column(Float, nullable=True)
    departure_lng: Mapped[float] = mapped_column(Float, nullable=True)
    destination_lat: Mapped[float] = mapped_column(Float, nullable=True)
    destination_lng: Mapped[float] = mapped_column(Float, nullable=True)
    departure_time: Mapped[str] = mapped_column(String(10), nullable=True)  # "HH:MM" format (optional, might not always be the same)
    available_seats: Mapped[int] = mapped_column(Integer, nullable=True)
    price_per_seat: Mapped[float] = mapped_column(Float, nullable=True)
    vehicle_brand: Mapped[str] = mapped_column(String(100), nullable=True)
    vehicle_color: Mapped[str] = mapped_column(String(50), nullable=True)
    additional_details: Mapped[str] = mapped_column(Text, nullable=True)
    # Store address objects as JSON strings for easy frontend use
    from_address: Mapped[str] = mapped_column(Text, nullable=True)  # JSON string of AddressData
    to_address: Mapped[str] = mapped_column(Text, nullable=True)  # JSON string of AddressData
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    
    # Relationship to User
    user: Mapped["User"] = relationship("User", back_populates="favorite_rides")


class Message(Base):
    __tablename__ = "messages"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    trip_id: Mapped[int] = mapped_column(ForeignKey("rides.id"), nullable=False, index=True)
    sender_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    receiver_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False, index=True
    )
    read_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    
    # Relationships
    trip: Mapped["Ride"] = relationship("Ride", foreign_keys=[trip_id])
    sender: Mapped["User"] = relationship("User", foreign_keys=[sender_id])
    receiver: Mapped["User"] = relationship("User", foreign_keys=[receiver_id])


class Notification(Base):
    __tablename__ = "notifications"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    receiver_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    type: Mapped[str] = mapped_column(String(50), nullable=False)  # e.g., "booking_confirmed"
    ride_id: Mapped[Optional[int]] = mapped_column(ForeignKey("rides.id"), nullable=True, index=True)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False, index=True
    )
    read_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    
    # Relationships
    receiver: Mapped["User"] = relationship("User", foreign_keys=[receiver_id])
    ride: Mapped[Optional["Ride"]] = relationship("Ride", foreign_keys=[ride_id])


class SearchAlert(Base):
    __tablename__ = "search_alerts"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    origin: Mapped[str] = mapped_column(String(100), nullable=False)
    destination: Mapped[str] = mapped_column(String(100), nullable=False)
    origin_lat: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # Origin latitude
    origin_lng: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # Origin longitude
    destination_lat: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # Destination latitude
    destination_lng: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # Destination longitude
    target_time: Mapped[str] = mapped_column(String(10), nullable=False)  # Time of day in "HH:MM" format
    days_of_week: Mapped[list[int]] = mapped_column(ARRAY(Integer), nullable=True)  # 0-6 (Monday-Sunday), nullable
    specific_dates: Mapped[list] = mapped_column(ARRAY(Date), nullable=True)  # Specific dates, nullable
    flexibility_minutes: Mapped[int] = mapped_column(Integer, default=30, nullable=False)  # Minutes before/after target_time
    allow_nearby_search: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)  # Allow searching trips within 1 km
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    
    # Relationship to User
    user: Mapped["User"] = relationship("User")
