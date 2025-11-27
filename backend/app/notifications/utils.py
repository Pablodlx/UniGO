from sqlalchemy.orm import Session
from app.auth.models import Notification


def create_notification(
    db: Session,
    receiver_id: int,
    type: str,
    message: str,
    ride_id: int | None = None,
    title: str | None = None,  # Not used in current model, but kept for compatibility
) -> Notification:
    """
    Create a notification for a user.
    
    Args:
        db: Database session
        receiver_id: ID of the user who will receive the notification
        type: Type of notification (e.g., "ride_cancelled", "booking_update")
        message: Notification message text
        ride_id: Optional ride ID associated with the notification
        title: Optional title (not stored in current model, kept for API compatibility)
    
    Returns:
        The created Notification object
    """
    notification = Notification(
        receiver_id=receiver_id,
        type=type,
        message=message,
        ride_id=ride_id,
    )
    db.add(notification)
    return notification

