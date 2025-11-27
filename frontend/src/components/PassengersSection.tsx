"use client";

import { useState } from "react";
import { getRideConfirmedUsers, removePassengerFromRide, freeSeat, ConfirmedUser } from "@/lib/api";
import PassengerProfileModal from "./PassengerProfileModal";
import Image from "next/image";

interface PassengersSectionProps {
  rideId: number;
  onSeatFreed?: (newAvailableSeats: number) => void;
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

export default function PassengersSection({ rideId, onSeatFreed }: PassengersSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<ConfirmedUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  const handleOpen = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getRideConfirmedUsers(rideId);
      setUsers(data || []);
      setIsOpen(true);
    } catch (e) {
      console.error("Error loading confirmed users:", e);
      setError("No se pudieron cargar los usuarios.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setError(null);
  };

  const handleRemove = async (userId: number) => {
    if (!confirm(`¿Estás seguro de que quieres quitar a este pasajero del viaje?`)) {
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

    setRemovingId(userId);
    try {
      // Eliminar pasajero
      const ok = await removePassengerFromRide(rideId, userId, token);
      if (ok) {
        // Liberar asiento
        const seatResult = await freeSeat(rideId, token);
        if (seatResult.success) {
          // Actualizar la lista sin recargar
          setUsers(users.filter(u => u.id !== userId));
          
          // Notificar al componente padre para actualizar available_seats
          if (onSeatFreed && seatResult.available_seats !== undefined) {
            onSeatFreed(seatResult.available_seats);
          }
        } else {
          // Si falla liberar asiento, aún así actualizamos la lista
          setUsers(users.filter(u => u.id !== userId));
          alert("Pasajero eliminado, pero no se pudo liberar el asiento automáticamente.");
        }
      } else {
        alert("No se pudo expulsar al pasajero");
      }
    } catch (e) {
      console.error("Error removing passenger:", e);
      alert("Error al expulsar al pasajero");
    } finally {
      setRemovingId(null);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={handleOpen}
        className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors text-sm flex items-center space-x-2"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
        </svg>
        <span>Ver pasajeros</span>
      </button>
    );
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors text-sm flex items-center space-x-2"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
        </svg>
        <span>Ver pasajeros</span>
      </button>

      {/* Modal */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-md backdrop-saturate-200"
        onClick={handleClose}
      >
        <div
          className="relative bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-gray-200 transform transition-all max-h-[80vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-green-50 to-green-100 border-b border-green-200 rounded-t-xl px-8 py-6 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Pasajeros confirmados</h2>
                <p className="text-sm text-gray-600 mt-1">Conductor y pasajeros del viaje</p>
              </div>
              <button
                onClick={handleClose}
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
                <p className="text-gray-600">Cargando usuarios…</p>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <p className="text-red-600">{error}</p>
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-600">No hay usuarios confirmados todavía.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {users.map((user) => {
                  const avatarUrl = getAvatarUrl(user.avatar_url);
                  return (
                    <div
                      key={user.id}
                      className={`flex items-center space-x-4 p-4 border-2 border-gray-200 rounded-xl transition-all ${
                        !user.is_driver
                          ? "hover:border-green-500 hover:bg-green-50 cursor-pointer"
                          : ""
                      }`}
                      onClick={() => {
                        if (!user.is_driver) {
                          setSelectedUserId(user.id);
                        }
                      }}
                    >
                      {/* Avatar */}
                      <div className="relative w-14 h-14 flex-shrink-0">
                        {avatarUrl ? (
                          <>
                            <Image
                              src={avatarUrl}
                              alt={user.full_name}
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
                                {user.full_name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          </>
                        ) : (
                          <div className="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center border-2 border-white shadow-md">
                            <span className="text-white text-xl font-bold">
                              {user.full_name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* User Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {user.full_name}
                          </h3>
                          {user.is_driver && (
                            <span className="px-2 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-full">
                              Conductor
                            </span>
                          )}
                          {!user.is_driver && (
                            <span className="px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded-full">
                              Pasajero
                            </span>
                          )}
                        </div>
                        {typeof user.rating === "number" && user.rating > 0 && (
                          <p className="text-sm text-gray-600 mt-1">
                            ⭐ {user.rating.toFixed(1)}
                          </p>
                        )}
                      </div>

                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Passenger Profile Modal */}
      {selectedUserId && (
        <PassengerProfileModal
          isOpen={!!selectedUserId}
          userId={selectedUserId}
          rideId={rideId}
          onClose={() => setSelectedUserId(null)}
          onPassengerRemoved={(userId) => {
            setUsers(users.filter(u => u.id !== userId));
            setSelectedUserId(null);
          }}
          onSeatFreed={onSeatFreed}
        />
      )}
    </>
  );
}
