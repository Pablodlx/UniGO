'use client';

import { useMemo } from "react";

type RouteMapProps = {
  origin: string;
  destination: string;
  originLat?: number | null;
  originLng?: number | null;
  destinationLat?: number | null;
  destinationLng?: number | null;
  className?: string;
};

export default function RouteMap({
  origin,
  destination,
  originLat,
  originLng,
  destinationLat,
  destinationLng,
  className = "",
}: RouteMapProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const canShowMap = Boolean(apiKey && origin && destination);

  const mapUrl = useMemo(() => {
    if (!canShowMap) {
      return null;
    }

    const params = new URLSearchParams({
      size: "640x320",
      scale: "2",
      maptype: "roadmap",
      key: apiKey as string,
    });

    const originPoint =
      typeof originLat === "number" && typeof originLng === "number"
        ? `${originLat},${originLng}`
        : origin;
    const destinationPoint =
      typeof destinationLat === "number" && typeof destinationLng === "number"
        ? `${destinationLat},${destinationLng}`
        : destination;

    params.append("markers", `color:0xF97316|label:O|${originPoint}`);
    params.append("markers", `color:0x1D4ED8|label:D|${destinationPoint}`);
    params.append("path", `color:0xF97316|weight:5|${originPoint}|${destinationPoint}`);

    return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
  }, [apiKey, canShowMap, destination, destinationLat, destinationLng, origin, originLat, originLng]);

  if (!canShowMap) {
    return (
      <div className={`rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500 ${className}`}>
        Para ver el recorrido necesitas configurar la variable <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code>.
      </div>
    );
  }

  return (
    <div className={`overflow-hidden rounded-xl border border-gray-200 shadow-sm ${className}`}>
      <img
        src={mapUrl ?? ""}
        alt={`Recorrido de ${origin} a ${destination}`}
        loading="lazy"
        className="h-64 w-full object-cover"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  );
}

