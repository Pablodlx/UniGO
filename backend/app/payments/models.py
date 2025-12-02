"""
Payment models for Stripe integration.
"""
import enum
from datetime import UTC, datetime
from typing import Optional
from sqlalchemy import Integer, String, Float, ForeignKey, DateTime, Enum as SQLEnum, BigInteger
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base

# Forward reference types
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from app.auth.models import Booking


class PaymentStatus(str, enum.Enum):
    """Payment status enum matching Stripe PaymentIntent statuses"""
    requires_payment_method = "requires_payment_method"
    requires_confirmation = "requires_confirmation"
    requires_action = "requires_action"
    processing = "processing"
    requires_capture = "requires_capture"  # PaymentIntent with manual capture
    canceled = "canceled"
    succeeded = "succeeded"
    refunded = "refunded"
    partially_refunded = "partially_refunded"


class Payment(Base):
    """Payment model for tracking Stripe payments"""
    __tablename__ = "payments"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id"), nullable=False, index=True)
    
    # Stripe IDs
    stripe_customer_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    stripe_payment_method_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    stripe_payment_intent_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, unique=True, index=True)
    
    # Payment amounts (in cents)
    amount_cents: Mapped[int] = mapped_column(BigInteger, nullable=False)  # Total amount
    currency: Mapped[str] = mapped_column(String(3), default="eur", nullable=False)
    
    # Payment status
    status: Mapped[PaymentStatus] = mapped_column(SQLEnum(PaymentStatus), nullable=False, index=True)
    
    # Fee breakdown (in cents)
    app_fee_cents: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)  # Platform commission
    driver_amount_cents: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)  # Amount to driver
    
    # Penalties (in cents)
    penalty_cents: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)  # Passenger penalty
    driver_penalty_cents: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)  # Driver penalty
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC), nullable=False
    )
    captured_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    booking: Mapped["Booking"] = relationship("Booking", back_populates="payment")

