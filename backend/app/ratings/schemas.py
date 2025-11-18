from typing import Optional
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


