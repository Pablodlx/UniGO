"use client";

import { useState, useEffect } from "react";
import { getPendingBookingsForDriver, acceptBooking, rejectBooking, PendingRideInfo, PendingRequestInfo } from "@/lib/api";
import PassengerProfileModal from "./PassengerProfileModal";
import Image from "next/image";

interface PendingBookingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBookingAccepted?: (rideId: number, newAvailableSeats: number) => void;
}

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

export default function PendingBookingsModal({ isOpen, onClose, onBookingAccepted }: PendingBookingsModalProps) {
  const [rides, setRides] = useState<PendingRideInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedRideId, setSelectedRideId] = useState<number | null>(null);
  const [processingBookingId, setProcessingBookingId] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadPendingBookings();
    }
  }, [isOpen]);

  const loadPendingBookings = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getPendingBookingsForDriver();
      setRides(data || []);
    } catch (e) {
      console.error("Error loading pending bookings:", e);
      setError("No se pudieron cargar las solicitudes pendientes.");
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (booking: PendingRequestInfo, rideId: number) => {
    if (!confirm(`¿Aceptar la solicitud de ${booking.passenger_name}?`)) {
      return;
    }

    setProcessingBookingId(booking.booking_id);
    try {
      const result = await acceptBooking(booking.booking_id);
      if (result.success) {
        // Remove this booking from the list
        setRides(prevRides =>
          prevRides.map(ride => {
            if (ride.ride_id === rideId) {
              const updatedRequests = ride.requests.filter(r => r.booking_id !== booking.booking_id);
              if (updatedRequests.length === 0) {
                return null; // Remove ride if no more requests
              }
              return { ...ride, requests: updatedRequests };
            }
            return ride;
          }).filter(Boolean) as PendingRideInfo[]
        );

        // Notify parent about seat update
        if (onBookingAccepted && result.available_seats !== undefined) {
          onBookingAccepted(rideId, result.available_seats);
        }

        // Reload to refresh the list
        await loadPendingBookings();
      } else {
        alert("No se pudo aceptar la solicitud.");
      }
    } catch (e) {
      console.error("Error accepting booking:", e);
      alert("Error al aceptar la solicitud.");
    } finally {
      setProcessingBookingId(null);
    }
  };

  const handleReject = async (booking: PendingRequestInfo, rideId: number) => {
    if (!confirm(`¿Rechazar la solicitud de ${booking.passenger_name}?`)) {
      return;
    }

    setProcessingBookingId(booking.booking_id);
    try {
      const result = await rejectBooking(booking.booking_id);
      if (result.success) {
        // Remove this booking from the list immediately
        setRides(prevRides =>
          prevRides.map(ride => {
            if (ride.ride_id === rideId) {
              const updatedRequests = ride.requests.filter(r => r.booking_id !== booking.booking_id);
              if (updatedRequests.length === 0) {
                return null; // Remove ride if no more requests
              }
              return { ...ride, requests: updatedRequests };
            }
            return ride;
          }).filter((ride): ride is PendingRideInfo => ride !== null)
        );

        alert("Solicitud rechazada correctamente.");
      } else {
        alert("No se pudo rechazar la solicitud.");
      }
    } catch (e) {
      console.error("Error rejecting booking:", e);
      alert("Error al rechazar la solicitud.");
    } finally {
      setProcessingBookingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-md backdrop-saturate-200"
        onClick={onClose}
      >
        <div
          className="relative bg-white rounded-xl shadow-2xl max-w-4xl w-full border border-gray-200 transform transition-all max-h-[90vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-green-50 to-green-100 border-b border-green-200 rounded-t-xl px-8 py-6 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Solicitudes de reserva pendientes</h2>
                <p className="text-sm text-gray-600 mt-1">Revisa y gestiona las solicitudes de reserva</p>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 text-3xl font-light transition-colors"
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="text-center py-12">
                <p className="text-gray-600">Cargando solicitudes…</p>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <p className="text-red-600">{error}</p>
              </div>
            ) : rides.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-600">No hay solicitudes pendientes.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {rides.map((ride) => (
                  <div key={ride.ride_id} className="border-2 border-gray-200 rounded-xl p-6">
                    <div className="mb-4">
                      <h3 className="text-xl font-bold text-gray-900 mb-1">{ride.ride_title}</h3>
                      <p className="text-sm text-gray-600">
                        {new Date(ride.date).toLocaleDateString("es-ES", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>

                    <div className="space-y-4">
                      {ride.requests.map((request) => {
                        const avatarUrl = getAvatarUrl(request.passenger_avatar_url);
                        return (
                          <div
                            key={request.booking_id}
                            className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100"
                          >
                            <div className="flex items-center space-x-4 flex-1">
                              {/* Avatar */}
                              <div className="relative w-14 h-14 flex-shrink-0">
                                {avatarUrl ? (
                                  <>
                                    <Image
                                      src={avatarUrl}
                                      alt={request.passenger_name}
                                      width={56}
                                      height={56}
                                      className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-md"
                                      onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.style.display = 'none';
                                        const fallback = target.nextElementSibling as HTMLElement;
                                        if (fallback) fallback.style.display = 'flex';
                                      }}
                                    />
                                    <div className="w-14 h-14 bg-green-500 rounded-full items-center justify-center hidden border-2 border-white shadow-md">
                                      <span className="text-white text-xl font-bold">
                                        {request.passenger_name.charAt(0).toUpperCase()}
                                      </span>
                                    </div>
                                  </>
                                ) : (
                                  <div className="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center border-2 border-white shadow-md">
                                    <span className="text-white text-xl font-bold">
                                      {request.passenger_name.charAt(0).toUpperCase()}
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* User Info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-2">
                                  <h4 className="text-lg font-semibold text-gray-900">{request.passenger_name}</h4>
                                  {request.seats > 1 && (
                                    <span className="px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded-full">
                                      {request.seats} asientos
                                    </span>
                                  )}
                                </div>
                                {request.passenger_rating !== null && request.passenger_rating > 0 && (
                                  <p className="text-sm text-gray-600 mt-1">
                                    ⭐ {request.passenger_rating.toFixed(1)}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center space-x-2 ml-4">
                              <button
                                onClick={() => {
                                  setSelectedUserId(request.passenger_id);
                                  setSelectedRideId(ride.ride_id);
                                }}
                                className="px-3 py-1 bg-blue-500 text-white rounded-md text-sm font-medium hover:bg-blue-600 transition-colors"
                              >
                                Ver perfil
                              </button>
                              <button
                                onClick={() => handleAccept(request, ride.ride_id)}
                                disabled={processingBookingId === request.booking_id}
                                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                                  processingBookingId === request.booking_id
                                    ? "bg-gray-400 text-white cursor-not-allowed"
                                    : "bg-green-500 hover:bg-green-600 text-white"
                                }`}
                              >
                                {processingBookingId === request.booking_id ? "Procesando..." : "Aceptar"}
                              </button>
                              <button
                                onClick={() => handleReject(request, ride.ride_id)}
                                disabled={processingBookingId === request.booking_id}
                                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                                  processingBookingId === request.booking_id
                                    ? "bg-gray-400 text-white cursor-not-allowed"
                                    : "bg-red-500 hover:bg-red-600 text-white"
                                }`}
                              >
                                {processingBookingId === request.booking_id ? "Procesando..." : "Rechazar"}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Passenger Profile Modal */}
      {selectedUserId && selectedRideId && (
        <PassengerProfileModal
          isOpen={!!selectedUserId}
          userId={selectedUserId}
          rideId={selectedRideId}
          onClose={() => {
            setSelectedUserId(null);
            setSelectedRideId(null);
          }}
          onPassengerRemoved={() => {
            // This won't be called from pending bookings, but we need to handle it
            loadPendingBookings();
          }}
          showRemoveButton={false}
        />
      )}
    </>
  );
}

