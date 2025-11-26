from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.models import User
from app.auth.router import get_current_user
from app.db.session import get_db
from app.ratings import service
from app.ratings.schemas import RatingCreate, RatingOut, RatingWithNames, UserRatingsResponse, UserRatingItem, RatingCreateByRide

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


@router.post("/create", status_code=status.HTTP_201_CREATED)
def create_rating_by_ride_endpoint(
    rating_data: RatingCreateByRide,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a rating using ride_id, rated_id, score, and comment"""
    service.create_rating_by_ride(
        db=db,
        ride_id=rating_data.ride_id,
        rater_id=current_user.id,
        rated_id=rating_data.rated_id,
        score=rating_data.score,
        comment=rating_data.comment
    )
    return {"status": "ok", "message": "Rating submitted"}


@router.get("/has-rated")
def check_has_rated(
    ride_id: int,
    rater_id: int,
    rated_id: int,
    db: Session = Depends(get_db),
):
    """Check if a user has already rated another user for a specific ride"""
    has_rated_result = service.has_rated(db, ride_id, rater_id, rated_id)
    return {"hasRated": has_rated_result}


@router.get("/user/{user_id}", response_model=UserRatingsResponse)
def get_user_ratings(
    user_id: int,
    db: Session = Depends(get_db),
):
    """Get all ratings received by a specific user with average and count"""
    from app.auth.models import Booking
    
    ratings = service.get_user_ratings(db, user_id)
    
    # Calculate average and count
    average = service.get_user_average_rating(db, user_id) or 0.0
    count = len(ratings)
    
    # Build ratings list with ride_id
    ratings_list = []
    for rating in ratings:
        # Get ride_id from booking
        booking = db.query(Booking).filter(Booking.id == rating.booking_id).first()
        ride_id = booking.ride_id if booking else 0
        
        ratings_list.append(UserRatingItem(
            score=rating.rating,
            comment=rating.comment,
            ride_id=ride_id,
            created_at=rating.created_at
        ))
    
    return UserRatingsResponse(
        average=average,
        count=count,
        ratings=ratings_list
    )


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
