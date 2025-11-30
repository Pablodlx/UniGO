"use client";

import { useState, useEffect } from "react";
import { Ride, getCurrentUserId, getMyBookings, RouteInfo } from "@/lib/api";
import ActivityMapPreview from "@/components/ActivityMapPreview";
import TripGroupChat from "@/components/TripGroupChat";
import Image from "next/image";

function getAvatarUrl(avatarUrl: string | null | undefined): string | null {
  if (!avatarUrl) return null;
  if (avatarUrl.startsWith("http://") || avatarUrl.startsWith("https://")) {
    return avatarUrl;
  }
  if (avatarUrl.startsWith("/static/avatars/")) {
    return `${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"}${avatarUrl}`;
  }
  return `${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"}/static/avatars/${avatarUrl}`;
}

interface RideDetailProps {
  ride: Ride;
  onBack: () => void;
  onContact: () => void;
  bookingSuccess?: boolean;
  onReturnHome?: () => void;
}

export default function RideDetail({ ride, onBack, onContact, bookingSuccess = false, onReturnHome }: RideDetailProps) {
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const [showGroupChat, setShowGroupChat] = useState(false);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!ride || !ride.id) {
      return;
    }

    let cancelled = false;
    const userId = getCurrentUserId();
    setCurrentUserId(userId);

    return () => {
      cancelled = true;
    };
  }, [ride]);

  const formatDate = (dateString: string) => {
    if (!mounted || !dateString) return ""; // Return empty string during SSR or if dateString is missing
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return ""; // Invalid date
      const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
      return `${days[date.getDay()]}, ${date.getDate()} de ${months[date.getMonth()]}`;
    } catch {
      return "";
    }
  };

  const formatTime = (timeString: string) => {
    return timeString;
  };

  const formatDuration = (minutes: number | undefined | null) => {
    if (!minutes || minutes < 0) return "";
    if (minutes < 60) {
      return `${minutes} minutos`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) {
      return `${hours} hora${hours > 1 ? 's' : ''}`;
    }
    return `${hours} hora${hours > 1 ? 's' : ''} ${mins} minuto${mins > 1 ? 's' : ''}`;
  };

  // Show success message if booking was successful
  if (bookingSuccess && onReturnHome) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="px-8 py-6">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center shadow-md">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"/>
                  <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1V8a1 1 0 00-1-1h-3z"/>
                </svg>
              </div>
              <span className="text-2xl font-bold text-gray-800">UniGO</span>
            </div>
          </div>
        </div>

        {/* Success Message */}
        <div className="max-w-2xl mx-auto px-8 py-16">
          <div className="bg-white rounded-2xl shadow-xl border border-green-200 p-12 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-12 h-12 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-4">¡Viaje reservado correctamente!</h1>
            <p className="text-gray-600 text-lg mb-8">
              Espera a que el conductor acepte tu solicitud.
            </p>
            <button
              onClick={onReturnHome}
              className="bg-orange-500 text-white px-8 py-4 rounded-xl font-semibold hover:bg-orange-600 transition-colors flex items-center justify-center space-x-2 shadow-lg mx-auto"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.707.707a1 1 0 001.414-1.414l-7-7z"/>
              </svg>
              <span>Volver al inicio</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Early return if ride is null or missing required fields
  if (!ride || !ride.id) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 text-lg mb-4">Error: No se pudo cargar la información del viaje.</p>
          <button
            onClick={onBack}
            className="px-6 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
          >
            Volver
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {/* Back Button on Left */}
              <button
                onClick={onBack}
                className="mr-4 p-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Back to results"
              >
                <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center shadow-md">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"/>
                  <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1V8a1 1 0 00-1-1h-3z"/>
                </svg>
              </div>
              <span className="text-2xl font-bold text-gray-800">UniGO</span>
            </div>

            <div className="flex items-center space-x-4">
              {/* Profile and other buttons if needed */}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-8 py-12">
        {/* Date Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800">{formatDate(ride.departure_date || "")}</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Panel - Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Ride Itinerary Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
              <div className="space-y-6">
                {/* Departure */}
                <div className="flex items-start space-x-4">
                    <div className="text-2xl font-bold text-gray-800">
                      {formatTime(ride.departure_time || "")}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 text-gray-900 font-semibold mb-1">
                        <svg className="w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/>
                        </svg>
                        <span>{ride.departure_city || "Origen no especificado"}</span>
                      </div>
                    <div className="text-sm text-gray-600">
                      {ride.vehicle_brand || ride.vehicle_color 
                        ? [ride.vehicle_brand, ride.vehicle_color].filter(Boolean).join(' ')
                        : 'Sin detalles adicionales de ubicación'}
                    </div>
                    {ride.estimated_duration_minutes && (
                      <div className="mt-2 flex items-center space-x-2 text-sm text-orange-600">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"/>
                        </svg>
                        <span className="font-medium">Tiempo estimado: {formatDuration(ride.estimated_duration_minutes)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Map Preview */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <ActivityMapPreview
                originName={ride.departure_city || ""}
                destinationName={ride.destination_city || ""}
                originLat={ride.departure_lat ?? undefined}
                originLng={ride.departure_lng ?? undefined}
                destinationLat={ride.destination_lat ?? undefined}
                destinationLng={ride.destination_lng ?? undefined}
                className="h-64"
                onRouteInfoLoaded={(info) => setRouteInfo(info)}
              />
              {/* Route Statistics */}
              {routeInfo && (
                <div className="p-4 border-t border-gray-200 bg-gray-50">
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Distancia</div>
                      <div className="text-lg font-semibold text-gray-900">
                        {routeInfo.distance_km.toFixed(1)} km
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Duración</div>
                      <div className="text-lg font-semibold text-gray-900">
                        {formatDuration(routeInfo.duration_minutes)}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Driver Details Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
              <div className="space-y-6">
                {/* Driver Profile */}
                <div className="flex items-start space-x-4">
                  <div className="relative w-16 h-16 flex-shrink-0">
                    {(() => {
                      const avatarUrl = getAvatarUrl(ride.driver_avatar_url);
                      return avatarUrl ? (
                        <>
                          <Image
                            src={avatarUrl}
                            alt={ride.driver_name || "Conductor"}
                            width={64}
                            height={64}
                            className="w-16 h-16 rounded-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const fallback = target.nextElementSibling as HTMLElement;
                              if (fallback) fallback.style.display = 'flex';
                            }}
                          />
                          <div className="w-16 h-16 bg-gray-200 rounded-full items-center justify-center hidden">
                            <svg className="w-8 h-8 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/>
                            </svg>
                          </div>
                        </>
                      ) : (
                        <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center">
                          <svg className="w-8 h-8 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/>
                          </svg>
                        </div>
                      );
                    })()}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">{ride.driver_name || "Conductor"}</h3>
                    {ride.driver_university && (
                      <p className="text-gray-600 mb-3">{ride.driver_university}</p>
                    )}
                  </div>
                </div>

                {/* Driver Message */}
                {ride.additional_details && (
                  <div className="pt-4 border-t border-gray-200">
                    <p className="text-gray-700 italic">&quot;{ride.additional_details}&quot;</p>
                  </div>
                )}

                {/* Booking Confirmation */}
                <div className="pt-4 border-t border-gray-200">
                  <div className="flex items-center space-x-2 text-gray-700">
                    <svg className="w-5 h-5 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd"/>
                    </svg>
                    <span className="font-medium">Tu reserva se confirmará en el acto</span>
                  </div>
                </div>

                {/* Contact and Chat Buttons */}
                <div className="pt-4 space-y-3">
                  {/* Reserve Button - Only for non-drivers who haven't reserved */}
                  {ride && currentUserId !== ride.driver_id && !(Array.isArray(ride.passengers_ids) && ride.passengers_ids.includes(currentUserId || 0)) && (
                    <button
                      onClick={onContact}
                      className="w-full bg-orange-500 text-white px-6 py-4 rounded-xl font-semibold hover:bg-orange-600 transition-colors flex items-center justify-center space-x-2 shadow-md"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/>
                        <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/>
                      </svg>
                      <span>Reservar</span>
                    </button>
                  )}
                  
                  {/* Chat Button - For driver and passengers when trip has reservations */}
                  {ride && currentUserId && (() => {
                    // Get passengers_ids - ensure it's an array
                    const passengersIds = Array.isArray(ride.passengers_ids) 
                      ? ride.passengers_ids 
                      : ride.passengers_ids 
                        ? [ride.passengers_ids] 
                        : [];
                    
                    // Check conditions
                    const hasPassengers = passengersIds.length > 0;
                    const isDriver = currentUserId === ride.driver_id;
                    const isPassenger = hasPassengers && passengersIds.includes(currentUserId);
                    const canSeeChat = ride.is_active && hasPassengers && (isDriver || isPassenger);
                    
                    if (!canSeeChat) return null;
                    
                    return (
                      <button
                        onClick={() => {
                          setShowGroupChat(true);
                        }}
                        className="w-full bg-orange-500 text-white px-6 py-4 rounded-xl font-semibold hover:bg-orange-600 transition-colors flex items-center justify-center space-x-2 shadow-md"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        <span>Chat del Viaje</span>
                      </button>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel - Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sticky top-8">
              {/* Summary */}
              <div className="space-y-6">
                <div className="pb-4 border-b border-gray-200">
                  <h3 className="text-xl font-bold text-gray-800">{formatDate(ride.departure_date)}</h3>
                </div>

                {/* Departure Summary */}
                <div>
                  <div className="text-lg font-semibold text-gray-900">{formatTime(ride.departure_time || "")} {ride.departure_city || ""}</div>
                  <div className="text-sm text-gray-600">
                    {ride.vehicle_brand || ride.vehicle_color 
                      ? [ride.vehicle_brand, ride.vehicle_color].filter(Boolean).join(' ')
                      : 'Ubicación de salida'}
                  </div>
                  {ride.estimated_duration_minutes && (
                    <div className="mt-2 flex items-center space-x-2 text-sm text-gray-700">
                      <svg className="w-4 h-4 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"/>
                      </svg>
                      <span className="font-medium">Duración estimada: {formatDuration(ride.estimated_duration_minutes)}</span>
                    </div>
                  )}
                </div>

                {/* Driver Summary */}
                <div className="pt-4 border-t border-gray-200">
                  <div className="flex items-center space-x-3">
                    <div className="relative w-10 h-10 flex-shrink-0">
                      {(() => {
                        const avatarUrl = getAvatarUrl(ride.driver_avatar_url);
                        return avatarUrl ? (
                          <>
                            <Image
                              src={avatarUrl}
                              alt={ride.driver_name || "Conductor"}
                              width={40}
                              height={40}
                              className="w-10 h-10 rounded-full object-cover"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                const fallback = target.nextElementSibling as HTMLElement;
                                if (fallback) fallback.style.display = 'flex';
                              }}
                            />
                            <div className="w-10 h-10 bg-gray-200 rounded-full items-center justify-center hidden">
                              <svg className="w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"/>
                              </svg>
                            </div>
                          </>
                        ) : (
                          <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                            <svg className="w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"/>
                            </svg>
                          </div>
                        );
                      })()}
                    </div>
                    <div className="flex-1">
                      <div className="text-gray-900 font-medium">{ride.driver_name || "Conductor"}</div>
                      {ride.driver_university && (
                        <div className="text-sm text-gray-500">{ride.driver_university}</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Price and Passengers */}
                <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700 font-medium">
                      {Array.isArray(ride.passengers) && ride.passengers.length > 0
                        ? `${ride.passengers.length} pasajero${ride.passengers.length > 1 ? 's' : ''}`
                        : '0 pasajeros'}
                    </span>
                    <span className="text-2xl font-bold text-orange-600">{(ride.price_per_seat || 0).toFixed(2)} €</span>
                  </div>
                </div>

                {/* Reserve Button */}
                <div className="space-y-3">
                  {ride && currentUserId !== ride.driver_id && !(Array.isArray(ride.passengers_ids) && ride.passengers_ids.includes(currentUserId || 0)) && (
                    <button
                      onClick={onContact}
                      className="w-full bg-orange-500 text-white px-6 py-4 rounded-xl font-semibold hover:bg-orange-600 transition-colors flex items-center justify-center space-x-2 shadow-lg"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd"/>
                      </svg>
                      <span>Reservar</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Group Chat Modal */}
      {showGroupChat && currentUserId && ride && (
        <TripGroupChat
          isOpen={showGroupChat}
          onClose={() => {
            console.log("Closing group chat");
            setShowGroupChat(false);
          }}
          tripId={ride.id}
          currentUserId={currentUserId}
        />
      )}
    </div>
  );
}

