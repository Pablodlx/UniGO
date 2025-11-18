from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.models import User
from app.auth.router import get_current_user
from app.db.session import get_db
from app.ratings import service
from app.ratings.schemas import RatingCreate, RatingOut, RatingWithNames

router = APIRouter(prefix="/ratings", tags=["Ratings"])


@router.post("/", response_model=RatingOut, status_code=status.HTTP_201_CREATED)
def create_rating(
    rating_data: RatingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a rating for a completed booking"""
    return service.create_rating(
        db=db,
        booking_id=rating_data.booking_id,
        rater_id=current_user.id,
        rating=rating_data.rating,
        comment=rating_data.comment
    )


@router.get("/user/{user_id}", response_model=List[RatingWithNames])
def get_user_ratings(
    user_id: int,
    db: Session = Depends(get_db),
):
    """Get all ratings received by a specific user"""
    ratings = service.get_user_ratings(db, user_id)
    
    # Enrich with user names
    result = []
    for rating in ratings:
        rater = db.query(User).filter(User.id == rating.rater_id).first()
        rated = db.query(User).filter(User.id == rating.rated_id).first()
        
        result.append(RatingWithNames(
            id=rating.id,
            booking_id=rating.booking_id,
            rater_id=rating.rater_id,
            rated_id=rating.rated_id,
            rating=rating.rating,
            comment=rating.comment,
            created_at=rating.created_at,
            rater_name=rater.full_name or rater.email if rater else "Unknown",
            rated_name=rated.full_name or rated.email if rated else "Unknown"
        ))
    
    return result


@router.get("/booking/{booking_id}/check")
def check_booking_rating(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Check if the current user has already rated a specific booking"""
    rating = service.get_booking_rating(db, booking_id, current_user.id)
    
    if rating:
        return {
            "has_rated": True,
            "rating": RatingOut.model_validate(rating)
        }
    
    return {"has_rated": False, "rating": None}

