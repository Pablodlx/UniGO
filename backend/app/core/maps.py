"""Google Maps API integration for calculating travel time"""
import httpx
from typing import Optional, Dict, Any
from app.core.config import settings


def calculate_travel_time_sync(
    origin_lat: float,
    origin_lng: float,
    destination_lat: float,
    destination_lng: float,
    departure_time: Optional[str] = None
) -> Optional[int]:
    """
    Calculate estimated travel time in minutes using Google Maps Directions API (synchronous version).
    
    Args:
        origin_lat: Latitude of origin
        origin_lng: Longitude of origin
        destination_lat: Latitude of destination
        destination_lng: Longitude of destination
        departure_time: Optional departure time in format "YYYY-MM-DDTHH:MM:SS"
    
    Returns:
        Estimated travel time in minutes, or None if calculation fails
    """
    api_key = getattr(settings, 'google_maps_api_key', None)
    if not api_key:
        # If no API key is configured, return None
        print("WARNING: Google Maps API key not configured.")
        print(f"DEBUG: settings.google_maps_api_key = {settings.google_maps_api_key}")
        print("DEBUG: Make sure GOOGLE_MAPS_API_KEY is set in backend/.env file")
        print("DEBUG: The .env file should be in the backend/ directory")
        return None
    
    url = "https://maps.googleapis.com/maps/api/directions/json"
    
    params = {
        "origin": f"{origin_lat},{origin_lng}",
        "destination": f"{destination_lat},{destination_lng}",
        "key": api_key,
        "mode": "driving",  # Use driving mode for car rides
        "language": "es",  # Spanish language
        "region": "es",  # Spain region
    }
    
    try:
        with httpx.Client(timeout=10.0) as client:
            response = client.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            
            if data.get("status") != "OK":
                print(f"Google Maps API error: {data.get('status')} - {data.get('error_message', 'Unknown error')}")
                return None
            
            routes = data.get("routes", [])
            if not routes:
                return None
            
            # Get the first route (usually the fastest)
            route = routes[0]
            legs = route.get("legs", [])
            if not legs:
                return None
            
            # Sum up duration from all legs
            total_duration_seconds = sum(
                leg.get("duration", {}).get("value", 0) for leg in legs
            )
            
            # Convert to minutes and round
            duration_minutes = int(total_duration_seconds / 60)
            return duration_minutes
        
    except httpx.TimeoutException:
        print("Google Maps API timeout")
        return None
    except httpx.RequestError as e:
        print(f"Google Maps API request error: {e}")
        return None
    except Exception as e:
        print(f"Error calculating travel time: {e}")
        return None


async def calculate_travel_time(
    origin_lat: float,
    origin_lng: float,
    destination_lat: float,
    destination_lng: float,
    departure_time: Optional[str] = None
) -> Optional[int]:
    """
    Calculate estimated travel time in minutes using Google Maps Directions API.
    
    Args:
        origin_lat: Latitude of origin
        origin_lng: Longitude of origin
        destination_lat: Latitude of destination
        destination_lng: Longitude of destination
        departure_time: Optional departure time in format "YYYY-MM-DDTHH:MM:SS"
    
    Returns:
        Estimated travel time in minutes, or None if calculation fails
    """
    api_key = getattr(settings, 'google_maps_api_key', None)
    if not api_key:
        # If no API key is configured, return None
        return None
    
    url = "https://maps.googleapis.com/maps/api/directions/json"
    
    params = {
        "origin": f"{origin_lat},{origin_lng}",
        "destination": f"{destination_lat},{destination_lng}",
        "key": api_key,
        "mode": "driving",  # Use driving mode for car rides
        "language": "es",  # Spanish language
        "region": "es",  # Spain region
    }
    
    # If departure_time is provided, add it to get traffic-aware estimates
    # Note: This requires a timestamp, not just time. For now, we'll use current time
    # In production, you might want to calculate based on the actual departure datetime
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            
            if data.get("status") != "OK":
                print(f"Google Maps API error: {data.get('status')} - {data.get('error_message', 'Unknown error')}")
                return None
            
            routes = data.get("routes", [])
            if not routes:
                return None
            
            # Get the first route (usually the fastest)
            route = routes[0]
            legs = route.get("legs", [])
            if not legs:
                return None
            
            # Sum up duration from all legs
            total_duration_seconds = sum(
                leg.get("duration", {}).get("value", 0) for leg in legs
            )
            
            # Convert to minutes and round
            duration_minutes = int(total_duration_seconds / 60)
            return duration_minutes
            
    except httpx.TimeoutException:
        print("Google Maps API timeout")
        return None
    except httpx.RequestError as e:
        print(f"Google Maps API request error: {e}")
        return None
    except Exception as e:
        print(f"Error calculating travel time: {e}")
        return None


def get_route_info(
    origin_lat: float,
    origin_lng: float,
    destination_lat: float,
    destination_lng: float,
) -> Dict[str, Any]:
    """
    Get comprehensive route information including distance, duration, suggested price, and polyline.
    Uses Google Directions API if available, otherwise falls back to haversine calculation.
    
    Args:
        origin_lat: Latitude of origin
        origin_lng: Longitude of origin
        destination_lat: Latitude of destination
        destination_lng: Longitude of destination
    
    Returns:
        Dictionary with:
        - distance_km: float (distance in kilometers)
        - duration_minutes: int (duration in minutes)
        - suggested_price: float (calculated as distance_km * 0.08)
        - polyline: str | None (encoded polyline from Google, or None if not available)
    """
    from app.rides.service import haversine
    
    api_key = getattr(settings, 'google_maps_api_key', None)
    
    # Try Google Directions API first if key is available
    if api_key:
        url = "https://maps.googleapis.com/maps/api/directions/json"
        
        params = {
            "origin": f"{origin_lat},{origin_lng}",
            "destination": f"{destination_lat},{destination_lng}",
            "key": api_key,
            "mode": "driving",
            "language": "es",
            "region": "es",
        }
        
        try:
            with httpx.Client(timeout=10.0) as client:
                response = client.get(url, params=params)
                response.raise_for_status()
                data = response.json()
                
                if data.get("status") == "OK":
                    routes = data.get("routes", [])
                    if routes and len(routes) > 0:
                        route = routes[0]
                        legs = route.get("legs", [])
                        
                        if legs and len(legs) > 0:
                            # Sum up distance and duration from all legs
                            total_distance_meters = sum(
                                leg.get("distance", {}).get("value", 0) for leg in legs
                            )
                            total_duration_seconds = sum(
                                leg.get("duration", {}).get("value", 0) for leg in legs
                            )
                            
                            distance_km = total_distance_meters / 1000.0
                            duration_minutes = int(total_duration_seconds / 60)
                            
                            # Get polyline from overview_polyline
                            polyline = None
                            if route.get("overview_polyline"):
                                polyline = route["overview_polyline"].get("points")
                            
                            suggested_price = distance_km * 0.08
                            
                            return {
                                "distance_km": round(distance_km, 2),
                                "duration_minutes": duration_minutes,
                                "suggested_price": round(suggested_price, 2),
                                "polyline": polyline,
                            }
        except Exception as e:
            print(f"Google Directions API error, using fallback: {e}")
            # Fall through to haversine fallback
    
    # Fallback: Use haversine formula for distance
    distance_km = haversine(origin_lat, origin_lng, destination_lat, destination_lng)
    
    # Estimate duration: assume average speed of 60 km/h
    duration_minutes = int((distance_km / 60.0) * 60)
    
    suggested_price = distance_km * 0.08
    
    return {
        "distance_km": round(distance_km, 2),
        "duration_minutes": duration_minutes,
        "suggested_price": round(suggested_price, 2),
        "polyline": None,  # No polyline available with fallback
    }

