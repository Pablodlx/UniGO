"use client";

import { useState, useEffect } from "react";
import { Ride } from "@/lib/api";

interface RideCardProps {
  ride: Ride;
  onClick: () => void;
}

export default function RideCard({ ride, onClick }: RideCardProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const formatTime = (timeString: string) => {
    // timeString is in format HH:MM
    return timeString;
  };

  const formatDate = (dateString: string) => {
    if (!mounted) {
      // Return a placeholder during SSR to avoid hydration mismatch
      return "";
    }
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) {
      return `${hours} h`;
    }
    return `${hours} h ${mins} min`;
  };

  const getStatusBadge = (isActive: boolean) => {
    if (isActive) {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
          Publicado
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
          Inactivo
        </span>
      );
    }
  };

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow cursor-pointer border border-gray-200 p-6"
    >
      {/* Status Badge */}
      <div className="mb-4">
        {getStatusBadge(ride.is_active)}
      </div>

      {/* Main Ride Information */}
      <div className="flex items-center space-x-6 mb-4">
        {/* Departure Time */}
        <div className="text-3xl font-bold text-gray-800">
          {formatTime(ride.departure_time)}
        </div>
        
        {/* Departure Info */}
        <div>
          <div className="text-2xl font-bold text-gray-900">{ride.departure_city}</div>
          <div className="text-sm text-gray-500">{formatDate(ride.departure_date)}</div>
        </div>

        {/* Arrow */}
        <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>

        {/* Destination */}
        <div className="flex items-center space-x-3">
          <div>
            <div className="text-2xl font-bold text-gray-900">{ride.destination_city}</div>
          </div>
          {ride.arrival_time && (
            <div className="text-3xl font-bold text-gray-800">{formatTime(ride.arrival_time)}</div>
          )}
        </div>

        {/* Driver Info on the right */}
        <div className="ml-auto flex items-center space-x-3">
          <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/>
            </svg>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-900">{ride.driver_name}</span>
              {ride.driver_average_rating !== null && ride.driver_average_rating !== undefined && (
                <div className="flex items-center space-x-1">
                  <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span className="text-xs font-medium text-gray-700">{ride.driver_average_rating.toFixed(1)}</span>
                </div>
              )}
            </div>
            {ride.driver_university && (
              <div className="text-xs text-gray-500">{ride.driver_university}</div>
            )}
          </div>
        </div>
      </div>

      {/* Additional Details */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600 border-t border-gray-200 pt-4">
        <div>
          <span className="font-medium text-gray-900">Asientos disponibles:</span> {ride.available_seats}
        </div>
        <div>
          <span className="font-medium text-gray-900">Precio por asiento:</span> {ride.price_per_seat.toFixed(2)} €
        </div>
        {ride.estimated_duration_minutes && (
          <div>
            <span className="font-medium text-gray-900">Duración estimada:</span> {formatDuration(ride.estimated_duration_minutes)}
          </div>
        )}
        <div>
          <span className="font-medium text-gray-900">Vehículo:</span> {
            ride.vehicle_brand || ride.vehicle_color 
              ? [ride.vehicle_brand, ride.vehicle_color].filter(Boolean).join(' ') 
              : 'N/A'
          }
        </div>
      </div>
    </div>
  );
}

