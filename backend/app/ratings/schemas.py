from typing import Optional, List
from datetime import datetime

from pydantic import BaseModel, Field


class RatingCreate(BaseModel):
    booking_id: int
    rating: int = Field(..., ge=1, le=5, description="Rating from 1 to 5 stars")
    comment: Optional[str] = Field(None, max_length=500, description="Optional text review")


class RatingOut(BaseModel):
    id: int
    booking_id: int
    rater_id: int
    rated_id: int
    rating: int
    comment: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class RatingWithNames(RatingOut):
    """Rating with rater and rated user names"""
    rater_name: str
    rated_name: str


class UserRatingItem(BaseModel):
    """Individual rating item for user ratings response"""
    score: int
    comment: Optional[str] = None
    ride_id: int
    created_at: datetime
    
    class Config:
        from_attributes = True


class UserRatingsResponse(BaseModel):
    """Response format for GET /api/ratings/user/{user_id}"""
    average: float
    count: int
    ratings: List[UserRatingItem]


class RatingCreateByRide(BaseModel):
    """New rating creation schema using ride_id instead of booking_id"""
    ride_id: int
    rated_id: int
    score: int = Field(..., ge=1, le=5, description="Rating from 1 to 5 stars")
    comment: Optional[str] = Field(None, max_length=500, description="Optional text review")


class ReviewDetailResponse(BaseModel):
    """Response schema for GET /users/{user_id}/reviews"""
    reviewer_id: int
    reviewer_name: str
    reviewer_avatar_url: Optional[str] = None
    rating: int
    comment: Optional[str] = None
    created_at: datetime


