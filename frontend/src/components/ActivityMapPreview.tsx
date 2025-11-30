'use client';

import { useCallback, useEffect, useState, useMemo, useRef } from "react";
import { GoogleMap, Marker, DirectionsRenderer, useJsApiLoader } from "@react-google-maps/api";
import { getRouteInfo, RouteInfo } from "@/lib/api";
import { decodePolyline } from "@/utils/polylineDecoder";

type ActivityMapPreviewProps = {
  originName: string;
  destinationName: string;
  originLat?: number | null;
  originLng?: number | null;
  destinationLat?: number | null;
  destinationLng?: number | null;
  className?: string;
  onRouteInfoLoaded?: (info: RouteInfo) => void;
  // Optional Uber-like mode: fixed marker in center, update coordinates on drag
  uberMode?: boolean;
  onOriginChange?: (lat: number, lng: number, address: string) => void;
  onDestinationChange?: (lat: number, lng: number, address: string) => void;
};

const lightMapStyle: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#333333" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }] },
  {
    featureType: "administrative",
    elementType: "geometry.stroke",
    stylers: [{ color: "#cccccc" }],
  },
  {
    featureType: "poi",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#f5f5f5" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#e0e0e0" }],
  },
  { featureType: "water", stylers: [{ color: "#e3f2fd" }] },
];

const libraries: ("places" | "drawing" | "geometry" | "localContext" | "visualization")[] = ["places"];

export default function ActivityMapPreview({
  originName,
  destinationName,
  originLat,
  originLng,
  destinationLat,
  destinationLng,
  className = "",
  onRouteInfoLoaded,
  uberMode = false,
  onOriginChange,
  onDestinationChange,
}: ActivityMapPreviewProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const [error, setError] = useState<string | null>(null);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [directionsResult, setDirectionsResult] = useState<google.maps.DirectionsResult | null>(null);
  const [mapCenter, setMapCenter] = useState<google.maps.LatLngLiteral | null>(null);
  const [mapBounds, setMapBounds] = useState<google.maps.LatLngBounds | null>(null);
  const [currentOrigin, setCurrentOrigin] = useState<google.maps.LatLngLiteral | null>(null);
  const [currentDestination, setCurrentDestination] = useState<google.maps.LatLngLiteral | null>(null);
  const [uberMarkerPosition, setUberMarkerPosition] = useState<google.maps.LatLngLiteral | null>(null);
  const [isUberOrigin, setIsUberOrigin] = useState(true); // true = origin, false = destination
  const [geocoder, setGeocoder] = useState<google.maps.Geocoder | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const polylineRef = useRef<google.maps.Polyline | null>(null);

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey || '',
    libraries,
  });

  // Initialize coordinates
  useEffect(() => {
    if (typeof originLat === "number" && typeof originLng === "number") {
      setCurrentOrigin({ lat: originLat, lng: originLng });
    }
    if (typeof destinationLat === "number" && typeof destinationLng === "number") {
      setCurrentDestination({ lat: destinationLat, lng: destinationLng });
    }
  }, [originLat, originLng, destinationLat, destinationLng]);

  // Initialize geocoder when map is loaded
  useEffect(() => {
    if (isLoaded && window.google?.maps) {
      setGeocoder(new window.google.maps.Geocoder());
    }
  }, [isLoaded]);

  // Calculate center and bounds
  useEffect(() => {
    if (isLoaded && currentOrigin && currentDestination) {
      const bounds = new window.google.maps.LatLngBounds();
      bounds.extend(currentOrigin);
      bounds.extend(currentDestination);
      setMapBounds(bounds);
      
      // Center point
      const center = {
        lat: (currentOrigin.lat + currentDestination.lat) / 2,
        lng: (currentOrigin.lng + currentDestination.lng) / 2,
      };
      setMapCenter(center);
    } else if (currentOrigin) {
      setMapCenter(currentOrigin);
    } else if (currentDestination) {
      setMapCenter(currentDestination);
    }
  }, [isLoaded, currentOrigin, currentDestination]);

  // Fetch route info from backend
  useEffect(() => {
    if (!currentOrigin || !currentDestination) return;

    const fetchRouteInfo = async () => {
      try {
        const info = await getRouteInfo(
          currentOrigin.lat,
          currentOrigin.lng,
          currentDestination.lat,
          currentDestination.lng
        );
        setRouteInfo(info);
        if (onRouteInfoLoaded) {
          onRouteInfoLoaded(info);
        }
      } catch (err) {
        console.warn("Failed to fetch route info from backend:", err);
      }
    };

    fetchRouteInfo();
  }, [currentOrigin, currentDestination, onRouteInfoLoaded]);

  // Calculate route using DirectionsService
  useEffect(() => {
    if (!isLoaded || !currentOrigin || !currentDestination) return;

    const directionsService = new window.google.maps.DirectionsService();
    
    directionsService.route(
      {
        origin: currentOrigin,
        destination: currentDestination,
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === window.google.maps.DirectionsStatus.OK && result) {
          setDirectionsResult(result);
        } else {
          console.warn("Directions API failed:", status);
          setDirectionsResult(null);
        }
      }
    );
  }, [isLoaded, currentOrigin, currentDestination]);

  // Render polyline from backend if DirectionsRenderer fails
  useEffect(() => {
    if (!isLoaded || !mapRef.current || directionsResult) {
      // Clear polyline if directions result is available
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
        polylineRef.current = null;
      }
      return;
    }

    // Use backend polyline as fallback
    if (routeInfo?.polyline && mapRef.current) {
      const decoded = decodePolyline(routeInfo.polyline);
      if (decoded.length > 0) {
        // Clear existing polyline
        if (polylineRef.current) {
          polylineRef.current.setMap(null);
        }

        // Create new polyline
        const polyline = new window.google.maps.Polyline({
          path: decoded,
          map: mapRef.current,
          strokeColor: "#86cc49", // Light green color (original)
          strokeOpacity: 0.9,
          strokeWeight: 5,
        });
        polylineRef.current = polyline;
      }
    }

    return () => {
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
        polylineRef.current = null;
      }
    };
  }, [isLoaded, routeInfo?.polyline, directionsResult, mapRef.current]);

  // Geocode function for Uber mode
  const geocodePosition = useCallback(async (position: google.maps.LatLngLiteral) => {
    if (!geocoder) return null;

    return new Promise<string | null>((resolve) => {
      geocoder.geocode({ location: position }, (results, status) => {
        if (status === window.google.maps.GeocoderStatus.OK && results && results[0]) {
          resolve(results[0].formatted_address);
        } else {
          resolve(null);
        }
      });
    });
  }, [geocoder]);

  // Handle map drag end (Uber mode)
  const onMapDragEnd = useCallback(async () => {
    if (!uberMode || !mapRef.current) return;

    const center = mapRef.current.getCenter();
    if (!center) return;

    const position = { lat: center.lat(), lng: center.lng() };
    const address = await geocodePosition(position);
    setUberMarkerPosition(position);

    if (isUberOrigin) {
      setCurrentOrigin(position);
      if (onOriginChange) {
        onOriginChange(position.lat, position.lng, address || originName);
      }
    } else {
      setCurrentDestination(position);
      if (onDestinationChange) {
        onDestinationChange(position.lat, position.lng, address || destinationName);
      }
    }
  }, [uberMode, isUberOrigin, geocodePosition, onOriginChange, onDestinationChange, originName, destinationName]);

  // Handle Uber marker drag
  const onUberMarkerDragEnd = useCallback(async (e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return;

    const position = { lat: e.latLng.lat(), lng: e.latLng.lng() };
    setUberMarkerPosition(position);
    
    const address = await geocodePosition(position);
    
    if (isUberOrigin) {
      setCurrentOrigin(position);
      if (onOriginChange) {
        onOriginChange(position.lat, position.lng, address || originName);
      }
    } else {
      setCurrentDestination(position);
      if (onDestinationChange) {
        onDestinationChange(position.lat, position.lng, address || destinationName);
      }
    }
  }, [isUberOrigin, geocodePosition, onOriginChange, onDestinationChange, originName, destinationName]);

  // Initialize Uber marker position
  useEffect(() => {
    if (uberMode && mapCenter) {
      setUberMarkerPosition(mapCenter);
    }
  }, [uberMode, mapCenter]);

  // Map options
  const mapOptions = useMemo<google.maps.MapOptions>(() => ({
    styles: lightMapStyle,
    disableDefaultUI: false, // Enable default UI for interactivity
    zoomControl: true,
    mapTypeControl: false,
    scaleControl: false,
    streetViewControl: false,
    rotateControl: false,
    fullscreenControl: false,
    gestureHandling: uberMode ? "greedy" : "auto", // Allow dragging in Uber mode
  }), [uberMode]);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    if (mapBounds) {
      map.fitBounds(mapBounds, { top: 40, bottom: 40, left: 40, right: 40 });
    }
  }, [mapBounds]);

  if (loadError) {
    return (
      <div className={`relative h-48 w-full overflow-hidden rounded-2xl bg-black ${className}`}>
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 px-4 text-center text-sm text-zinc-400">
          Error al cargar el mapa. Verifica NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className={`relative h-48 w-full overflow-hidden rounded-2xl bg-black ${className}`}>
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 px-4 text-center text-sm text-zinc-400">
          Cargando mapa...
        </div>
      </div>
    );
  }

  if (!apiKey) {
    return (
      <div className={`relative h-48 w-full overflow-hidden rounded-2xl bg-black ${className}`}>
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 px-4 text-center text-sm text-zinc-400">
          Añade NEXT_PUBLIC_GOOGLE_MAPS_API_KEY para ver el mapa.
        </div>
      </div>
    );
  }

  if (!currentOrigin || !currentDestination) {
    return (
      <div className={`relative h-48 w-full overflow-hidden rounded-2xl bg-black ${className}`}>
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 px-4 text-center text-sm text-zinc-400">
          No se pudo localizar el recorrido.
        </div>
      </div>
    );
  }

  return (
    <div className={`relative h-48 w-full overflow-hidden rounded-2xl bg-black ${className}`}>
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '100%' }}
        center={mapCenter || currentOrigin}
        zoom={mapBounds ? undefined : 13}
        options={mapOptions}
        onLoad={onMapLoad}
        onDragEnd={onMapDragEnd}
      >
        {/* Origin Marker (Green with white fill) */}
        {!uberMode && currentOrigin && (
          <Marker
            position={currentOrigin}
            icon={{
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: 6,
              strokeWeight: 2,
              strokeColor: "#22c55e",
              fillColor: "#ffffff",
              fillOpacity: 1,
            }}
            title={originName}
          />
        )}

        {/* Destination Marker (Light green with white fill) */}
        {!uberMode && currentDestination && (
          <Marker
            position={currentDestination}
            icon={{
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: 6,
              strokeWeight: 2,
              strokeColor: "#86cc49",
              fillColor: "#ffffff",
              fillOpacity: 1,
            }}
            title={destinationName}
          />
        )}

        {/* Uber Mode: Fixed Center Marker */}
        {uberMode && uberMarkerPosition && (
          <Marker
            position={uberMarkerPosition}
            icon={{
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: 10,
              strokeWeight: 4,
              strokeColor: "#3b82f6",
              fillColor: "#3b82f6",
              fillOpacity: 1,
            }}
            title={isUberOrigin ? "Origen" : "Destino"}
            draggable={true}
            onDragEnd={onUberMarkerDragEnd}
          />
        )}

        {/* Directions Renderer for Route */}
        {directionsResult && (
          <DirectionsRenderer
            directions={directionsResult}
            options={{
              suppressMarkers: true, // We use our own markers
              polylineOptions: {
                strokeColor: "#86cc49", // Light green color (original)
                strokeOpacity: 0.9,
                strokeWeight: 5,
              },
            }}
          />
        )}
      </GoogleMap>

      {/* Gradient overlay (maintains visual style) */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/40" />

      {/* Uber Mode Toggle (if enabled) */}
      {uberMode && (
        <div className="absolute top-2 right-2 z-10 bg-white rounded-lg shadow-lg p-2 flex gap-2">
          <button
            onClick={() => setIsUberOrigin(true)}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              isUberOrigin
                ? "bg-green-500 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Origen
          </button>
          <button
            onClick={() => setIsUberOrigin(false)}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              !isUberOrigin
                ? "bg-red-500 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Destino
          </button>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 px-4 text-center text-sm text-zinc-400 z-20">
          {error}
        </div>
      )}
    </div>
  );
}
