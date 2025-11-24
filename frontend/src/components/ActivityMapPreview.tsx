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

const darkUberStyle = [
  { elementType: "geometry", stylers: [{ color: "#0f0f0f" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0f0f0f" }] },
  {
    featureType: "administrative",
    elementType: "geometry.stroke",
    stylers: [{ color: "#1c1c1c" }],
  },
  {
    featureType: "poi",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#1f1f1f" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#292929" }],
  },
  { featureType: "water", stylers: [{ color: "#000000" }] },
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
      if (typeof lat === "number" && typeof lng === "number") {
        return { lat, lng };
      }

      if (!label) return null;

      return new Promise((resolve) => {
        const GeocoderConstructor = window.google?.maps?.Geocoder;
        if (!GeocoderConstructor) {
          resolve(null);
          return;
        }
        const geocoder = new GeocoderConstructor();
        geocoder.geocode({ address: label }, (results, status) => {
          if (status === "OK" && results && results[0]?.geometry?.location) {
            const location = results[0].geometry.location;
            resolve({ lat: location.lat(), lng: location.lng() });
          } else {
            resolve(null);
          }
        });
      });
    };

    loadGoogleMaps()
      .then(async () => {
        if (!isMounted || !mapRef.current || !window.google?.maps) return;

        map = new window.google.maps.Map(mapRef.current, {
          disableDefaultUI: true,
          styles: darkUberStyle,
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
              icon: { ...iconBase, strokeColor: "#7fffd4", fillColor: "#0f0f0f", fillOpacity: 1 },
              title: originName,
            }),
            new window.google.maps.Marker({
              position: destination,
              map: map!,
              icon: { ...iconBase, strokeColor: "#ff69b4", fillColor: "#0f0f0f", fillOpacity: 1 },
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

