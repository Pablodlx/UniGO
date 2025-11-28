from pydantic import BaseModel, Field, field_validator, model_validator
from typing import List, Optional
from datetime import date


class SearchAlertCreate(BaseModel):
    origin: str = Field(..., description="Origin address")
    origin_lat: float = Field(..., description="Origin latitude")
    origin_lng: float = Field(..., description="Origin longitude")
    destination: str = Field(..., description="Destination address")
    destination_lat: float = Field(..., description="Destination latitude")
    destination_lng: float = Field(..., description="Destination longitude")
    target_time: str = Field(..., description="Target time in HH:MM format")
    days_of_week: Optional[List[int]] = Field(default=None, description="Days of week (0-6, Monday-Sunday)", max_length=7)
    specific_dates: Optional[List[str]] = Field(default=None, description="Specific dates in YYYY-MM-DD format")
    flexibility_minutes: int = Field(default=30, ge=5, le=60, description="Flexibility in minutes")
    allow_nearby_search: bool = Field(default=False, description="Allow searching trips within 1 km of origin/destination")
    
    @field_validator('target_time')
    @classmethod
    def validate_target_time(cls, v: str) -> str:
        """Validate target_time is in HH:MM format"""
        try:
            parts = v.split(":")
            if len(parts) != 2:
                raise ValueError("Invalid format")
            hour = int(parts[0])
            minute = int(parts[1])
            if not (0 <= hour <= 23 and 0 <= minute <= 59):
                raise ValueError("Invalid time range")
            return v
        except (ValueError, IndexError):
            raise ValueError("target_time must be in HH:MM format (e.g., '09:00')")
    
    @field_validator('days_of_week')
    @classmethod
    def validate_days_of_week(cls, v: Optional[List[int]]) -> Optional[List[int]]:
        """Validate days_of_week are in range 0-6"""
        if v is not None and len(v) > 0 and not all(0 <= day <= 6 for day in v):
            raise ValueError("days_of_week must contain values between 0 and 6 (0=Monday, 6=Sunday)")
        return v
    
    @field_validator('specific_dates')
    @classmethod
    def validate_specific_dates(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        """Validate specific_dates are in YYYY-MM-DD format"""
        if v is not None and len(v) > 0:
            for date_str in v:
                try:
                    date.fromisoformat(date_str)
                except ValueError:
                    raise ValueError(f"Invalid date format: {date_str}. Use YYYY-MM-DD format")
        return v
    
    @model_validator(mode='after')
    def validate_at_least_one_selection(self):
        """At least one of days_of_week or specific_dates must be provided"""
        has_days = self.days_of_week and len(self.days_of_week) > 0
        has_dates = self.specific_dates and len(self.specific_dates) > 0
        
        if not has_days and not has_dates:
            raise ValueError("You must select at least one day of the week or at least one specific date")
        return self


class SearchAlertUpdate(BaseModel):
    origin: Optional[str] = Field(None, description="Origin address")
    origin_lat: Optional[float] = Field(None, description="Origin latitude")
    origin_lng: Optional[float] = Field(None, description="Origin longitude")
    destination: Optional[str] = Field(None, description="Destination address")
    destination_lat: Optional[float] = Field(None, description="Destination latitude")
    destination_lng: Optional[float] = Field(None, description="Destination longitude")
    target_time: Optional[str] = Field(None, description="Target time in HH:MM format")
    days_of_week: Optional[List[int]] = Field(None, description="Days of week (0-6, Monday-Sunday)", max_length=7)
    specific_dates: Optional[List[str]] = Field(None, description="Specific dates in YYYY-MM-DD format")
    flexibility_minutes: Optional[int] = Field(None, ge=5, le=60, description="Flexibility in minutes")
    allow_nearby_search: Optional[bool] = Field(None, description="Allow searching trips within 1 km of origin/destination")
    active: Optional[bool] = Field(None, description="Whether the alert is active")
    
    @field_validator('target_time')
    @classmethod
    def validate_target_time(cls, v: Optional[str]) -> Optional[str]:
        """Validate target_time is in HH:MM format"""
        if v is None:
            return v
        try:
            parts = v.split(":")
            if len(parts) != 2:
                raise ValueError("Invalid format")
            hour = int(parts[0])
            minute = int(parts[1])
            if not (0 <= hour <= 23 and 0 <= minute <= 59):
                raise ValueError("Invalid time range")
            return v
        except (ValueError, IndexError):
            raise ValueError("target_time must be in HH:MM format (e.g., '09:00')")
    
    @field_validator('days_of_week')
    @classmethod
    def validate_days_of_week(cls, v: Optional[List[int]]) -> Optional[List[int]]:
        """Validate days_of_week are in range 0-6"""
        if v is not None and len(v) > 0 and not all(0 <= day <= 6 for day in v):
            raise ValueError("days_of_week must contain values between 0 and 6 (0=Monday, 6=Sunday)")
        return v
    
    @field_validator('specific_dates')
    @classmethod
    def validate_specific_dates(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        """Validate specific_dates are in YYYY-MM-DD format"""
        if v is not None and len(v) > 0:
            for date_str in v:
                try:
                    date.fromisoformat(date_str)
                except ValueError:
                    raise ValueError(f"Invalid date format: {date_str}. Use YYYY-MM-DD format")
        return v
    
    @model_validator(mode='after')
    def validate_at_least_one_selection(self):
        """If updating dates/days, at least one of days_of_week or specific_dates must be provided"""
        # Only validate if we're updating dates/days
        if self.days_of_week is not None or self.specific_dates is not None:
            has_days = self.days_of_week and len(self.days_of_week) > 0
            has_dates = self.specific_dates and len(self.specific_dates) > 0
            
            if not has_days and not has_dates:
                raise ValueError("You must select at least one day of the week or at least one specific date")
        return self


class SearchAlertOut(BaseModel):
    id: int
    user_id: int
    origin: str
    destination: str
    target_time: str
    days_of_week: Optional[List[int]]
    specific_dates: Optional[List[str]]
    flexibility_minutes: int
    allow_nearby_search: bool
    active: bool
    created_at: str

    class Config:
        from_attributes = True

