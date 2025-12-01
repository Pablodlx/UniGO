"use client";

import { useState, useEffect } from "react";
import { getUserProfile, removePassengerFromRide, freeSeat, UserProfile } from "@/lib/api";
import Image from "next/image";
import ReviewsModal from "./ReviewsModal";

interface PassengerProfileModalProps {
  isOpen: boolean;
  userId: number;
  rideId: number;
  onClose: () => void;
  onPassengerRemoved: (userId: number) => void;
  onSeatFreed?: (newAvailableSeats: number) => void;
  showRemoveButton?: boolean; // Si es false, no muestra el botón "Eliminar del viaje"
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

export default function PassengerProfileModal({
  isOpen,
  userId,
  rideId,
  onClose,
  onPassengerRemoved,
  onSeatFreed,
  showRemoveButton = true, // Por defecto mostrar el botón
}: PassengerProfileModalProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [showReviewsModal, setShowReviewsModal] = useState(false);

  useEffect(() => {
    if (isOpen && userId) {
      loadProfile();
    }
  }, [isOpen, userId]);

  const loadProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getUserProfile(userId);
      setProfile(data);
    } catch (e) {
      console.error("Error loading profile:", e);
      setError("No se pudo cargar el perfil del usuario.");
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async () => {
    if (!confirm(`¿Estás seguro de que quieres quitar a ${profile?.full_name || "este pasajero"} del viaje?`)) {
      return;
    }

    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("token") || ""
        : "";

    if (!token) {
      alert("No estás autenticado.");
      return;
    }

    setRemoving(true);
    try {
      // Eliminar pasajero
      const ok = await removePassengerFromRide(rideId, userId, token);
      if (ok) {
        // Liberar asiento
        const seatResult = await freeSeat(rideId, token);
        if (seatResult.success) {
          // Notificar al componente padre
          onPassengerRemoved(userId);
          
          // Notificar sobre asientos liberados
          if (onSeatFreed && seatResult.available_seats !== undefined) {
            onSeatFreed(seatResult.available_seats);
          }
          
          // Cerrar el modal
          onClose();
        } else {
          // Si falla liberar asiento, aún así notificamos
          onPassengerRemoved(userId);
          onClose();
          alert("Pasajero eliminado, pero no se pudo liberar el asiento automáticamente.");
        }
      } else {
        alert("No se pudo expulsar al pasajero");
      }
    } catch (e) {
      console.error("Error removing passenger:", e);
      alert("Error al expulsar al pasajero");
    } finally {
      setRemoving(false);
    }
  };

  if (!isOpen) return null;

  const avatarUrl = profile ? getAvatarUrl(profile.avatar_url) : null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/20 backdrop-blur-md backdrop-saturate-200"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-gray-200 transform transition-all max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-green-50 to-green-100 border-b border-green-200 rounded-t-xl px-8 py-6 flex-shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">Perfil del Usuario</h2>
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
        <div className="flex-1 overflow-y-auto p-8">
          {loading ? (
            <div className="text-center py-12">
              <p className="text-gray-600">Cargando perfil…</p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-600">{error}</p>
            </div>
          ) : profile ? (
            <div className="space-y-6">
              {/* Avatar and Name */}
              <div className="flex items-center space-x-6">
                <div className="relative w-24 h-24 flex-shrink-0">
                  {avatarUrl ? (
                    <>
                      <Image
                        src={avatarUrl}
                        alt={profile.full_name || "Usuario"}
                        width={96}
                        height={96}
                        className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const fallback = target.nextElementSibling as HTMLElement;
                          if (fallback) fallback.style.display = 'flex';
                        }}
                      />
                      <div className="w-24 h-24 bg-green-500 rounded-full items-center justify-center hidden border-4 border-white shadow-lg">
                        <span className="text-white text-3xl font-bold">
                          {(profile.full_name || profile.email || "U").charAt(0).toUpperCase()}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center border-4 border-white shadow-lg">
                      <span className="text-white text-3xl font-bold">
                        {(profile.full_name || profile.email || "U").charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="text-3xl font-bold text-gray-900">
                    {profile.full_name || profile.email}
                  </h3>
                  {profile.average_rating !== null && profile.average_rating > 0 && (
                    <div className="flex flex-col items-start space-y-2 mt-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-2xl">⭐</span>
                        <span className="text-xl font-semibold text-gray-700">
                          {profile.average_rating.toFixed(1)}
                        </span>
                        {profile.rating_count > 0 && (
                          <span className="text-sm text-gray-500">
                            ({profile.rating_count} valoración{profile.rating_count !== 1 ? "es" : ""})
                          </span>
                        )}
                      </div>
                      {profile.rating_count > 0 && (
                        <button
                          onClick={() => setShowReviewsModal(true)}
                          className="text-sm text-green-600 hover:text-green-700 font-medium underline"
                        >
                          Ver valoraciones
                        </button>
                      )}
                    </div>
                  )}
                  {(!profile.average_rating || profile.average_rating === 0) && (
                    <p className="text-gray-500 mt-2">Sin valoraciones aún</p>
                  )}
                  
                  {/* Trip Statistics */}
                  <div className="flex gap-8 mt-3 text-gray-700 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🚗</span>
                      <span>{profile.completed_driver_trips || 0} viajes como conductor</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">👤</span>
                      <span>{profile.completed_passenger_trips || 0} viajes como pasajero</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* User Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                {profile.email && (
                  <div>
                    <p className="text-sm font-medium text-gray-500">Email</p>
                    <p className="text-base text-gray-900">{profile.email}</p>
                  </div>
                )}
                {profile.university && (
                  <div>
                    <p className="text-sm font-medium text-gray-500">Universidad</p>
                    <p className="text-base text-gray-900">{profile.university}</p>
                  </div>
                )}
                {profile.degree && (
                  <div>
                    <p className="text-sm font-medium text-gray-500">Carrera</p>
                    <p className="text-base text-gray-900">{profile.degree}</p>
                  </div>
                )}
                {profile.course && (
                  <div>
                    <p className="text-sm font-medium text-gray-500">Curso</p>
                    <p className="text-base text-gray-900">{profile.course}º</p>
                  </div>
                )}
                {profile.home_address && (
                  <div className="md:col-span-2">
                    <p className="text-sm font-medium text-gray-500">Dirección</p>
                    <p className="text-base text-gray-900">{profile.home_address.formatted_address}</p>
                  </div>
                )}
              </div>

              {/* Remove Button - Solo mostrar si showRemoveButton es true */}
              {showRemoveButton && (
                <div className="pt-6 border-t border-gray-200">
                  <button
                    onClick={handleRemove}
                    disabled={removing}
                    className={`w-full px-6 py-3 rounded-lg font-medium transition-colors ${
                      removing
                        ? "bg-gray-400 text-white cursor-not-allowed"
                        : "bg-red-500 hover:bg-red-600 text-white"
                    }`}
                  >
                    {removing ? "Quitando..." : "❌ Eliminar del viaje"}
                  </button>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* Reviews Modal */}
      <ReviewsModal
        isOpen={showReviewsModal}
        userId={userId}
        onClose={() => setShowReviewsModal(false)}
      />
    </div>
  );
}

