"""
Utility function to check if a user's profile is complete.
"""


def is_profile_complete(user) -> bool:
    """
    Check if user has completed all required profile fields:
    - full_name
    - university
    - degree
    - course
    - home_address (formatted, place_id, lat, lng all present)
    
    Args:
        user: User model instance
        
    Returns:
        bool: True if profile is complete, False otherwise
    """
    # Check basic fields
    if not user.full_name or not user.full_name.strip():
        return False
    
    if not user.university or not user.university.strip():
        return False
    
    if not user.degree or not user.degree.strip():
        return False
    
    if not user.course or user.course <= 0:
        return False
    
    # Check address - all address fields must be present for address to be considered verified
    has_complete_address = (
        bool(user.home_address_formatted) and
        bool(user.home_address_place_id) and
        user.home_address_lat is not None and
        user.home_address_lng is not None
    )
    
    if not has_complete_address:
        return False
    
    return True

