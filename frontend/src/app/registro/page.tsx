"use client";

import { useState, useEffect } from "react";
import DesktopLayout from "@/components/DesktopLayout";
import PassengerSelectionModal, { Passenger } from "@/components/PassengerSelectionModal";
import RatingModal from "@/components/RatingModal";
import { getToken, getRideHistory, RideHistoryItem, createRatingByRide, hasRated, getCurrentUserId } from "@/lib/api";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegistroPage() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [history, setHistory] = useState<RideHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);
  const [ratingModal, setRatingModal] = useState<{
    isOpen: boolean;
    rideId: number | null;
    ratedId: number | null;
    ratedUserName: string;
    ratedUserAvatar?: string | null;
    ratedUserRole: "conductor" | "pasajero";
  }>({
    isOpen: false,
    rideId: null,
    ratedId: null,
    ratedUserName: "",
    ratedUserAvatar: null,
    ratedUserRole: "conductor",
  });
  const [hasRatedMap, setHasRatedMap] = useState<Record<string, boolean>>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [ratingButtonsState, setRatingButtonsState] = useState<Record<number, { show: boolean; otherUserId: number | null }>>({});
  const [passengerSelectionModal, setPassengerSelectionModal] = useState<{
    isOpen: boolean;
    rideId: number | null;
    passengers: Passenger[];
  }>({
    isOpen: false,
    rideId: null,
    passengers: [],
  });

  useEffect(() => {
    const token = getToken();
    setIsLoggedIn(!!token);
    
    if (token) {
      fetchHistory();
    } else {
      setLoading(false);
    }

    // Set up auto-refresh every 60 seconds to update ride history
    const refreshInterval = setInterval(() => {
      const currentToken = getToken();
      if (currentToken) {
        fetchHistory();
      }
    }, 60000); // Refresh every minute

    // Refresh when tab becomes visible
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        const currentToken = getToken();
        if (currentToken) {
          fetchHistory();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(refreshInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const rideHistory = await getRideHistory();
      console.log("Ride history data:", rideHistory); // Debug log
      setHistory(rideHistory);
      
      // Check which rides should show rating button
      const currentUserId = getCurrentUserId();
      if (!currentUserId) {
        setLoading(false);
        return;
      }
      
      const buttonsState: Record<number, { show: boolean; otherUserId: number | null }> = {};
      const ratedChecks: Record<string, boolean> = {};
      
      // Process checks in parallel for better performance
      const checkPromises = rideHistory
        .filter(ride => ride.status === "completed")
        .map(async (ride) => {
          // Determine other user ID
          let otherUserId: number | null = null;
          const isDriver = ride.driver_id === currentUserId;
          
          if (isDriver) {
            // Driver rating passenger
            if (ride.passengers && ride.passengers.length > 0) {
              otherUserId = ride.passengers[0].passenger_id;
            } else if (ride.rated_user_id) {
              otherUserId = ride.rated_user_id;
            }
          } else {
            // Passenger rating driver
            otherUserId = ride.driver_id;
          }
          
          if (!otherUserId) {
            buttonsState[ride.id] = { show: false, otherUserId: null };
            return;
          }
          
          // Check if already rated
          try {
            const hasRatedResult = await hasRated(ride.id, currentUserId, otherUserId);
            const key = `${ride.id}-${currentUserId}-${otherUserId}`;
            ratedChecks[key] = hasRatedResult;
            
            // Show button if not rated
            buttonsState[ride.id] = {
              show: !hasRatedResult,
              otherUserId: otherUserId
            };
            
            console.log(`Ride ${ride.id}: isDriver=${isDriver}, otherUserId=${otherUserId}, hasRated=${hasRatedResult}`);
          } catch (error) {
            console.error(`Error checking rating for ride ${ride.id}:`, error);
            // On error, show button (default to allowing rating)
            buttonsState[ride.id] = {
              show: true,
              otherUserId: otherUserId
            };
          }
        });
      
      await Promise.all(checkPromises);
      setHasRatedMap(ratedChecks);
      setRatingButtonsState(buttonsState);
      console.log("Rating buttons state:", buttonsState);
    } catch (error) {
      console.error("Error fetching ride history:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRateClick = (ride: RideHistoryItem) => {
    const currentUserId = getCurrentUserId();
    if (!currentUserId) {
      console.error("No current user ID");
      return;
    }
    
    // Get other user ID from button state
    const buttonState = ratingButtonsState[ride.id];
    if (!buttonState || !buttonState.otherUserId) {
      console.error("No otherUserId found in button state");
      return;
    }
    
    const otherUserId = buttonState.otherUserId;
    const isDriver = ride.driver_id === currentUserId;
    
    let ratedUserName = "";
    let ratedUserAvatar: string | null = null;
    
    if (isDriver) {
      // Driver rating passenger
      if (ride.passengers && ride.passengers.length > 0) {
        const passenger = ride.passengers.find(p => p.passenger_id === otherUserId) || ride.passengers[0];
        ratedUserName = passenger.passenger_name;
        ratedUserAvatar = passenger.passenger_avatar || null;
      } else if (ride.rated_user_name) {
        ratedUserName = ride.rated_user_name;
        ratedUserAvatar = ride.rated_user_avatar || null;
      } else {
        ratedUserName = "Pasajero";
      }
    } else {
      // Passenger rating driver
      ratedUserName = ride.driver_name || "Conductor";
      ratedUserAvatar = null;
    }
    
    setRatingModal({
      isOpen: true,
      rideId: ride.id,
      ratedId: otherUserId,
      ratedUserName: ratedUserName,
      ratedUserAvatar: ratedUserAvatar,
      ratedUserRole: isDriver ? "pasajero" : "conductor",
    });
  };

  const handlePassengerSelect = (passenger: Passenger) => {
    // Find the ride for this passenger
    const ride = history.find(r => r.id === passenger.ride_id || (r.passengers && r.passengers.some(p => p.passenger_id === passenger.passenger_id)));
    if (!ride) return;
    
    setRatingModal({
      isOpen: true,
      rideId: ride.id,
      ratedId: passenger.passenger_id,
      ratedUserName: passenger.passenger_name,
      ratedUserAvatar: passenger.passenger_avatar || null,
      ratedUserRole: "pasajero",
    });
    setPassengerSelectionModal({
      isOpen: false,
      rideId: null,
      passengers: [],
    });
  };

  const closePassengerSelectionModal = () => {
    setPassengerSelectionModal({
      isOpen: false,
      rideId: null,
      passengers: [],
    });
  };

  const closeRatingModal = () => {
    setRatingModal({
      isOpen: false,
      rideId: null,
      ratedId: null,
      ratedUserName: "",
      ratedUserAvatar: null,
      ratedUserRole: "conductor",
    });
  };

  const handleRatingSubmit = async (score: number, comment?: string) => {
    const currentUserId = getCurrentUserId();
    if (!ratingModal.rideId || !ratingModal.ratedId || !currentUserId) {
      throw new Error("No se pudo identificar el viaje o el usuario");
    }

    await createRatingByRide({
      ride_id: ratingModal.rideId,
      rated_id: ratingModal.ratedId,
      score: score,
      comment: comment,
    });

    // Update hasRatedMap and button state
    const key = `${ratingModal.rideId}-${currentUserId}-${ratingModal.ratedId}`;
    setHasRatedMap(prev => ({ ...prev, [key]: true }));
    
    // Hide button for this ride
    setRatingButtonsState(prev => ({
      ...prev,
      [ratingModal.rideId]: { show: false, otherUserId: ratingModal.ratedId }
    }));
    
    // Show success message
    setSuccessMessage("¡Valoración enviada correctamente!");
    setTimeout(() => setSuccessMessage(null), 3000);

    // Refresh ride history
    await fetchHistory();
    closeRatingModal();
  };

  const handleProfileClick = () => {
    if (isLoggedIn) {
      router.push("/profile");
    } else {
      router.push("/login");
    }
  };

  const formatDate = (dateString: string) => {
    if (!mounted) return ""; // Return empty string during SSR
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const getRoleBadge = (role: "conductor" | "pasajero") => {
    if (role === "conductor") {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-800">
          Conductor
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
          Pasajero
        </span>
      );
    }
  };

  // Redirect if not logged in
  useEffect(() => {
    if (!isLoggedIn && !loading) {
      router.push("/login");
    }
  }, [isLoggedIn, loading, router]);

  if (loading) {
    return (
      <DesktopLayout showSidebar={false}>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando registro de viajes...</p>
          </div>
        </div>
      </DesktopLayout>
    );
  }

  return (
    <DesktopLayout showSidebar={false}>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="px-8 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center shadow-md">
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"/>
                    <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1V8a1 1 0 00-1-1h-3z"/>
                  </svg>
                </div>
                <span className="text-2xl font-bold text-gray-800">UniGO</span>
              </div>

              <div className="flex items-center space-x-8">
                <Link href="/" className="flex items-center space-x-2 text-gray-600 hover:text-orange-600 transition-colors font-medium">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.707.707a1 1 0 001.414-1.414l-7-7z"/>
                  </svg>
                  <span>Inicio</span>
                </Link>
                <Link href="/my-rides" className="flex items-center space-x-2 text-gray-600 hover:text-orange-600 transition-colors font-medium">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd"/>
                  </svg>
                  <span>Mis Viajes</span>
                </Link>
                <button
                  onClick={handleProfileClick}
                  className="flex items-center space-x-2 text-gray-600 hover:text-orange-600 transition-colors font-medium cursor-pointer"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/>
                  </svg>
                  <span>Perfil</span>
                </button>
                <Link href="/post-ride" className="bg-orange-500 text-white px-6 py-2 rounded-lg font-medium hover:bg-orange-600 transition-colors flex items-center space-x-2 shadow-md">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd"/>
                  </svg>
                  <span>Publicar Viaje</span>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-8 py-12">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-2">Registro de Viajes</h1>
            <p className="text-gray-600">Historial de viajes completados</p>
          </div>

          {/* Content */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            {history.length === 0 ? (
              <div className="text-center py-12">
                <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-gray-600 text-lg mb-2">Aún no hay viajes en el registro</p>
                <p className="text-gray-500">Los viajes completados aparecerán aquí automáticamente</p>
              </div>
            ) : (
              <div className="space-y-6">
                {history.map((ride) => {
                  return (
                  <div
                    key={ride.id}
                    className="bg-white border-2 border-gray-200 rounded-2xl p-6 hover:shadow-lg hover:border-orange-300 transition-all duration-200"
                  >
                    {/* Header with role badge and status */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        {getRoleBadge(ride.role)}
                        {ride.status && (
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                            ride.status === "completed" 
                              ? "bg-green-100 text-green-800" 
                              : "bg-red-100 text-red-800"
                          }`}>
                            {ride.status === "completed" ? "Completado" : ride.status === "rejected" ? "Rechazado" : "Cancelado"}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Route Information */}
                    <div className="flex items-start space-x-6 mb-4 pb-4 border-b border-gray-200">
                      <div className="flex items-center space-x-3">
                        <div className="text-3xl font-bold text-gray-800">{ride.departure_time}</div>
                        <div>
                          <div className="text-xl font-bold text-gray-900">{ride.departure_city}</div>
                          <div className="text-sm text-gray-500">{formatDate(ride.departure_date)}</div>
                        </div>
                      </div>
                      
                      <svg className="w-8 h-8 text-orange-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                      
                      <div className="flex-1 flex items-center space-x-3">
                        <div>
                          <div className="text-xl font-bold text-gray-900">{ride.destination_city}</div>
                        </div>
                        {ride.arrival_time && (
                          <div className="text-3xl font-bold text-gray-800">{ride.arrival_time}</div>
                        )}
                      </div>
                    </div>
                    
                    {/* Details Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                      {ride.role === "pasajero" && (
                        <div className="bg-gray-50 rounded-lg p-3">
                          <div className="text-xs text-gray-500 mb-1">Conductor</div>
                          <div className="font-semibold text-gray-900">{ride.driver_name}</div>
                        </div>
                      )}
                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="text-xs text-gray-500 mb-1">Precio por asiento</div>
                        <div className="font-semibold text-gray-900">{ride.price_per_seat.toFixed(2)} €</div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="text-xs text-gray-500 mb-1">Vehículo</div>
                        <div className="font-semibold text-gray-900">
                          {ride.vehicle_brand || ride.vehicle_color 
                            ? [ride.vehicle_brand, ride.vehicle_color].filter(Boolean).join(' ')
                            : 'N/A'}
                        </div>
                      </div>
                      {ride.estimated_duration_minutes && (
                        <div className="bg-gray-50 rounded-lg p-3">
                          <div className="text-xs text-gray-500 mb-1">Duración</div>
                          <div className="font-semibold text-gray-900">
                            {Math.floor(ride.estimated_duration_minutes / 60)}h {ride.estimated_duration_minutes % 60}min
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Additional Details */}
                    {ride.additional_details && (
                      <div className="mt-4 text-sm text-gray-600 bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <span className="font-semibold text-gray-900">Detalles adicionales: </span>
                        {ride.additional_details}
                      </div>
                    )}
                    
                    {/* Precio Total */}
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-700">Precio total:</span>
                        <span className="text-xl font-bold text-gray-900">{ride.price_per_seat.toFixed(2)} €</span>
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="fixed bottom-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 flex items-center space-x-2">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span>{successMessage}</span>
        </div>
      )}

      {/* Rating Modal */}
      <RatingModal
        isOpen={ratingModal.isOpen}
        ratedUserName={ratingModal.ratedUserName}
        ratedUserAvatar={ratingModal.ratedUserAvatar}
        ratedUserRole={ratingModal.ratedUserRole}
        onClose={closeRatingModal}
        onSubmit={handleRatingSubmit}
      />

      {/* Passenger Selection Modal */}
      <PassengerSelectionModal
        isOpen={passengerSelectionModal.isOpen}
        passengers={passengerSelectionModal.passengers}
        onClose={closePassengerSelectionModal}
        onSelectPassenger={handlePassengerSelect}
      />
    </DesktopLayout>
  );
}

