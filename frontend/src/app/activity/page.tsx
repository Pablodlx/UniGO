"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DesktopLayout from "@/components/DesktopLayout";
import ActivityMapPreview from "@/components/ActivityMapPreview";
import { getToken, getMyBookings, getRideHistory, Ride, RideHistoryItem } from "@/lib/api";
import { useRouter } from "next/navigation";

type UpcomingTrip = Ride;

export default function ActivityPage() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [upcomingTrips, setUpcomingTrips] = useState<UpcomingTrip[]>([]);
  const [pastTrips, setPastTrips] = useState<RideHistoryItem[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const token = getToken();
    setIsLoggedIn(!!token);
    if (!token) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        const [bookings, history] = await Promise.all([getMyBookings(), getRideHistory()]);
        const now = new Date();
        const futureTrips = bookings.filter((ride) => new Date(ride.departure_date) >= now);
        setUpcomingTrips(futureTrips);
        setPastTrips(history);
      } catch (error) {
        console.error("Error loading activity data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (!loading && !isLoggedIn) {
      router.push("/login");
    }
  }, [isLoggedIn, loading, router]);

  const formattedPastTrips = useMemo(
    () => pastTrips.filter((trip) => trip.status === "completed"),
    [pastTrips]
  );

  const formatDate = (value: string) => {
    if (!mounted) {
      // Return a placeholder during SSR to avoid hydration mismatch
      return "";
    }
    const date = new Date(value);
    return date.toLocaleDateString("es-ES", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (value?: string) => value ?? "";

  const formatCurrency = (value: number) => {
    if (!mounted) return ""; // Return empty string during SSR
    return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(value);
  };

  if (!isLoggedIn && loading) {
    return null;
  }

  if (loading) {
    return (
      <DesktopLayout showSidebar={false}>
        <div className="min-h-screen bg-black text-white">
          <div className="flex min-h-screen items-center justify-center">
            <div className="space-y-4 text-center">
              <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-l-2 border-white/40" />
              <p className="text-sm text-zinc-400">Cargando tu actividad...</p>
            </div>
          </div>
        </div>
      </DesktopLayout>
    );
  }

  return (
    <DesktopLayout showSidebar={false}>
      <div className="min-h-screen bg-black text-white">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
          <header className="mb-10">
            <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">Actividad</p>
            <h1 className="mt-2 text-4xl font-semibold text-white">Tu historial de viajes</h1>
            <p className="mt-4 max-w-2xl text-zinc-400">
              Consulta tus próximos viajes programados y revive tus trayectos pasados con un
              resumen visual similar a la experiencia de Uber.
            </p>
          </header>

          <section className="mb-12 rounded-3xl border border-white/5 bg-zinc-900/60 p-6 shadow-2xl shadow-black/30 backdrop-blur">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-green-400">Próximos viajes</p>
                <h2 className="text-2xl font-semibold text-white">En agenda</h2>
              </div>
              <Link
                href="/"
                className="rounded-full border border-green-500/40 px-4 py-2 text-sm font-medium text-green-300 transition hover:bg-green-500/10"
              >
                Reservar viaje
              </Link>
            </div>

            {upcomingTrips.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-black/40 p-6 text-center text-zinc-400">
                <p className="text-lg font-medium text-white">No tienes viajes programados</p>
                <p className="mt-2 text-sm text-zinc-500">
                  Cuando reserves un viaje aparecerá aquí para que puedas consultarlo rápidamente.
                </p>
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {upcomingTrips.map((trip) => (
                  <div
                    key={`upcoming-${trip.id}`}
                    className="grid gap-6 rounded-3xl border border-white/5 bg-black/40 p-6 shadow-lg shadow-black/40 lg:grid-cols-5"
                  >
                    <div className="lg:col-span-3">
                      <ActivityMapPreview
                        originName={trip.departure_city}
                        destinationName={trip.destination_city}
                        originLat={trip.departure_lat}
                        originLng={trip.departure_lng}
                        destinationLat={trip.destination_lat}
                        destinationLng={trip.destination_lng}
                        className="rounded-2xl"
                      />
                    </div>
                    <div className="space-y-3 lg:col-span-2">
                      <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">
                        {formatDate(trip.departure_date)} · {trip.departure_time}
                      </p>
                      <h3 className="text-2xl font-semibold text-white">{trip.destination_city}</h3>
                      <p className="text-sm text-zinc-400">
                        {trip.departure_city} → {trip.destination_city}
                      </p>
                      <div className="pt-3 text-lg font-semibold text-white">
                        {formatCurrency(trip.price_per_seat)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">Historial</p>
                <h2 className="text-2xl font-semibold text-white">Viajes completados</h2>
              </div>
            </div>

            {formattedPastTrips.length === 0 ? (
              <div className="rounded-3xl border border-white/5 bg-zinc-900/50 p-8 text-center text-zinc-400">
                <p className="text-lg font-medium text-white">
                  Aún no hay viajes en tu historial
                </p>
                <p className="mt-2 text-sm text-zinc-500">
                  Cuando completes un trayecto, lo verás aquí con los detalles más importantes.
                </p>
              </div>
            ) : (
              <div className="space-y-8">
                {formattedPastTrips.map((trip) => (
                  <article
                    key={`history-${trip.id}-${trip.booking_id ?? trip.created_at}`}
                    className="overflow-hidden rounded-3xl border border-white/5 bg-zinc-900/70 shadow-2xl shadow-black/50"
                  >
                    <ActivityMapPreview
                      originName={trip.departure_city}
                      destinationName={trip.destination_city}
                      originLat={trip.departure_lat}
                      originLng={trip.departure_lng}
                      destinationLat={trip.destination_lat}
                      destinationLng={trip.destination_lng}
                    />
                    <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">
                          {formatDate(trip.departure_date)} · {formatTime(trip.arrival_time)}
                        </p>
                        <h3 className="mt-1 text-2xl font-semibold text-white">
                          {trip.destination_city}
                        </h3>
                        <p className="text-sm text-zinc-400">
                          {trip.departure_city} → {trip.destination_city}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                          Total
                        </p>
                        <p className="text-2xl font-semibold text-white">
                          {formatCurrency(trip.price_per_seat)}
                        </p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </DesktopLayout>
  );
}

