from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.auth.models import User, SearchAlert
from app.auth.router import get_current_user
from app.db.session import get_db
from app.search_alerts.schemas import SearchAlertCreate, SearchAlertOut, SearchAlertUpdate
from app.rides.service import match_existing_trips_with_alert, cancel_auto_bookings_for_dates, match_trips_for_specific_dates, cancel_all_auto_bookings_for_alert

router = APIRouter(prefix="/search-alerts", tags=["Search Alerts"])


@router.post("/", response_model=SearchAlertOut)
def create_search_alert(
    alert_data: SearchAlertCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new search alert for automatic ride matching"""
    
    # Convert specific_dates from strings to date objects
    specific_dates_parsed = None
    if alert_data.specific_dates and len(alert_data.specific_dates) > 0:
        from datetime import date as date_type
        try:
            specific_dates_parsed = [date_type.fromisoformat(d) for d in alert_data.specific_dates]
        except ValueError as e:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid date format in specific_dates: {str(e)}"
            )
    
    # If specific_dates is provided, ignore days_of_week (priority)
    days_of_week_to_save = None
    if not specific_dates_parsed or len(specific_dates_parsed) == 0:
        days_of_week_to_save = alert_data.days_of_week if alert_data.days_of_week else []
    
    # Create the search alert
    search_alert = SearchAlert(
        user_id=current_user.id,
        origin=alert_data.origin,
        destination=alert_data.destination,
        origin_lat=alert_data.origin_lat,
        origin_lng=alert_data.origin_lng,
        destination_lat=alert_data.destination_lat,
        destination_lng=alert_data.destination_lng,
        target_time=alert_data.target_time,
        days_of_week=days_of_week_to_save,
        specific_dates=specific_dates_parsed,
        flexibility_minutes=alert_data.flexibility_minutes,
        allow_nearby_search=alert_data.allow_nearby_search,
        active=True,
    )
    
    db.add(search_alert)
    db.commit()
    db.refresh(search_alert)
    
    # Match existing trips with the new alert
    # PROBLEMA CORREGIDO: Se añadió logging detallado y mejor manejo de errores
    print(f"[ALERT CREATION] Created alert {search_alert.id} for user {current_user.id}, checking matching trips...")
    try:
        match_existing_trips_with_alert(db, search_alert)
        print(f"[ALERT CREATION] ✅ Finished matching trips for alert {search_alert.id}")
    except Exception as e:
        # Log error but don't fail alert creation
        print(f"[ALERT CREATION] ❌ ERROR matching existing trips with alert {search_alert.id}: {e}")
        import traceback
        print(traceback.format_exc())
        # Re-raise to ensure we see the error, but alert creation still succeeds
    
    # Convert specific_dates back to strings for response
    specific_dates_str = None
    if search_alert.specific_dates:
        specific_dates_str = [d.isoformat() for d in search_alert.specific_dates]
    
    return SearchAlertOut(
        id=search_alert.id,
        user_id=search_alert.user_id,
        origin=search_alert.origin,
        destination=search_alert.destination,
        target_time=search_alert.target_time,
        days_of_week=search_alert.days_of_week if search_alert.days_of_week else None,
        specific_dates=specific_dates_str,
        flexibility_minutes=search_alert.flexibility_minutes,
        allow_nearby_search=search_alert.allow_nearby_search,
        active=search_alert.active,
        created_at=search_alert.created_at.isoformat(),
    )


@router.get("/my", response_model=List[SearchAlertOut])
def get_my_search_alerts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all search alerts for the current user"""
    alerts = db.query(SearchAlert).filter(
        SearchAlert.user_id == current_user.id
    ).order_by(SearchAlert.created_at.desc()).all()
    
    result = []
    for alert in alerts:
        specific_dates_str = None
        if alert.specific_dates:
            specific_dates_str = [d.isoformat() for d in alert.specific_dates]
        
        result.append(SearchAlertOut(
            id=alert.id,
            user_id=alert.user_id,
            origin=alert.origin,
            destination=alert.destination,
            target_time=alert.target_time,
            days_of_week=alert.days_of_week if alert.days_of_week else None,
            specific_dates=specific_dates_str,
            flexibility_minutes=alert.flexibility_minutes,
            allow_nearby_search=alert.allow_nearby_search,
            active=alert.active,
            created_at=alert.created_at.isoformat(),
        ))
    
    return result


@router.get("/{alert_id}", response_model=SearchAlertOut)
def get_search_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific search alert by ID"""
    alert = db.query(SearchAlert).filter(
        SearchAlert.id == alert_id,
        SearchAlert.user_id == current_user.id
    ).first()
    
    if not alert:
        raise HTTPException(status_code=404, detail="Search alert not found")
    
    specific_dates_str = None
    if alert.specific_dates:
        specific_dates_str = [d.isoformat() for d in alert.specific_dates]
    
    return SearchAlertOut(
        id=alert.id,
        user_id=alert.user_id,
        origin=alert.origin,
        destination=alert.destination,
        target_time=alert.target_time,
        days_of_week=alert.days_of_week if alert.days_of_week else None,
        specific_dates=specific_dates_str,
        flexibility_minutes=alert.flexibility_minutes,
        allow_nearby_search=alert.allow_nearby_search,
        active=alert.active,
        created_at=alert.created_at.isoformat(),
    )


@router.put("/{alert_id}", response_model=SearchAlertOut)
def update_search_alert(
    alert_id: int,
    alert_data: SearchAlertUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a search alert"""
    alert = db.query(SearchAlert).filter(
        SearchAlert.id == alert_id,
        SearchAlert.user_id == current_user.id
    ).first()
    
    if not alert:
        raise HTTPException(status_code=404, detail="Search alert not found")
    
    # Save old dates before updating (for comparison)
    old_specific_dates = set(alert.specific_dates) if alert.specific_dates else set()
    old_origin = alert.origin
    old_destination = alert.destination
    old_target_time = alert.target_time
    old_flexibility_minutes = alert.flexibility_minutes
    
    # Update fields if provided
    if alert_data.origin is not None:
        alert.origin = alert_data.origin
    if alert_data.destination is not None:
        alert.destination = alert_data.destination
    if alert_data.origin_lat is not None:
        alert.origin_lat = alert_data.origin_lat
    if alert_data.origin_lng is not None:
        alert.origin_lng = alert_data.origin_lng
    if alert_data.destination_lat is not None:
        alert.destination_lat = alert_data.destination_lat
    if alert_data.destination_lng is not None:
        alert.destination_lng = alert_data.destination_lng
    if alert_data.target_time is not None:
        alert.target_time = alert_data.target_time
    if alert_data.flexibility_minutes is not None:
        alert.flexibility_minutes = alert_data.flexibility_minutes
    if alert_data.allow_nearby_search is not None:
        alert.allow_nearby_search = alert_data.allow_nearby_search
    if alert_data.active is not None:
        alert.active = alert_data.active
    
    # Handle specific_dates
    new_specific_dates = None
    if alert_data.specific_dates is not None:
        if len(alert_data.specific_dates) > 0:
            from datetime import date as date_type
            try:
                new_specific_dates = [date_type.fromisoformat(d) for d in alert_data.specific_dates]
                alert.specific_dates = new_specific_dates
                # If specific_dates is provided, clear days_of_week
                alert.days_of_week = None
            except ValueError as e:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid date format in specific_dates: {str(e)}"
                )
        else:
            alert.specific_dates = None
            new_specific_dates = []
    
    # Handle days_of_week (only if specific_dates is not being set)
    if alert_data.days_of_week is not None and (alert_data.specific_dates is None or len(alert_data.specific_dates) == 0):
        if len(alert_data.days_of_week) > 0:
            alert.days_of_week = alert_data.days_of_week
            # If days_of_week is provided and specific_dates is empty, clear specific_dates
            if alert_data.specific_dates is not None:
                alert.specific_dates = None
                new_specific_dates = []
        else:
            alert.days_of_week = None
    
    # Determine new dates set (for comparison)
    new_specific_dates_set = set(new_specific_dates) if new_specific_dates is not None else set()
    
    # Compare old and new dates to find removed and added dates
    removed_dates = list(old_specific_dates - new_specific_dates_set)
    added_dates = list(new_specific_dates_set - old_specific_dates)
    
    # If dates were removed, cancel bookings for those dates
    # Use old alert values since bookings were created with those criteria
    if removed_dates and len(removed_dates) > 0:
        try:
            cancel_auto_bookings_for_dates(
                db=db,
                alert=alert,
                removed_dates=removed_dates,
                alert_origin=old_origin,
                alert_destination=old_destination,
                alert_target_time=old_target_time,
                alert_flexibility_minutes=old_flexibility_minutes,
            )
        except Exception as e:
            print(f"Error canceling bookings for removed dates: {e}")
            import traceback
            traceback.print_exc()
            # Continue with update even if cancellation fails
    
    db.commit()
    db.refresh(alert)
    
    # If dates were added, match existing trips for those new dates only
    if added_dates and len(added_dates) > 0:
        try:
            match_trips_for_specific_dates(db, alert, added_dates)
        except Exception as e:
            print(f"Error matching trips for added dates: {e}")
            import traceback
            traceback.print_exc()
            # Continue even if matching fails
    
    # Convert specific_dates back to strings for response
    specific_dates_str = None
    if alert.specific_dates:
        specific_dates_str = [d.isoformat() for d in alert.specific_dates]
    
    return SearchAlertOut(
        id=alert.id,
        user_id=alert.user_id,
        origin=alert.origin,
        destination=alert.destination,
        target_time=alert.target_time,
        days_of_week=alert.days_of_week if alert.days_of_week else None,
        specific_dates=specific_dates_str,
        flexibility_minutes=alert.flexibility_minutes,
        allow_nearby_search=alert.allow_nearby_search,
        active=alert.active,
        created_at=alert.created_at.isoformat(),
    )


@router.delete("/{alert_id}")
def delete_search_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a search alert and cancel all associated automatic bookings"""
    alert = db.query(SearchAlert).filter(
        SearchAlert.id == alert_id,
        SearchAlert.user_id == current_user.id
    ).first()
    
    if not alert:
        raise HTTPException(status_code=404, detail="Search alert not found")
    
    # Cancel all automatic bookings associated with this alert before deleting
    try:
        cancel_all_auto_bookings_for_alert(db, alert)
    except Exception as e:
        print(f"Error canceling bookings for deleted alert {alert.id}: {e}")
        import traceback
        traceback.print_exc()
        # Continue with deletion even if cancellation fails
    
    db.delete(alert)
    db.commit()
    
    return {"success": True, "message": "Search alert deleted successfully"}

