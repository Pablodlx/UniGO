"use client";

import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import DesktopLayout from "@/components/DesktopLayout";
import Link from "next/link";
import { getToken, createFavoriteRide, getFavoriteRides, deleteFavoriteRide, FavoriteRide, CreateFavoriteRideRequest } from "@/lib/api";
import AddressAutocomplete, { AddressValue } from "@/components/AddressAutocomplete";
import SaveFavoriteModal from "@/components/SaveFavoriteModal";
import FavoritesListModal from "@/components/FavoritesListModal";
import ConfirmFavoriteModal from "@/components/ConfirmFavoriteModal";
import { loadGoogleMaps } from "@/utils/googleMapsLoader";

const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000/api";

// --- helpers token + api ---
function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

// --- Car brands and colors ---
const CAR_BRANDS = [
  "Abarth",
  "Aiways",
  "Alfa Romeo",
  "Alpine",
  "Aston Martin",
  "Audi",
  "BAIC",
  "Bentley",
  "BMW",
  "BYD",
  "Citroën",
  "Cupra",
  "Dacia",
  "DS Automobiles",
  "Fiat",
  "Ford",
  "Honda",
  "Hyundai",
  "Jeep",
  "KIA",
  "Lexus",
  "Mazda",
  "Mercedes-Benz",
  "MG",
  "MINI",
  "Mitsubishi",
  "Nissan",
  "Opel",
  "Peugeot",
  "Renault",
  "SEAT",
  "Škoda",
  "Subaru",
  "Suzuki",
  "Tesla",
  "Toyota",
  "Volkswagen",
  "Volvo",
];

const CAR_COLORS = [
  "Blanco",
  "Negro",
  "Plateado",
  "Gris",
  "Azul",
  "Rojo",
  "Verde",
  "Marrón",
  "Beige",
  "Amarillo",
  "Naranja",
  "Dorado",
  "Azul Marino",
];

// --- validación ---
const schema = z.object({
  departure_date: z.string().min(1, "Fecha de salida es obligatoria"),
  departure_time: z.string().min(1, "Hora de salida es obligatoria"),
  available_seats: z.number().int().min(1, "Mínimo 1 asiento").max(8, "Máximo 8 asientos"),
  price_per_seat: z.number().min(0.01, "Precio debe ser mayor a 0").max(1000, "Precio máximo 1000€"),
  vehicle_brand: z.string().optional(),
  vehicle_color: z.string().optional(),
  additional_details: z.string().max(500).optional(),
});
type FormValues = z.infer<typeof schema>;

export default function PostRidePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [fromAddress, setFromAddress] = useState<AddressValue | null>(null);
  const [toAddress, setToAddress] = useState<AddressValue | null>(null);
  const [fromError, setFromError] = useState<string>("");
  const [toError, setToError] = useState<string>("");
  const [showSaveFavoriteModal, setShowSaveFavoriteModal] = useState(false);
  const [showFavoritesListModal, setShowFavoritesListModal] = useState(false);
  const [showConfirmFavoriteModal, setShowConfirmFavoriteModal] = useState(false);
  const [favorites, setFavorites] = useState<FavoriteRide[]>([]);
  const [selectedFavorite, setSelectedFavorite] = useState<FavoriteRide | null>(null);
  const [loadingFavorites, setLoadingFavorites] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [durationMinutes, setDurationMinutes] = useState<number | null>(null);
  const [loadingDirections, setLoadingDirections] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      departure_date: "",
      departure_time: "",
      available_seats: 1,
      price_per_seat: 25.00,
      vehicle_brand: "",
      vehicle_color: "",
      additional_details: "",
    },
  });

  // Check login status on client side only to avoid hydration mismatch
  useEffect(() => {
    setIsLoggedIn(!!getToken());
  }, []);

  // Get directions when origin and destination are selected
  const getDirections = useCallback(async () => {
    if (!fromAddress || !toAddress || !fromAddress.lat || !fromAddress.lng || !toAddress.lat || !toAddress.lng) {
      setDistanceKm(null);
      setDurationMinutes(null);
      return;
    }

    setLoadingDirections(true);
    try {
      await loadGoogleMaps();
      
      if (!window.google?.maps?.DirectionsService) {
        console.warn("Google Directions API not available");
        setLoadingDirections(false);
        return;
      }

      const directionsService = new window.google.maps.DirectionsService();
      
      directionsService.route(
        {
          origin: { lat: fromAddress.lat, lng: fromAddress.lng },
          destination: { lat: toAddress.lat, lng: toAddress.lng },
          travelMode: window.google.maps.TravelMode.DRIVING,
        },
        (result, status) => {
          setLoadingDirections(false);
          if (status === window.google.maps.DirectionsStatus.OK && result) {
            const route = result.routes[0];
            if (route && route.legs && route.legs.length > 0) {
              const leg = route.legs[0];
              // Convert distance from meters to kilometers
              const distanceMeters = leg.distance?.value || 0;
              const distanceKmValue = distanceMeters / 1000;
              // Convert duration from seconds to minutes
              const durationSeconds = leg.duration?.value || 0;
              const durationMinutesValue = durationSeconds / 60;
              
              setDistanceKm(distanceKmValue);
              setDurationMinutes(durationMinutesValue);
            }
          } else {
            console.warn("Directions API failed:", status);
            setDistanceKm(null);
            setDurationMinutes(null);
          }
        }
      );
    } catch (error) {
      console.error("Error loading directions:", error);
      setLoadingDirections(false);
      setDistanceKm(null);
      setDurationMinutes(null);
    }
  }, [fromAddress, toAddress]);

  // Call getDirections when addresses change
  useEffect(() => {
    getDirections();
  }, [getDirections]);

  // Calculate recommended price
  const recommendedPrice = distanceKm !== null && durationMinutes !== null
    ? (distanceKm * 0.06) + (durationMinutes * 0.015) + 0.60
    : null;
  
  const minPrice = recommendedPrice ? recommendedPrice * 0.9 : null;
  const maxPrice = recommendedPrice ? recommendedPrice * 1.1 : null;

  const onSubmit = async (values: FormValues) => {
    setMsg(null);
    setFromError("");
    setToError("");
    
    // Validate addresses
    if (!fromAddress || !fromAddress.placeId) {
      setFromError("Selecciona una dirección de la lista.");
      return;
    }
    
    if (!toAddress || !toAddress.placeId) {
      setToError("Selecciona una dirección de la lista.");
      return;
    }
    
    setLoading(true);
    
    // Prepare payload with address data
    const payload = {
      from: {
        placeId: fromAddress.placeId,
        formattedAddress: fromAddress.formattedAddress,
        lat: fromAddress.lat,
        lng: fromAddress.lng,
      },
      to: {
        placeId: toAddress.placeId,
        formattedAddress: toAddress.formattedAddress,
        lat: toAddress.lat,
        lng: toAddress.lng,
      },
      departure_city: fromAddress.formattedAddress, // Keep for backward compatibility
      destination_city: toAddress.formattedAddress, // Keep for backward compatibility
      departure_date: values.departure_date,
      departure_time: values.departure_time,
      available_seats: values.available_seats,
      price_per_seat: values.price_per_seat,
      vehicle_brand: values.vehicle_brand,
      vehicle_color: values.vehicle_color,
      additional_details: values.additional_details,
    };
    
    console.log("Submitting ride data:", payload);
    
    try {
      const token = getToken();
      if (!token) {
        throw new Error("Debes iniciar sesión para publicar un viaje");
      }

      const response = await fetch(`${BASE}/rides/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Failed to post ride: ${response.status}`);
      }

      const result = await response.json();
      console.log("Ride posted successfully:", result);
      
      setMsg("✅ Viaje publicado correctamente!");
      
      // Reset form after successful submission
      setTimeout(() => {
        setLoading(false);
        // Optionally redirect to rides list or home
        router.push("/");
      }, 2000);
      
    } catch (e: any) {
      console.error("Error posting ride:", e);
      setMsg(e?.message ?? "Error al publicar el viaje");
      setLoading(false);
    }
  };

  const handleProfileClick = () => {
    if (isLoggedIn) {
      router.push("/profile");
    } else {
      router.push("/login");
    }
  };

  // Load favorites when opening the favorites list modal
  useEffect(() => {
    if (showFavoritesListModal && isLoggedIn) {
      loadFavorites();
    }
  }, [showFavoritesListModal, isLoggedIn]);

  const loadFavorites = async () => {
    if (!isLoggedIn) {
      return;
    }
    
    // Double check token before making request
    const token = getToken();
    if (!token) {
      setIsLoggedIn(false);
      return;
    }
    
    setLoadingFavorites(true);
    try {
      const favs = await getFavoriteRides();
      setFavorites(favs);
    } catch (error: any) {
      console.error("Error loading favorites:", error);
      
      // If unauthorized, clear token and update login status
      if (error?.message && (error.message.includes("UNAUTHORIZED") || error.message.includes("credentials") || error.message.includes("Could not validate"))) {
        // Token is invalid, clear it
        if (typeof window !== "undefined") {
          localStorage.removeItem("token");
        }
        setIsLoggedIn(false);
        setShowFavoritesListModal(false);
        setMsg("Tu sesión ha expirado. Por favor, inicia sesión nuevamente.");
        setTimeout(() => {
          setMsg(null);
          router.push("/login");
        }, 2000);
        return;
      }
      
      // Show other errors
      if (error?.message) {
        setMsg(error.message ?? "Error al cargar los favoritos");
        setTimeout(() => setMsg(null), 3000);
      }
    } finally {
      setLoadingFavorites(false);
    }
  };

  const handleSaveFavorite = async (name: string) => {
    if (!fromAddress || !toAddress) {
      setMsg("Debes completar las direcciones de origen y destino");
      setShowSaveFavoriteModal(false);
      return;
    }

    // Check if user is still logged in
    const token = getToken();
    if (!token) {
      setIsLoggedIn(false);
      setShowSaveFavoriteModal(false);
      setMsg("Tu sesión ha expirado. Por favor, inicia sesión nuevamente.");
      setTimeout(() => {
        setMsg(null);
        router.push("/login");
      }, 2000);
      return;
    }

    try {
      const formValues = watch();
      const favoriteData: CreateFavoriteRideRequest = {
        name,
        departure_city: fromAddress.formattedAddress,
        destination_city: toAddress.formattedAddress,
        departure_lat: fromAddress.lat,
        departure_lng: fromAddress.lng,
        destination_lat: toAddress.lat,
        destination_lng: toAddress.lng,
        departure_time: formValues.departure_time || undefined,
        available_seats: formValues.available_seats || undefined,
        price_per_seat: formValues.price_per_seat || undefined,
        vehicle_brand: formValues.vehicle_brand || undefined,
        vehicle_color: formValues.vehicle_color || undefined,
        additional_details: formValues.additional_details || undefined,
        from: {
          placeId: fromAddress.placeId,
          formattedAddress: fromAddress.formattedAddress,
          lat: fromAddress.lat,
          lng: fromAddress.lng,
        },
        to: {
          placeId: toAddress.placeId,
          formattedAddress: toAddress.formattedAddress,
          lat: toAddress.lat,
          lng: toAddress.lng,
        },
      };

      await createFavoriteRide(favoriteData);
      setShowSaveFavoriteModal(false);
      setMsg("✅ Viaje guardado como favorito!");
      setTimeout(() => setMsg(null), 3000);
    } catch (error: any) {
      console.error("Error saving favorite:", error);
      
      // If unauthorized, clear token and update login status
      if (error?.message && (error.message.includes("UNAUTHORIZED") || error.message.includes("credentials") || error.message.includes("Could not validate"))) {
        if (typeof window !== "undefined") {
          localStorage.removeItem("token");
        }
        setIsLoggedIn(false);
        setShowSaveFavoriteModal(false);
        setMsg("Tu sesión ha expirado. Por favor, inicia sesión nuevamente.");
        setTimeout(() => {
          setMsg(null);
          router.push("/login");
        }, 2000);
        return;
      }
      
      setMsg(error?.message ?? "Error al guardar el favorito");
      setTimeout(() => setMsg(null), 3000);
    }
  };

  const handleSelectFavorite = (favorite: FavoriteRide) => {
    setSelectedFavorite(favorite);
    setShowFavoritesListModal(false);
    setShowConfirmFavoriteModal(true);
  };

  const handleConfirmFavorite = () => {
    if (!selectedFavorite) return;

    // Autofill form with favorite data
    if (selectedFavorite.from_address) {
      setFromAddress({
        placeId: selectedFavorite.from_address.placeId || undefined,
        formattedAddress: selectedFavorite.from_address.formattedAddress,
        lat: selectedFavorite.from_address.lat,
        lng: selectedFavorite.from_address.lng,
      });
    }
    
    if (selectedFavorite.to_address) {
      setToAddress({
        placeId: selectedFavorite.to_address.placeId || undefined,
        formattedAddress: selectedFavorite.to_address.formattedAddress,
        lat: selectedFavorite.to_address.lat,
        lng: selectedFavorite.to_address.lng,
      });
    }

    if (selectedFavorite.departure_time) {
      setValue("departure_time", selectedFavorite.departure_time);
    }
    if (selectedFavorite.available_seats) {
      setValue("available_seats", selectedFavorite.available_seats);
    }
    if (selectedFavorite.price_per_seat) {
      setValue("price_per_seat", selectedFavorite.price_per_seat);
    }
    if (selectedFavorite.vehicle_brand) {
      setValue("vehicle_brand", selectedFavorite.vehicle_brand);
    }
    if (selectedFavorite.vehicle_color) {
      setValue("vehicle_color", selectedFavorite.vehicle_color);
    }
    if (selectedFavorite.additional_details) {
      setValue("additional_details", selectedFavorite.additional_details);
    }

    setShowConfirmFavoriteModal(false);
    setSelectedFavorite(null);
    setMsg("✅ Viaje favorito cargado. Completa la fecha y hora de salida.");
    setTimeout(() => setMsg(null), 3000);
  };

  const handleDeleteFavorite = async (favoriteId: number) => {
    try {
      await deleteFavoriteRide(favoriteId);
      setFavorites(favorites.filter(f => f.id !== favoriteId));
    } catch (error: any) {
      console.error("Error deleting favorite:", error);
      setMsg(error?.message ?? "Error al eliminar el favorito");
    }
  };

  return (
    <DesktopLayout showSidebar={false}>
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center shadow-md">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                  <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1V8a1 1 0 00-1-1h-3z" />
                </svg>
              </div>
              <span className="text-2xl font-bold text-gray-800">UniGO</span>
            </div>

            <div className="flex items-center space-x-8">
              <Link href="/" className="flex items-center space-x-2 text-gray-600 hover:text-orange-600 transition-colors font-medium">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.707.707a1 1 0 001.414-1.414l-7-7z" />
                </svg>
                <span>Inicio</span>
              </Link>
              <Link href="/my-rides" className="flex items-center space-x-2 text-gray-600 hover:text-orange-600 transition-colors font-medium">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                </svg>
                <span>Mis Viajes</span>
              </Link>
              <button
                onClick={handleProfileClick}
                className="flex items-center space-x-2 text-gray-600 hover:text-orange-600 transition-colors font-medium cursor-pointer"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
                <span>Perfil</span>
              </button>
              <button className="bg-orange-500 text-white px-6 py-2 rounded-lg font-medium hover:bg-orange-600 transition-colors flex items-center space-x-2 shadow-md">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                <span>Publicar Viaje</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-gray-50 min-h-[calc(100vh-80px)] px-8 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl p-8 mb-8 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center shadow-md">
                  <svg className="w-8 h-8 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                    <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1V8a1 1 0 00-1-1h-3z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-white mb-2">Publicar un Nuevo Viaje</h1>
                  <p className="text-white/90 text-lg">
                    Comparte tu viaje y divide los costos con otros estudiantes. Revisarás y aprobarás las solicitudes de reserva.
                  </p>
                </div>
              </div>
              {isLoggedIn && (
                <div className="flex space-x-3">
                  <button
                    onClick={() => setShowFavoritesListModal(true)}
                    className="bg-white/20 hover:bg-white/30 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center space-x-2 backdrop-blur-sm"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                    <span>Viajes favoritos</span>
                  </button>
                  <button
                    onClick={() => setShowSaveFavoriteModal(true)}
                    className="bg-white/20 hover:bg-white/30 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center space-x-2 backdrop-blur-sm"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Guardar como favorito</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Form Card */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
            <form onSubmit={handleSubmit(onSubmit)} autoComplete="off" className="space-y-8">
              {/* Two Column Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Departure City */}
                <div>
                  <AddressAutocomplete
                    id="post-ride-from"
                    label="Desde"
                    placeholder="Ej. Calle Gran Vía, 1"
                    initialValue={fromAddress}
                    onChange={(value) => {
                      setFromAddress(value);
                      setFromError("");
                    }}
                    required={true}
                    error={fromError}
                    className="w-full"
                  />
                </div>

                {/* Destination City */}
                <div>
                  <AddressAutocomplete
                    id="post-ride-to"
                    label="Hasta"
                    placeholder="Ej. Universidad CEU"
                    initialValue={toAddress}
                    onChange={(value) => {
                      setToAddress(value);
                      setToError("");
                    }}
                    required={true}
                    error={toError}
                    className="w-full"
                  />
                </div>

                {/* Departure Date */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    <div className="flex items-center space-x-2">
                      <svg className="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                      </svg>
                      <span>Fecha de Salida *</span>
                    </div>
                  </label>
                  <div className="relative">
                    <input
                      {...register("departure_date")}
                      type="date"
                      className="w-full px-4 py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-lg font-medium"
                    />
                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                      <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                  {errors.departure_date && (
                    <p className="text-red-500 text-sm mt-2">{errors.departure_date.message}</p>
                  )}
                </div>

                {/* Departure Time */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    <div className="flex items-center space-x-2">
                      <svg className="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                      </svg>
                      <span>Hora de Salida *</span>
                    </div>
                  </label>
                  <div className="relative">
                    <input
                      {...register("departure_time")}
                      type="time"
                      className="w-full px-4 py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-lg font-medium"
                    />
                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                      <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                  {errors.departure_time && (
                    <p className="text-red-500 text-sm mt-2">{errors.departure_time.message}</p>
                  )}
                </div>

                {/* Available Seats */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    <div className="flex items-center space-x-2">
                      <svg className="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
                      </svg>
                      <span>Asientos Disponibles *</span>
                    </div>
                  </label>
                  <input
                    {...register("available_seats", { valueAsNumber: true })}
                    type="number"
                    min={1}
                    max={8}
                    className="w-full px-4 py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-lg font-medium"
                  />
                  {errors.available_seats && (
                    <p className="text-red-500 text-sm mt-2">{errors.available_seats.message}</p>
                  )}
                </div>

                {/* Price per Seat */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    <div className="flex items-center space-x-2">
                      <svg className="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                      </svg>
                      <span>€ Precio por Asiento *</span>
                    </div>
                  </label>
                  <input
                    {...register("price_per_seat", { valueAsNumber: true })}
                    type="number"
                    step="0.01"
                    min="0.01"
                    max="1000"
                    className="w-full px-4 py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-lg font-medium"
                  />
                  {errors.price_per_seat && (
                    <p className="text-red-500 text-sm mt-2">{errors.price_per_seat.message}</p>
                  )}
                  
                  {/* Recommended Price UI Block */}
                  {recommendedPrice !== null && (
                    <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-xl">
                      <div className="flex items-center space-x-2 mb-2">
                        <svg className="w-5 h-5 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        <p className="text-sm font-semibold text-orange-900">
                          Precio recomendado: {recommendedPrice.toFixed(2)}€
                        </p>
                      </div>
                      {minPrice !== null && maxPrice !== null && (
                        <p className="text-sm text-orange-700 mb-2">
                          Rango recomendado: {minPrice.toFixed(2)}€ – {maxPrice.toFixed(2)}€
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => setValue("price_per_seat", parseFloat(recommendedPrice.toFixed(2)))}
                        className="text-xs text-orange-600 hover:text-orange-700 underline font-medium"
                      >
                        Usar precio recomendado
                      </button>
                      {loadingDirections && (
                        <p className="text-xs text-orange-600 mt-2">Calculando ruta...</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Full Width Fields */}
              {/* Vehicle Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Vehicle Brand */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    <div className="flex items-center space-x-2">
                      <svg className="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                        <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1V8a1 1 0 00-1-1h-3z" />
                      </svg>
                      <span>Marca del Vehículo</span>
                    </div>
                  </label>
                  <div className="relative">
                    <select
                      {...register("vehicle_brand")}
                      className="w-full px-4 py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-lg font-medium appearance-none bg-white"
                    >
                      <option value="">Selecciona una marca</option>
                      {CAR_BRANDS.map((brand) => (
                        <option key={brand} value={brand}>
                          {brand}
                        </option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                      <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                  {errors.vehicle_brand && (
                    <p className="text-red-500 text-sm mt-2">{errors.vehicle_brand.message}</p>
                  )}
                </div>

                {/* Vehicle Color */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    <div className="flex items-center space-x-2">
                      <svg className="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v11a3 3 0 106 0V4a2 2 0 00-2-2H4z" clipRule="evenodd" />
                      </svg>
                      <span>Color del Vehículo</span>
                    </div>
                  </label>
                  <div className="relative">
                    <select
                      {...register("vehicle_color")}
                      className="w-full px-4 py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-lg font-medium appearance-none bg-white"
                    >
                      <option value="">Selecciona un color</option>
                      {CAR_COLORS.map((color) => (
                        <option key={color} value={color}>
                          {color}
                        </option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                      <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                  {errors.vehicle_color && (
                    <p className="text-red-500 text-sm mt-2">{errors.vehicle_color.message}</p>
                  )}
                </div>
              </div>

              {/* Additional Details */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Detalles Adicionales
                </label>
                <textarea
                  {...register("additional_details")}
                  rows={4}
                  className="w-full px-4 py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-lg font-medium resize-none"
                  placeholder="Cualquier información adicional sobre el viaje (puntos de recogida, espacio para equipaje, paradas, etc.)"
                />
                {errors.additional_details && (
                  <p className="text-red-500 text-sm mt-2">{errors.additional_details.message}</p>
                )}
              </div>

              {/* Messages */}
              {msg && (
                <div
                  className={`p-4 rounded-xl border text-sm font-medium ${
                    msg.includes("✅")
                      ? "bg-gray-50 border-green-200 text-green-800"
                      : "bg-red-50 border-red-200 text-red-800"
                  }`}
                >
                  {msg}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end space-x-4 pt-6">
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="px-8 py-4 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-8 py-4 bg-orange-500 text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-orange-600 transition-colors shadow-md"
                >
                  {loading ? "Publicando..." : "Publicar Viaje"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Modals */}
      <SaveFavoriteModal
        isOpen={showSaveFavoriteModal}
        onSave={handleSaveFavorite}
        onCancel={() => setShowSaveFavoriteModal(false)}
      />

      <FavoritesListModal
        isOpen={showFavoritesListModal}
        favorites={favorites}
        onSelect={handleSelectFavorite}
        onCancel={() => {
          setShowFavoritesListModal(false);
          setSelectedFavorite(null);
        }}
        onDelete={handleDeleteFavorite}
      />

      <ConfirmFavoriteModal
        isOpen={showConfirmFavoriteModal}
        favorite={selectedFavorite}
        onConfirm={handleConfirmFavorite}
        onCancel={() => {
          setShowConfirmFavoriteModal(false);
          setSelectedFavorite(null);
        }}
      />
    </DesktopLayout>
  );
}
