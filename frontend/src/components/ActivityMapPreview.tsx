'use client';

import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "@/utils/googleMapsLoader";

type ActivityMapPreviewProps = {
  originName: string;
  destinationName: string;
  originLat?: number | null;
  originLng?: number | null;
  destinationLat?: number | null;
  destinationLng?: number | null;
  className?: string;
};

const lightMapStyle = [
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

export default function ActivityMapPreview({
  originName,
  destinationName,
  originLat,
  originLng,
  destinationLat,
  destinationLng,
  className = "",
}: ActivityMapPreviewProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const mapRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;
    if (!apiKey) {
      setError("Añade NEXT_PUBLIC_GOOGLE_MAPS_API_KEY para ver el mapa.");
      return;
    }

    let isMounted = true;
    let map: google.maps.Map | null = null;
    let markers: google.maps.Marker[] = [];
    let polyline: google.maps.Polyline | null = null;
    let directionsRenderer: google.maps.DirectionsRenderer | null = null;

    const resolveLatLng = async (
      label: string,
      lat?: number | null,
      lng?: number | null
    ): Promise<google.maps.LatLngLiteral | null> => {
      // Always prefer coordinates if provided (backend should always provide these)
      if (typeof lat === "number" && typeof lng === "number") {
        return { lat, lng };
      }

      // If coordinates are missing, return null instead of trying to geocode
      // This avoids requiring the Geocoding API
      // The backend should always provide coordinates for rides
      console.warn(`Missing coordinates for ${label}. Backend should provide departure_lat, departure_lng, destination_lat, destination_lng.`);
      return null;
    };

    loadGoogleMaps()
      .then(async () => {
        if (!isMounted || !mapRef.current || !window.google?.maps) return;

        map = new window.google.maps.Map(mapRef.current, {
          disableDefaultUI: true,
          styles: lightMapStyle,
          gestureHandling: "none",
        });

        const [origin, destination] = await Promise.all([
          resolveLatLng(originName, originLat, originLng),
          resolveLatLng(destinationName, destinationLat, destinationLng),
        ]);

        if (!origin || !destination) {
          if (isMounted) {
            setError("No se pudo localizar el recorrido.");
          }
          return;
        }

        const bounds = new window.google.maps.LatLngBounds();
        bounds.extend(origin);
        bounds.extend(destination);
        map.fitBounds(bounds, { top: 40, bottom: 40, left: 40, right: 40 });

        const addMarkers = () => {
          const iconBase = {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 6,
            strokeWeight: 2,
          };
          markers = [
            new window.google.maps.Marker({
              position: origin,
              map: map!,
              icon: { ...iconBase, strokeColor: "#22c55e", fillColor: "#ffffff", fillOpacity: 1 },
              title: originName,
            }),
            new window.google.maps.Marker({
              position: destination,
              map: map!,
              icon: { ...iconBase, strokeColor: "#86cc49", fillColor: "#ffffff", fillOpacity: 1 },
              title: destinationName,
            }),
          ];
        };

        const drawFallbackPolyline = () => {
          polyline = new window.google.maps.Polyline({
            path: [origin, destination],
            map: map!,
            strokeColor: "#86cc49",
            strokeOpacity: 0.9,
            strokeWeight: 5,
          });
          addMarkers();
        };

        const directionsService = new window.google.maps.DirectionsService();
        directionsRenderer = new window.google.maps.DirectionsRenderer({
          suppressMarkers: true,
          polylineOptions: {
            strokeColor: "#86cc49",
            strokeOpacity: 0.9,
            strokeWeight: 5,
          },
        });
        directionsRenderer.setMap(map);

        directionsService.route(
          {
            origin,
            destination,
            travelMode: window.google.maps.TravelMode.DRIVING,
          },
          (result, status) => {
            if (!isMounted) return;
            if (status === window.google.maps.DirectionsStatus.OK && result) {
              directionsRenderer?.setDirections(result);
              addMarkers();
            } else {
              console.warn("Directions API failed, falling back to straight line path", status);
              drawFallbackPolyline();
            }
          }
        );
      })
      .catch((err) => {
        console.error("Error loading Google Maps:", err);
        if (isMounted) {
          setError("No se pudo cargar el mapa.");
        }
      });

    return () => {
      isMounted = false;
      markers.forEach((marker) => marker.setMap(null));
      if (polyline) {
        polyline.setMap(null);
      }
      if (directionsRenderer) {
        directionsRenderer.setMap(null);
      }
    };
  }, [apiKey, destinationLat, destinationLng, destinationName, originLat, originLng, originName]);

  return (
    <div className={`relative h-48 w-full overflow-hidden rounded-2xl bg-black ${className}`}>
      <div ref={mapRef} className="absolute inset-0" />
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 px-4 text-center text-sm text-zinc-400">
          {error}
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/40" />
    </div>
  );
}

