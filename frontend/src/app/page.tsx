"use client";

import { useState, useEffect } from "react";
import DesktopLayout from "@/components/DesktopLayout";
import { getToken, Ride, getProfile, getRide, SearchRidesResponse } from "@/lib/api";
import { useRouter } from "next/navigation";
import Link from "next/link";
import RideCard from "@/components/RideCard";
import RideDetail from "@/components/RideDetail";
import AddressAutocomplete, { AddressValue } from "@/components/AddressAutocomplete";
import { addToSearchHistory } from "@/utils/searchHistory";
import { isProfileComplete } from "@/utils/isProfileComplete";
import { useToast } from "@/hooks/useToast";
import AutoSearchModal from "@/components/AutoSearchModal";
import ProfileIncompleteModal from "@/components/ProfileIncompleteModal";
import { listPaymentMethods, PaymentMethod } from "@/lib/api";

const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000/api";

type ViewState = 'search' | 'results' | 'detail';

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentView, setCurrentView] = useState<ViewState>('search');
  const [searchResults, setSearchResults] = useState<SearchRidesResponse>({ exact_matches: [], nearby_matches: [] });
  const { showToast, ToastComponent } = useToast();
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);
  const [searchParams, setSearchParams] = useState<{from: AddressValue | null, to: AddressValue | null, date: string} | null>(null);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string | null>(null);
  const [fromAddress, setFromAddress] = useState<AddressValue | null>(null);
  const [toAddress, setToAddress] = useState<AddressValue | null>(null);
  const [fromError, setFromError] = useState<string>("");
  const [toError, setToError] = useState<string>("");
  const [userUniversity, setUserUniversity] = useState<string | null>(null);
  const [userHomeAddress, setUserHomeAddress] = useState<AddressValue | null>(null);
  const [userProfile, setUserProfile] = useState<{
    full_name?: string | null;
    university?: string | null;
    degree?: string | null;
    course?: number | null;
    home_address?: {
      formatted_address: string;
      place_id: string;
      lat: number;
      lng: number;
    } | null;
  } | null>(null);
  const [autoSearchModalOpen, setAutoSearchModalOpen] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Check if user is logged in
    const token = getToken();
    setIsLoggedIn(!!token);
    
    // Fetch current user ID and profile if logged in
    if (token) {
      fetchCurrentUserId();
      fetchUserProfile();
    }
  }, []);

  const fetchUserProfile = async () => {
    try {
      const profile = await getProfile();
      // Store full profile for validation
      setUserProfile({
        full_name: profile.full_name,
        university: profile.university,
        degree: profile.degree,
        course: profile.course,
        home_address: profile.home_address || undefined,
      });
      
      if (profile?.university) {
        setUserUniversity(profile.university);
      }
      if (profile?.home_address) {
        const addressValue: AddressValue = {
          formattedAddress: profile.home_address.formatted_address,
          placeId: profile.home_address.place_id,
          lat: profile.home_address.lat,
          lng: profile.home_address.lng,
        };
        setUserHomeAddress(addressValue);
      }
    } catch (error) {
      console.error("Error fetching user profile:", error);
      // Don't show error to user, just continue without recommendations
    }
  };

  const fetchCurrentUserId = async () => {
    try {
      // Decode JWT token to get user ID
      const token = getToken();
      if (token) {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        
        const decoded = JSON.parse(jsonPayload);
        console.log("Decoded JWT:", decoded);
        const userId = parseInt(decoded.sub);
        console.log("Setting current user ID:", userId);
        setCurrentUserId(userId);
      }
    } catch (error) {
      console.error("Error fetching user ID:", error);
    }
  };

  const handleSearch = async (date: string) => {
    // Clear any previous errors
    setFromError("");
    setToError("");
    
    // Allow empty addresses - only validate if an address is partially entered but not selected
    // If user has typed something but not selected from dropdown, show error
    // But allow completely empty fields
    
    console.log("Search data:", { from: fromAddress, to: toAddress, date });
    
    try {
      // Build query parameters - use formatted address if available, otherwise empty string
      const params = new URLSearchParams();
      if (fromAddress && fromAddress.formattedAddress) {
        params.append('departure_city', fromAddress.formattedAddress);
      }
      if (toAddress && toAddress.formattedAddress) {
        params.append('destination_city', toAddress.formattedAddress);
      }
      if (date) {
        params.append('departure_date', date);
      }
      // Add coordinates if available
      if (fromAddress && fromAddress.lat !== undefined && fromAddress.lng !== undefined) {
        params.append('departure_lat', fromAddress.lat.toString());
        params.append('departure_lng', fromAddress.lng.toString());
      }
      if (toAddress && toAddress.lat !== undefined && toAddress.lng !== undefined) {
        params.append('destination_lat', toAddress.lat.toString());
        params.append('destination_lng', toAddress.lng.toString());
      }

      const token = getToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const response = await fetch(`${BASE}/rides/search?${params.toString()}`, {
        headers,
      });
      
      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }

      const searchResponse: SearchRidesResponse = await response.json();
      console.log("Search results:", searchResponse);
      
      // Filter out current user's rides from both exact and nearby matches
      const filterRides = (rides: Ride[]) => {
        return currentUserId 
          ? rides.filter((ride: Ride) => {
              const shouldShow = ride.driver_id !== currentUserId;
              console.log(`Ride ${ride.id}: driver_id=${ride.driver_id}, shouldShow=${shouldShow}`);
              return shouldShow;
            })
          : rides;
      };
      
      const filteredExact = filterRides(searchResponse.exact_matches);
      const filteredNearby = filterRides(searchResponse.nearby_matches);
      
      console.log("Search results after filtering:", { exact: filteredExact, nearby: filteredNearby });
      setSearchResults({
        exact_matches: filteredExact,
        nearby_matches: filteredNearby
      });
      setSearchParams({ from: fromAddress, to: toAddress, date });
      
      // Save search history
      if (fromAddress?.formattedAddress) {
        addToSearchHistory(
          fromAddress.formattedAddress,
          'departure',
          fromAddress.placeId,
          fromAddress.lat,
          fromAddress.lng
        );
      }
      if (toAddress?.formattedAddress) {
        addToSearchHistory(
          toAddress.formattedAddress,
          'destination',
          toAddress.placeId,
          toAddress.lat,
          toAddress.lng
        );
      }
      
    } catch (error: any) {
      console.error("Search error:", error);
      if (error?.message?.includes("Failed to fetch")) {
        alert("Cannot connect to the server. Please make sure the backend is running.\n\nRun: make backend");
      } else {
        alert(`Error searching rides: ${error?.message || "Unknown error"}`);
      }
    }
  };

  const handleRideClick = async (ride: Ride) => {
    try {
      // Reload ride from API to ensure we have all fields (passengers, passengers_ids, etc.)
      const fullRide = await getRide(ride.id);
      // Ensure passengers and passengers_ids are arrays (not undefined)
      if (!fullRide.passengers) {
        fullRide.passengers = [];
      }
      if (!fullRide.passengers_ids) {
        fullRide.passengers_ids = [];
      }
      setSelectedRide(fullRide);
      setCurrentView('detail');
    } catch (error) {
      console.error("Error loading ride details:", error);
      // Fallback to using the ride from search results if API call fails
      // Ensure passengers and passengers_ids are arrays
      if (!ride.passengers) {
        ride.passengers = [];
      }
      if (!ride.passengers_ids) {
        ride.passengers_ids = [];
      }
      setSelectedRide(ride);
      setCurrentView('detail');
    }
  };

  const handleBackToResults = () => {
    setCurrentView('search');
    setSelectedRide(null);
  };

  const handleContact = async () => {
    if (!selectedRide) return;
    
    const token = getToken();
    if (!token) {
      alert("You must be logged in to make a reservation. Please login first.");
      router.push("/login");
      return;
    }

    // Validate profile BEFORE making the request
    if (!isProfileComplete(userProfile)) {
      showToast("Debes completar tu perfil para poder realizar esta acción.");
      return;
    }

    // VALIDATE PAYMENT METHODS - Must block if no cards (same as alerts)
    try {
      const cards = await listPaymentMethods();
      console.log("[RESERVATION] Payment methods check:", cards?.length || 0, "cards found");
      
      // CRITICAL: Block reservation if no cards
      if (!cards || cards.length === 0) {
        console.log("[RESERVATION] ❌ NO CARDS - BLOCKING RESERVATION");
        showToast("Debes añadir un método de pago antes de reservar un viaje");
        router.push("/my-cards");
        return; // STOP HERE - DO NOT CONTINUE
      }
      
      console.log("[RESERVATION] ✅ CARDS FOUND - Proceeding with booking");
      
      // If we have cards, proceed with booking
      let cardToUse = cards[0];
      const defaultCard = cards.find(card => card.is_default);
      if (defaultCard) {
        cardToUse = defaultCard;
      }
      
      await proceedWithBooking(cardToUse.id);
    } catch (error: any) {
      console.error("[RESERVATION] ❌ ERROR checking payment methods:", error);
      // On error, block reservation
      showToast("Debes añadir un método de pago antes de reservar un viaje");
      router.push("/my-cards");
      return; // STOP HERE - DO NOT CONTINUE
    }
  };

  const proceedWithBooking = async (paymentMethodId: string) => {
    if (!selectedRide) return;
    
    const token = getToken();
    if (!token) return;

    try {
      console.log("Booking ride:", selectedRide.id);
      const response = await fetch(`${BASE}/rides/${selectedRide.id}/book?seats=1`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (response.ok) {
        // Booking created successfully
        setBookingSuccess(true);
        // Update available seats locally
        const updatedRide = { ...selectedRide, available_seats: selectedRide.available_seats - 1 };
        setSelectedRide(updatedRide);
        // Also update in search results if it's there
        setSearchResults(prevResults => ({
          exact_matches: prevResults.exact_matches.map(ride => 
            ride.id === selectedRide.id 
              ? { ...ride, available_seats: ride.available_seats - 1 }
              : ride
          ),
          nearby_matches: prevResults.nearby_matches.map(ride => 
            ride.id === selectedRide.id 
              ? { ...ride, available_seats: ride.available_seats - 1 }
              : ride
          )
        }));
      } else {
        const errorText = await response.text();
        let errorDetail = "";
        try {
          const errorJson = JSON.parse(errorText);
          errorDetail = errorJson.detail || "";
        } catch {
          errorDetail = errorText;
        }
        
        // Check if it's a profile incomplete error (fallback - should not happen if validation works)
        if (
          response.status === 400 &&
          (errorDetail === "Debes completar tu perfil antes de reservar un viaje." ||
           errorDetail === "Debes completar tu perfil antes de publicar un viaje.")
        ) {
          showToast("Debes completar tu perfil para poder realizar esta acción.");
          return;
        }
        throw new Error(errorText || `Booking failed: ${response.status}`);
      }
    } catch (error: any) {
      console.error("Booking error:", error);
      // Check if error message contains profile incomplete message (fallback)
      const errorMessage = error?.message || "";
      if (
        errorMessage.includes("Debes completar tu perfil antes de reservar un viaje") ||
        errorMessage.includes("Debes completar tu perfil antes de publicar un viaje")
      ) {
        showToast("Debes completar tu perfil para poder realizar esta acción.");
        return;
      }
      alert("❌ Failed to make booking. Please try again later.");
    }
  };

  const handleReturnHome = () => {
    setBookingSuccess(false);
    setCurrentView('search');
    setSelectedRide(null);
    router.push("/");
  };

  const handleProfileClick = () => {
    if (isLoggedIn) {
      router.push("/profile");
    } else {
      router.push("/login");
    }
  };

  // Show detail view
  if (currentView === 'detail' && selectedRide) {
    return (
      <RideDetail 
        ride={selectedRide} 
        onBack={handleBackToResults}
        onContact={handleContact}
        bookingSuccess={bookingSuccess}
        onReturnHome={handleReturnHome}
      />
    );
  }

  // Show search view
  return (
    <DesktopLayout showSidebar={false}>
      {/* Main Content with Orange Gradient */}
      <div className="min-h-screen bg-gradient-to-b from-orange-400 via-orange-500 to-orange-600">
        {/* Header Navigation */}
        <div className="bg-white px-8 py-4 shadow-sm">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center shadow-md">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"/>
                  <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1V8a1 1 0 00-1-1h-3z"/>
                </svg>
              </div>
              <span className="text-2xl font-bold text-gray-800">UniGO</span>
            </div>

            {/* Navigation Links */}
            <div className="flex items-center space-x-8">
              <button className="flex items-center space-x-2 text-gray-700 hover:text-orange-600 transition-colors font-medium">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.707.707a1 1 0 001.414-1.414l-7-7z"/>
                </svg>
                <span>Inicio</span>
              </button>
                <Link href="/my-rides" className="flex items-center space-x-2 text-gray-600 hover:text-orange-600 transition-colors font-medium">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd"/>
                  </svg>
                  <span>Mis Viajes</span>
                </Link>
                <Link href="/my-alerts" className="flex items-center space-x-2 text-gray-600 hover:text-orange-600 transition-colors font-medium">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"/>
                  </svg>
                  <span>Mis Alertas</span>
                </Link>
                <Link href="/my-cards" className="flex items-center space-x-2 text-gray-600 hover:text-orange-600 transition-colors font-medium">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
                    <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
                  </svg>
                  <span>Mis Tarjetas</span>
                </Link>
                <Link href="/preguntas" className="flex items-center space-x-2 text-gray-600 hover:text-orange-600 transition-colors font-medium">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/>
                  </svg>
                  <span>Preguntas</span>
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

        {/* Main Content */}
        <div className="flex flex-col items-center justify-center px-8 min-h-[calc(100vh-80px)]">
          {/* Search Form - Centered and Prominent */}
          <div className="bg-white rounded-3xl p-8 shadow-2xl w-full max-w-5xl border border-gray-100 mb-8 mt-8" style={{ overflow: 'visible' }}>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target as HTMLFormElement);
              const date = formData.get('date') as string;
              handleSearch(date || "");
            }} autoComplete="off" className="flex flex-col md:flex-row items-start md:items-end space-y-4 md:space-y-0 md:space-x-4" style={{ overflow: 'visible' }}>
              {/* From Field */}
              <div className="flex-1 w-full md:w-auto md:min-w-[200px]" style={{ overflow: 'visible', position: 'relative' }}>
                <AddressAutocomplete
                  id="search-from"
                  placeholder="Ej. Calle Gran Vía, 1"
                  initialValue={fromAddress}
                  onChange={(value) => {
                    setFromAddress(value);
                    setFromError("");
                  }}
                  required={false}
                  error={fromError}
                  showVerifiedBadge={false}
                  className="w-full"
                  university={userUniversity}
                  homeAddress={userHomeAddress}
                  fieldType="departure"
                />
              </div>

              {/* To Field */}
              <div className="flex-1 w-full md:w-auto md:min-w-[200px]" style={{ overflow: 'visible', position: 'relative' }}>
                <AddressAutocomplete
                  id="search-to"
                  placeholder="Ej. Universidad CEU"
                  initialValue={toAddress}
                  onChange={(value) => {
                    setToAddress(value);
                    setToError("");
                  }}
                  required={false}
                  error={toError}
                  showVerifiedBadge={false}
                  className="w-full"
                  university={userUniversity}
                  homeAddress={userHomeAddress}
                  fieldType="destination"
                />
              </div>

              {/* Date Field */}
              <div className="w-full md:w-auto md:min-w-[180px]">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd"/>
                    </svg>
                  </div>
                  <input
                    type="date"
                    name="date"
                    className="w-full pl-12 pr-4 py-5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-lg font-medium placeholder-gray-400"
                  />
                </div>
              </div>

              {/* Search Button */}
              <button
                type="submit"
                className="bg-orange-500 text-white px-8 py-5 rounded-xl font-semibold hover:bg-orange-600 transition-colors flex items-center justify-center space-x-2 shadow-lg text-base w-full md:w-auto whitespace-nowrap"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"/>
                </svg>
                <span>Buscar</span>
              </button>

              {/* Create Alert Button */}
              {isLoggedIn && (
                <button
                  type="button"
                  onClick={() => {
                    if (!isProfileComplete(userProfile)) {
                      setShowProfileModal(true);
                      return;
                    }
                    setAutoSearchModalOpen(true);
                  }}
                  className="bg-green-500 text-white px-8 py-5 rounded-xl font-semibold hover:bg-green-600 transition-colors flex items-center justify-center space-x-2 shadow-lg text-base w-full md:w-auto whitespace-nowrap"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd"/>
                  </svg>
                  <span>Crear Alerta</span>
                </button>
              )}
            </form>
          </div>

          {/* Verified Students Badge - Below Form */}
          {searchResults.exact_matches.length === 0 && searchResults.nearby_matches.length === 0 && (
            <div className="bg-white border border-orange-200 rounded-full px-8 py-3 mb-8 shadow-lg">
              <div className="flex items-center space-x-3">
                <svg className="w-6 h-6 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                </svg>
                <span className="text-gray-700 font-semibold text-lg">Solo Estudiantes Verificados</span>
              </div>
            </div>
          )}

          {/* Main Headline - Below Form */}
          {searchResults.exact_matches.length === 0 && searchResults.nearby_matches.length === 0 && (
            <div className="text-center mb-8">
              <h1 className="text-5xl font-bold text-white mb-4 leading-tight tracking-tight">
                Comparte Viajes,<br />
                Ahorra Dinero,<br />
                Haz Amigos
              </h1>
              <p className="text-xl text-white/95 max-w-3xl mx-auto leading-relaxed">
                UniGO: La plataforma de viajes compartidos para estudiantes universitarios, garantizando un viaje seguro con reservas aprobadas por el conductor.
              </p>
            </div>
          )}

          {/* Search Results Section */}
          {searchParams && (
            <div className="w-full max-w-6xl mt-12">
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-white mb-4">Resultados de Búsqueda</h2>
                {(() => {
                  const hasFrom = searchParams.from?.formattedAddress;
                  const hasTo = searchParams.to?.formattedAddress;
                  const hasDate = searchParams.date;
                  
                  // Build search description
                  const parts: string[] = [];
                  if (hasFrom && hasTo) {
                    parts.push(`${hasFrom} → ${hasTo}`);
                  } else if (hasFrom) {
                    parts.push(`Desde: ${hasFrom}`);
                  } else if (hasTo) {
                    parts.push(`Hasta: ${hasTo}`);
                  } else {
                    parts.push("Todos los viajes disponibles");
                  }
                  
                  if (hasDate) {
                    parts.push(`• ${hasDate}`);
                  }
                  
                  return (
                    <p className="text-white/90 text-lg">
                      {parts.join(" ")}
                    </p>
                  );
                })()}
              </div>

              {/* Show Results or No Results Message */}
              {searchResults.exact_matches.length > 0 ? (
                <div className="space-y-4">
                  {searchResults.exact_matches.map((ride) => (
                    <RideCard 
                      key={ride.id} 
                      ride={ride} 
                      onClick={() => handleRideClick(ride)}
                    />
                  ))}
                </div>
              ) : searchResults.nearby_matches.length > 0 ? (
                <div className="space-y-4">
                  <div className="bg-purple-50 border border-purple-200 rounded-xl p-6 mb-6">
                    <p className="text-purple-800 text-lg font-semibold">
                      No hay viajes disponibles exactamente en ese origen y destino,
                      pero encontramos algunos cerca de ti:
                    </p>
                  </div>
                  {searchResults.nearby_matches.map((ride) => {
                    const originDistM = Math.round((ride.origin_distance_km || 0) * 1000);
                    const destDistM = Math.round((ride.destination_distance_km || 0) * 1000);
                    
                    // Build distance text based on which distances are different
                    let distanceText = "";
                    if (originDistM === 0 && destDistM === 0) {
                      distanceText = "a 0 m";
                    } else if (originDistM === 0 && destDistM > 0) {
                      distanceText = `destino a ${destDistM} m`;
                    } else if (originDistM > 0 && destDistM === 0) {
                      distanceText = `origen a ${originDistM} m`;
                    } else if (originDistM === destDistM) {
                      distanceText = `a ${originDistM} m`;
                    } else {
                      distanceText = `origen a ${originDistM} m, destino a ${destDistM} m`;
                    }
                    
                    return (
                      <div key={ride.id} className="relative">
                        <RideCard 
                          ride={ride} 
                          onClick={() => handleRideClick(ride)}
                        />
                        <span className="absolute top-4 right-4 z-10 px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full font-medium shadow-sm">
                          ✨ Cerca de ti ({distanceText})
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-white rounded-xl shadow-md p-8 text-center">
                  <div className="flex flex-col items-center justify-center py-8">
                    <svg className="w-16 h-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h3 className="text-2xl font-bold text-gray-800 mb-2">No se encontraron viajes</h3>
                    <p className="text-gray-600">
                      Intenta ajustar tus criterios de búsqueda o vuelve más tarde para ver más viajes
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {ToastComponent}
      
      {/* Auto Search Modal */}
      <AutoSearchModal
        isOpen={autoSearchModalOpen}
        onClose={() => setAutoSearchModalOpen(false)}
        onSuccess={() => {
          showToast("Búsqueda automática activada");
        }}
        onError={(message) => {
          showToast(message);
        }}
        userUniversity={userUniversity}
        userHomeAddress={userHomeAddress}
      />

      {/* Profile Incomplete Modal */}
      <ProfileIncompleteModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
      />

    </DesktopLayout>
  );
}
