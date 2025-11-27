"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import DesktopLayout from "@/components/DesktopLayout";
import ConfirmModal from "@/components/ConfirmModal";
import RatingModal from "@/components/RatingModal";
import PassengerSelectionModal, { Passenger } from "@/components/PassengerSelectionModal";
import ActivityMapPreview from "@/components/ActivityMapPreview";
import TripGroupChat from "@/components/TripGroupChat";
import PassengersSection from "@/components/PassengersSection";
import { getToken, Ride, getMyRides, getMyBookings, cancelRide, cancelBooking, getRideHistory, RideHistoryItem, createRating, getCurrentUserId } from "@/lib/api";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function MyRidesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [driverRides, setDriverRides] = useState<Ride[]>([]);
  const [bookings, setBookings] = useState<Ride[]>([]);
  const [rideHistory, setRideHistory] = useState<RideHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [activeTab, setActiveTab] = useState<'driver' | 'passenger' | 'history'>('driver');
  const [cancelModal, setCancelModal] = useState<{
    isOpen: boolean;
    type: 'ride' | 'booking';
    rideId: number | null;
  }>({
    isOpen: false,
    type: 'ride',
    rideId: null,
  });
  const [ratingModal, setRatingModal] = useState<{
    isOpen: boolean;
    bookingId: number | null;
    ratedUserName: string; // Name of the person being rated
    ratedUserAvatar?: string | null; // Avatar of the person being rated
    ratedUserRole: "conductor" | "pasajero";
  }>({
    isOpen: false,
    bookingId: null,
    ratedUserName: "",
    ratedUserAvatar: null,
    ratedUserRole: "conductor",
  });
  const [passengerSelectionModal, setPassengerSelectionModal] = useState<{
    isOpen: boolean;
    rideId: number | null;
    passengers: Passenger[];
  }>({
    isOpen: false,
    rideId: null,
    passengers: [],
  });
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [chatModal, setChatModal] = useState<{
    isOpen: boolean;
    tripId: number | null;
  }>({
    isOpen: false,
    tripId: null,
  });

  useEffect(() => {
    const token = getToken();
    setIsLoggedIn(!!token);
    
    const userId = getCurrentUserId();
    setCurrentUserId(userId);
    
    if (token) {
      fetchMyRides();
      fetchMyBookings();
      fetchRideHistory();
    } else {
      setLoading(false);
    }

    // Check if we need to open a chat from notification
    const openChatParam = searchParams.get("openChat");
    if (openChatParam && currentUserId) {
      const tripId = parseInt(openChatParam, 10);
      if (!isNaN(tripId)) {
        setChatModal({ isOpen: true, tripId });
        // Remove the query parameter from URL
        router.replace("/my-rides", { scroll: false });
      }
    }

    // Set up auto-refresh every 60 seconds to update ride lists
    const refreshInterval = setInterval(() => {
      const currentToken = getToken();
      if (currentToken) {
        fetchMyRides();
        fetchMyBookings();
        fetchRideHistory();
      }
    }, 60000); // Refresh every minute

    // Refresh when tab becomes visible
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        const currentToken = getToken();
        if (currentToken) {
          fetchMyRides();
          fetchMyBookings();
          fetchRideHistory();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(refreshInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Handle opening chat from notification
  useEffect(() => {
    const openChatParam = searchParams.get("openChat");
    if (openChatParam && currentUserId) {
      const tripId = parseInt(openChatParam, 10);
      if (!isNaN(tripId)) {
        setChatModal({ isOpen: true, tripId });
        // Remove the query parameter from URL
        router.replace("/my-rides", { scroll: false });
      }
    }
  }, [searchParams, currentUserId, router]);

  const fetchMyRides = async () => {
    try {
      setLoading(true);
      const rides = await getMyRides();
      setDriverRides(rides);
    } catch (error) {
      console.error("Error fetching my rides:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyBookings = async () => {
    try {
      const bookings = await getMyBookings();
      // Filter out rejected bookings from "Mis reservas como pasajero"
      const filteredBookings = bookings.filter((ride) => ride.booking_status !== "rejected");
      setBookings(filteredBookings);
    } catch (error) {
      console.error("Error fetching bookings:", error);
    }
  };

  const fetchRideHistory = async () => {
    try {
      const history = await getRideHistory();
      setRideHistory(history);
    } catch (error) {
      console.error("Error fetching ride history:", error);
    }
  };

  const handleCancelRide = (rideId: number) => {
    setCancelModal({
      isOpen: true,
      type: 'ride',
      rideId: rideId,
    });
  };

  const handleCancelBooking = (rideId: number) => {
    setCancelModal({
      isOpen: true,
      type: 'booking',
      rideId: rideId,
    });
  };

  const confirmCancel = async () => {
    if (!cancelModal.rideId) return;

    try {
      if (cancelModal.type === 'ride') {
        await cancelRide(cancelModal.rideId);
        await fetchMyRides();
        await fetchRideHistory(); // Refresh history to show cancelled ride
      } else {
        await cancelBooking(cancelModal.rideId);
        await fetchMyBookings();
        await fetchRideHistory(); // Refresh history in case the ride was cancelled
      }
      setCancelModal({ isOpen: false, type: 'ride', rideId: null });
    } catch (error) {
      console.error("Error canceling:", error);
      alert(
        cancelModal.type === 'ride'
          ? "Error al cancelar el viaje. Por favor, intenta de nuevo."
          : "Error al cancelar la reserva. Por favor, intenta de nuevo."
      );
    }
  };

  const closeCancelModal = () => {
    setCancelModal({ isOpen: false, type: 'ride', rideId: null });
  };

  const handleRateClick = async (ride: RideHistoryItem) => {
    // For driver rides with multiple passengers, show passenger selection modal
    if (ride.role === "conductor" && ride.passengers && ride.passengers.length > 0) {
      setPassengerSelectionModal({
        isOpen: true,
        rideId: ride.id,
        passengers: ride.passengers,
      });
      return;
    }
    
    // For passenger rides or legacy driver rides (single passenger), use direct rating
    if (!ride.can_rate || !ride.booking_id) return;
    
    // Use the rated user information from the ride (the person being rated)
    const ratedUserName = ride.rated_user_name || ride.driver_name || "Usuario";
    const ratedUserAvatar = ride.rated_user_avatar || null;
    const ratedUserRole = ride.role === "conductor" ? "pasajero" : "conductor";
    
    setRatingModal({
      isOpen: true,
      bookingId: ride.booking_id,
      ratedUserName: ratedUserName,
      ratedUserAvatar: ratedUserAvatar,
      ratedUserRole: ratedUserRole,
    });
  };

  const handlePassengerSelect = (passenger: Passenger) => {
    // Open rating modal for selected passenger
    setRatingModal({
      isOpen: true,
      bookingId: passenger.booking_id,
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

  const handleRatingSubmit = async (rating: number, comment?: string) => {
    if (!ratingModal.bookingId) {
      throw new Error("No se pudo identificar la reserva");
    }

    await createRating({
      booking_id: ratingModal.bookingId,
      rating: rating,
      comment: comment,
    });

    // Refresh ride history to update has_rated and can_rate
    await fetchRideHistory();
  };

  const closeRatingModal = () => {
    setRatingModal({
      isOpen: false,
      bookingId: null,
      ratedUserName: "",
      ratedUserAvatar: null,
      ratedUserRole: "conductor",
    });
  };

  const handleProfileClick = () => {
    if (isLoggedIn) {
      router.push("/profile");
    } else {
      router.push("/login");
    }
  };

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  const getHistoryStatusBadge = (status?: "cancelled" | "completed" | "rejected") => {
    if (status === "cancelled") {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
          Cancelado
        </span>
      );
    } else if (status === "rejected") {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
          Rechazado
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
          Completado
        </span>
      );
    }
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

  const displayedRides = showInactive 
    ? driverRides 
    : driverRides.filter(ride => ride.is_active);

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
            <p className="text-gray-600">Cargando tus viajes...</p>
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
                <button className="flex items-center space-x-2 text-gray-700 hover:text-orange-600 transition-colors font-medium">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd"/>
                  </svg>
                  <span>Mis Viajes</span>
                </button>
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
          {/* Page Header with Tabs */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-6">Mis Viajes</h1>
            
            {/* Tabs */}
            <div className="flex space-x-4 border-b border-gray-200">
              <button
                onClick={() => setActiveTab('driver')}
                className={`pb-4 px-6 font-semibold text-lg border-b-2 transition-colors ${
                  activeTab === 'driver'
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Mis viajes como conductor
              </button>
              <button
                onClick={() => setActiveTab('passenger')}
                className={`pb-4 px-6 font-semibold text-lg border-b-2 transition-colors ${
                  activeTab === 'passenger'
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Mis reservas como pasajero
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`pb-4 px-6 font-semibold text-lg border-b-2 transition-colors ${
                  activeTab === 'history'
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Registro
              </button>
            </div>
          </div>

          {/* Toggle Button (only show for driver tab) */}
          {activeTab === 'driver' && (
            <div className="mb-6">
              <button
                onClick={() => setShowInactive(!showInactive)}
                className="text-orange-600 hover:text-orange-700 font-medium"
              >
                {showInactive ? "Mostrar Solo Viajes Activos" : "Mostrar También Viajes Inactivos"}
              </button>
            </div>
          )}

          {/* Content Based on Active Tab */}
          {activeTab === 'driver' && (
            /* My trips as a driver */
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
              {displayedRides.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-gray-600 text-lg mb-2">Aún no hay viajes</p>
                  <p className="text-gray-500">¡Comienza compartiendo tu viaje publicando un viaje!</p>
                  <Link href="/post-ride" className="mt-4 inline-block bg-orange-500 text-white px-6 py-3 rounded-lg font-medium hover:bg-orange-600 transition-colors">
                    Publica Tu Primer Viaje
                  </Link>
                </div>
              ) : (
                <div className="space-y-6">
                  {displayedRides.map((ride) => (
                    <div
                      key={ride.id}
                      className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-md transition-shadow hover:shadow-xl"
                    >
                      <ActivityMapPreview
                        originName={ride.departure_city}
                        destinationName={ride.destination_city}
                        originLat={ride.departure_lat}
                        originLng={ride.departure_lng}
                        destinationLat={ride.destination_lat}
                        destinationLng={ride.destination_lng}
                        className="h-48"
                      />
                      <div className="p-6">
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                          <div>
                            <div className="flex items-center gap-3 mb-3">
                              {getStatusBadge(ride.is_active)}
                            </div>
                            <div className="text-sm text-gray-500 uppercase tracking-[0.3em]">
                              {formatDate(ride.departure_date)} · {ride.departure_time}
                            </div>
                            <h3 className="text-2xl font-semibold text-gray-900">{ride.destination_city}</h3>
                            <p className="text-sm text-gray-500">
                              {ride.departure_city} → {ride.destination_city}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Precio por asiento</p>
                            <p className="text-2xl font-semibold text-gray-900">
                              {ride.price_per_seat.toFixed(2)} €
                            </p>
                          </div>
                        </div>

                        <div className="mt-6 grid grid-cols-1 gap-4 text-sm text-gray-600 md:grid-cols-3">
                          <div>
                            <span className="font-medium text-gray-900">Asientos disponibles:</span> {ride.available_seats}
                          </div>
                          <div>
                            <span className="font-medium text-gray-900">Vehículo:</span>{" "}
                            {ride.vehicle_brand || ride.vehicle_color
                              ? [ride.vehicle_brand, ride.vehicle_color].filter(Boolean).join(" ")
                              : "N/A"}
                          </div>
                          {ride.estimated_duration_minutes && (
                            <div>
                              <span className="font-medium text-gray-900">Duración:</span>{" "}
                              {formatDuration(ride.estimated_duration_minutes)}
                            </div>
                          )}
                        </div>

                        {ride.additional_details && (
                          <div className="mt-4 rounded-xl bg-gray-50 p-4 text-sm text-gray-600">
                            <span className="font-medium text-gray-900">Detalles:</span> {ride.additional_details}
                          </div>
                        )}

                        {ride.is_active && (
                          <div className="mt-6 flex justify-end gap-3">
                            {/* Chat Button - Show if trip has passengers */}
                            {(() => {
                              const passengersIds = Array.isArray(ride.passengers_ids) ? ride.passengers_ids : (ride.passengers_ids ? [ride.passengers_ids] : []);
                              const hasPassengers = passengersIds.length > 0;
                              const isDriver = currentUserId === ride.driver_id;
                              const isPassenger = hasPassengers && passengersIds.includes(currentUserId || 0);
                              const canSeeChat = hasPassengers && (isDriver || isPassenger);
                              
                              if (canSeeChat) {
                                return (
                                  <button
                                    onClick={() => setChatModal({ isOpen: true, tripId: ride.id })}
                                    className="px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors text-sm flex items-center space-x-2"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                    </svg>
                                    <span>Chat del Viaje</span>
                                  </button>
                                );
                              }
                              return null;
                            })()}
                            <button
                              onClick={() => handleCancelRide(ride.id)}
                              className="px-4 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors text-sm"
                            >
                              Cancelar Viaje
                            </button>
                          </div>
                        )}

                        {/* Passengers Section - Only for driver */}
                        {ride.is_active && currentUserId === ride.driver_id && (
                          <PassengersSection
                            rideId={ride.id}
                            onSeatFreed={(newAvailableSeats) => {
                              // Actualizar available_seats en el estado local
                              setDriverRides((prevRides) =>
                                prevRides.map((r) =>
                                  r.id === ride.id
                                    ? { ...r, available_seats: newAvailableSeats }
                                    : r
                                )
                              );
                            }}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'passenger' && (
            /* My bookings as a passenger */
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
              {bookings.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <p className="text-gray-600 text-lg mb-2">Aún no hay reservas</p>
                  <p className="text-gray-500">Reserva asientos en viajes disponibles para verlos aquí</p>
                  <Link href="/" className="mt-4 inline-block text-orange-600 hover:text-orange-700 font-medium">
                    Explorar Viajes Disponibles →
                  </Link>
                </div>
              ) : (
                <div className="space-y-6">
                  {bookings.map((ride) => (
                    <div
                      key={ride.id}
                      className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-md transition-shadow hover:shadow-xl"
                    >
                      <ActivityMapPreview
                        originName={ride.departure_city}
                        destinationName={ride.destination_city}
                        originLat={ride.departure_lat}
                        originLng={ride.departure_lng}
                        destinationLat={ride.destination_lat}
                        destinationLng={ride.destination_lng}
                        className="h-48"
                      />
                      <div className="p-6">
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                          <div>
                            <div className="flex items-center gap-3 mb-3">
                              {ride.booking_status === 'pending' && (
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                                  Pendiente de confirmación
                                </span>
                              )}
                              {ride.booking_status === 'confirmed' && (
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                                  Confirmado
                                </span>
                              )}
                              {ride.booking_status === 'rejected' && (
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                                  Rechazado
                                </span>
                              )}
                              {!ride.booking_status && (
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                                  Reservado
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-500 uppercase tracking-[0.3em]">
                              {formatDate(ride.departure_date)} · {ride.departure_time}
                            </div>
                            <h3 className="text-2xl font-semibold text-gray-900">{ride.destination_city}</h3>
                            <p className="text-sm text-gray-500">
                              {ride.departure_city} → {ride.destination_city}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Precio por asiento</p>
                            <p className="text-2xl font-semibold text-gray-900">
                              {ride.price_per_seat.toFixed(2)} €
                            </p>
                          </div>
                        </div>

                        <div className="mt-6 grid grid-cols-1 gap-4 text-sm text-gray-600 md:grid-cols-3">
                          <div>
                            <span className="font-medium text-gray-900">Conductor:</span> {ride.driver_name}
                          </div>
                          <div>
                            <span className="font-medium text-gray-900">Vehículo:</span>{" "}
                            {ride.vehicle_brand || ride.vehicle_color
                              ? [ride.vehicle_brand, ride.vehicle_color].filter(Boolean).join(" ")
                              : "N/A"}
                          </div>
                          {ride.estimated_duration_minutes && (
                            <div>
                              <span className="font-medium text-gray-900">Duración:</span>{" "}
                              {formatDuration(ride.estimated_duration_minutes)}
                            </div>
                          )}
                        </div>

                        {ride.additional_details && (
                          <div className="mt-4 rounded-xl bg-gray-50 p-4 text-sm text-gray-600">
                            <span className="font-medium text-gray-900">Detalles:</span> {ride.additional_details}
                          </div>
                        )}

                        <div className="mt-6 flex justify-end gap-3">
                          {/* Chat Button - Show if trip has passengers and user is passenger */}
                          {(() => {
                            const passengersIds = Array.isArray(ride.passengers_ids) ? ride.passengers_ids : (ride.passengers_ids ? [ride.passengers_ids] : []);
                            const hasPassengers = passengersIds.length > 0;
                            const isPassenger = hasPassengers && passengersIds.includes(currentUserId || 0);
                            const canSeeChat = hasPassengers && isPassenger;
                            
                            if (canSeeChat) {
                              return (
                                <button
                                  onClick={() => setChatModal({ isOpen: true, tripId: ride.id })}
                                  className="px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors text-sm flex items-center space-x-2"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                  </svg>
                                  <span>Chat del Viaje</span>
                                </button>
                              );
                            }
                            return null;
                          })()}
                          <button
                            onClick={() => handleCancelBooking(ride.id)}
                            className="px-4 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors text-sm"
                          >
                            Cancelar Reserva
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            /* Ride History / Registro */
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
              {rideHistory.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-gray-600 text-lg mb-2">Aún no hay viajes en el registro</p>
                  <p className="text-gray-500">Los viajes completados aparecerán aquí automáticamente</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {rideHistory.map((ride, index) => (
                    <div
                      key={ride.booking_id ? `${ride.id}-${ride.booking_id}` : `${ride.id}-${index}`}
                      className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-md transition-shadow hover:shadow-xl"
                    >
                      <ActivityMapPreview
                        originName={ride.departure_city}
                        destinationName={ride.destination_city}
                        originLat={ride.departure_lat}
                        originLng={ride.departure_lng}
                        destinationLat={ride.destination_lat}
                        destinationLng={ride.destination_lng}
                        className="h-48"
                      />
                      <div className="p-6">
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                          <div>
                            <div className="flex items-center gap-3 mb-3">
                              {getRoleBadge(ride.role)}
                              {getHistoryStatusBadge(ride.status)}
                            </div>
                            <div className="text-sm text-gray-500 uppercase tracking-[0.3em]">
                              {formatDate(ride.departure_date)} · {ride.departure_time}
                            </div>
                            <h3 className="text-2xl font-semibold text-gray-900">{ride.destination_city}</h3>
                            <p className="text-sm text-gray-500">
                              {ride.departure_city} → {ride.destination_city}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Total</p>
                            <p className="text-2xl font-semibold text-gray-900">
                              {ride.price_per_seat.toFixed(2)} €
                            </p>
                          </div>
                        </div>

                        <div className="mt-6 grid grid-cols-1 gap-4 text-sm text-gray-600 md:grid-cols-3">
                          {ride.role === "pasajero" && (
                            <div>
                              <span className="font-medium text-gray-900">Conductor:</span> {ride.driver_name}
                            </div>
                          )}
                          <div>
                            <span className="font-medium text-gray-900">Vehículo:</span>{" "}
                            {ride.vehicle_brand || ride.vehicle_color
                              ? [ride.vehicle_brand, ride.vehicle_color].filter(Boolean).join(" ")
                              : "N/A"}
                          </div>
                          {ride.estimated_duration_minutes && (
                            <div>
                              <span className="font-medium text-gray-900">Duración:</span>{" "}
                              {Math.floor(ride.estimated_duration_minutes / 60)}h {ride.estimated_duration_minutes % 60}min
                            </div>
                          )}
                        </div>

                        {ride.additional_details && (
                          <div className="mt-4 rounded-xl bg-gray-50 p-4 text-sm text-gray-600">
                            <span className="font-medium text-gray-900">Detalles:</span> {ride.additional_details}
                          </div>
                        )}

                        {/* Show rating button for drivers if there are pending passengers, or for passengers if can_rate */}
                        {((ride.role === "conductor" && ride.has_pending_ratings) || (ride.role === "pasajero" && ride.can_rate && ride.booking_id)) && (
                          <div className="mt-6 flex justify-end">
                            <button
                              onClick={() => handleRateClick(ride)}
                              className="px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors text-sm"
                            >
                              Valorar
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Cancel Confirmation Modal */}
      <ConfirmModal
        isOpen={cancelModal.isOpen}
        title={
          cancelModal.type === 'ride'
            ? "Cancelar Viaje"
            : "Cancelar Reserva"
        }
        message={
          cancelModal.type === 'ride'
            ? "¿Estás seguro de que quieres cancelar este viaje? Esta acción no se puede deshacer."
            : "¿Estás seguro de que quieres cancelar esta reserva? Los asientos se liberarán automáticamente."
        }
        confirmText="Sí, cancelar"
        cancelText="No, mantener"
        confirmButtonColor="red"
        onConfirm={confirmCancel}
        onCancel={closeCancelModal}
      />

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

      {/* Group Chat Modal */}
              {chatModal.isOpen && chatModal.tripId && currentUserId && (
                <TripGroupChat
                  isOpen={chatModal.isOpen}
                  onClose={() => setChatModal({ isOpen: false, tripId: null })}
                  tripId={chatModal.tripId}
                  currentUserId={currentUserId}
                />
              )}

            </DesktopLayout>
          );
        }

