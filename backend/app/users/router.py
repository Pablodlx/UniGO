from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.auth.models import User, Rating
from app.ratings.schemas import ReviewDetailResponse

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/{user_id}/reviews", response_model=List[ReviewDetailResponse])
def get_user_reviews(
    user_id: int,
    db: Session = Depends(get_db),
):
    """Get all reviews received by a user with reviewer information"""
    # Check if user exists
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Get all ratings received by this user
    ratings = db.query(Rating).filter(Rating.rated_id == user_id).order_by(Rating.created_at.desc()).all()
    
    reviews = []
    for rating in ratings:
        # Get reviewer information
        reviewer = db.query(User).filter(User.id == rating.rater_id).first()
        reviewer_name = reviewer.full_name if reviewer and reviewer.full_name else (reviewer.email if reviewer else "Usuario desconocido")
        reviewer_avatar_url = reviewer.avatar_url if reviewer else None
        
        reviews.append(ReviewDetailResponse(
            reviewer_id=rating.rater_id,
            reviewer_name=reviewer_name,
            reviewer_avatar_url=reviewer_avatar_url,
            rating=rating.rating,
            comment=rating.comment,
            created_at=rating.created_at
        ))
    
    return reviews

