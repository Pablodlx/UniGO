"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import DesktopLayout from "@/components/DesktopLayout";
import Link from "next/link";
import { clearToken, getUserRatings, getCurrentUserId } from "@/lib/api";
import AddressAutocomplete, { AddressValue } from "@/components/AddressAutocomplete";
import ReviewsModal from "@/components/ReviewsModal";

const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000/api";

// --- helpers token + api ---
function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}
function authHeaders(): Record<string, string> {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}
async function getProfile() {
  try {
    const r = await fetch(`${BASE}/me/profile`, { headers: { ...authHeaders() }, cache: "no-store" });
    if (!r.ok) {
      const errorText = await r.text().catch(() => "");
      throw new Error(errorText || `Perfil: ${r.status}`);
    }
    return r.json();
  } catch (error: any) {
    console.error("Error in getProfile:", error);
    throw error;
  }
}
async function updateProfile(payload: any) {
  const r = await fetch(`${BASE}/me/profile`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(txt || `Update: ${r.status}`);
  }
  return r.json();
}
async function uploadAvatar(file: File) {
  const form = new FormData();
  form.append("file", file);
  const r = await fetch(`${BASE}/me/avatar`, {
    method: "POST",
    headers: { ...authHeaders() },
    body: form,
  });
  if (!r.ok) throw new Error(`Avatar: ${r.status}`);
  return r.json();
}

// --- validación ---
const schema = z.object({
  first_name: z.string().min(1, "Obligatorio").max(150),
  last_name: z.string().min(1, "Obligatorio").max(150),
  university: z.string().max(150).optional(),
  degree: z.string().min(1, "Obligatorio").max(150),
  course: z.number().int().min(1, "Mínimo 1").max(6, "Máximo 6"),
  home_address: z.object({
    formattedAddress: z.string(),
    placeId: z.string(),
    lat: z.number(),
    lng: z.number(),
  }).nullable().refine((val) => val !== null, { message: "Obligatorio" }),
});
type FormValues = z.infer<typeof schema>;

interface ProfileData {
  email: string;
  full_name: string | null;
  university: string | null;
  degree: string | null;
  course: number | null;
  home_address: {
    formatted_address: string;
    place_id: string;
    lat: number;
    lng: number;
  } | null;
  avatar_url: string | null;
  average_rating: number | null;
  rating_count: number;
}

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [avatarMsg, setAvatarMsg] = useState<string | null>(null);
  const [homeAddress, setHomeAddress] = useState<AddressValue | null>(null);
  const [userRatings, setUserRatings] = useState<{
    average: number;
    count: number;
    ratings: Array<{
      score: number;
      comment: string | null;
      ride_id: number;
      created_at: string;
    }>;
  } | null>(null);
  const [showReviewsModal, setShowReviewsModal] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      first_name: "",
      last_name: "",
      university: "",
      degree: "",
      course: 1,
      home_address: null,
    },
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const token = getToken();
    if (!token) {
      setTimeout(() => router.push("/login"), 0);
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setServerError(null);
        const p = await getProfile();
        if (cancelled) return;
        
        setProfile(p);
        
        const fullName = p.full_name ?? "";
        const nameParts = fullName.split(" ");
        const firstName = nameParts[0] ?? "";
        const lastName = nameParts.slice(1).join(" ") ?? "";
        
        // Set form values
        setValue("first_name", firstName);
        setValue("last_name", lastName);
        setValue("university", p.university ?? "");
        setValue("degree", p.degree ?? "");
        setValue("course", p.course ?? 1);
        
        if (p.home_address) {
          const addressValue: AddressValue = {
            formattedAddress: p.home_address.formatted_address,
            placeId: p.home_address.place_id,
            lat: p.home_address.lat,
            lng: p.home_address.lng,
          };
          setHomeAddress(addressValue);
          setValue("home_address", addressValue);
        } else {
          setHomeAddress(null);
          setValue("home_address", null);
        }
        
        // Load user ratings and get current user ID
        try {
          const userId = await getCurrentUserId();
          if (cancelled) return;
          if (userId) {
            setCurrentUserId(userId);
            const ratings = await getUserRatings(userId);
            if (cancelled) return;
            setUserRatings(ratings);
          }
        } catch (ratingError) {
          console.error("Error loading ratings:", ratingError);
          // Don't fail the whole page load if ratings fail
          setUserRatings(null);
        }
      } catch (e: unknown) {
        if (cancelled) return;
        console.error("Error loading profile:", e);
        const msg = e instanceof Error ? e.message : "Error cargando perfil";
        if (msg.includes("401") || msg.includes("403") || msg.includes("Unauthorized") || msg.includes("UNAUTHORIZED")) {
          localStorage.removeItem("token");
          setTimeout(() => router.push("/login"), 0);
          return;
        }
        if (msg.includes("Network error") || msg.includes("Failed to fetch") || msg.includes("Could not reach")) {
          setServerError("No se pudo conectar con el servidor. Por favor, verifica que el backend esté corriendo.");
        } else {
          setServerError(msg);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  function mapMissingFieldsToErrors(message: string) {
    const m = message.match(/Faltan campos obligatorios:\s*(.+)/i);
    if (!m) return;
    const list = m[1].split(",").map((s) => s.trim()).filter(Boolean);
    const map: Record<string, keyof FormValues> = {
      full_name: "first_name",
      first_name: "first_name",
      last_name: "last_name",
      university: "university",
      degree: "degree",
      course: "course",
      home_address: "home_address",
    };
    list.forEach((field) => {
      const key = map[field];
      if (key) setError(key, { message: "Obligatorio" });
    });
  }

  async function onSubmit(values: FormValues) {
    setServerError(null);
    setSuccessMsg(null);
    setSaving(true);
    
    try {
      const payload = {
        full_name: `${values.first_name} ${values.last_name}`.trim(),
        degree: values.degree,
        course: values.course,
        home_address: values.home_address ? {
          formatted_address: values.home_address.formattedAddress,
          place_id: values.home_address.placeId,
          lat: values.home_address.lat,
          lng: values.home_address.lng,
        } : null,
      };
      
      const updated = await updateProfile(payload);
      setProfile(updated);
      setSuccessMsg("Perfil guardado correctamente ✅");
      
      const fullName = updated.full_name ?? "";
      const nameParts = fullName.split(" ");
      const firstName = nameParts[0] ?? "";
      const lastName = nameParts.slice(1).join(" ") ?? "";
      
      setValue("first_name", firstName);
      setValue("last_name", lastName);
      setValue("university", updated.university ?? "");
      setValue("degree", updated.degree ?? "");
      setValue("course", updated.course ?? 1);
      
      if (updated.home_address) {
        const addressValue: AddressValue = {
          formattedAddress: updated.home_address.formatted_address,
          placeId: updated.home_address.place_id,
          lat: updated.home_address.lat,
          lng: updated.home_address.lng,
        };
        setHomeAddress(addressValue);
        setValue("home_address", addressValue);
      } else {
        setHomeAddress(null);
        setValue("home_address", null);
      }
    } catch (e: any) {
      const msg = e?.message ?? "No se pudo guardar";
        if (msg.includes("401") || msg.includes("credentials")) {
          localStorage.removeItem("token");
          router.push("/login");
          return;
        }
        setServerError(msg);
        mapMissingFieldsToErrors(msg);
    } finally {
      setSaving(false);
    }
  }

  async function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    setAvatarMsg(null);
    setServerError(null);
    if (!e.target.files?.length) return;
    const file = e.target.files[0];
    
    try {
      const updated = await uploadAvatar(file);
      setProfile(updated);
      setAvatarMsg("Avatar actualizado ✅");
    } catch (e: any) {
      const msg = e?.message ?? "No se pudo subir el avatar";
      if (msg.includes("401") || msg.includes("credentials")) {
        localStorage.removeItem("token");
        router.push("/login");
        return;
      }
      setServerError(msg);
    } finally {
      e.target.value = "";
    }
  }

  // Show loading state during initial load
  if (loading && !profile) {
    return (
      <DesktopLayout>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
            <p className="mt-4 text-gray-600">Cargando perfil...</p>
          </div>
        </div>
      </DesktopLayout>
    );
  }

  if (loading) {
    return (
      <DesktopLayout>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
            <p className="mt-4 text-gray-600">Cargando perfil...</p>
          </div>
        </div>
      </DesktopLayout>
    );
  }

  return (
    <DesktopLayout showSidebar={false}>
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
              <button 
                onClick={() => router.push("/")}
                className="flex items-center space-x-2 text-gray-600 hover:text-orange-600 transition-colors font-medium"
              >
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
              <button className="flex items-center space-x-2 text-orange-600 font-medium">
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
              <button
                onClick={() => {
                  clearToken();
                  window.location.href = "/login";
                }}
                className="px-6 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg font-medium transition-colors flex items-center space-x-2 border border-red-200"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>Cerrar Sesión</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-gray-50 min-h-screen">
        <div className="max-w-4xl mx-auto px-8 py-12">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
              {/* Photo Section */}
              <div className="text-center">
                <div className="relative inline-block">
                  <div className="w-32 h-32 bg-gray-200 rounded-full flex items-center justify-center mx-auto">
                    {profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url.startsWith('http') ? profile.avatar_url : `${BASE.replace('/api', '')}${profile.avatar_url}`}
                        alt="Avatar"
                        className="w-32 h-32 rounded-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <svg className="w-16 h-16 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <label className="absolute -bottom-2 -right-2 bg-orange-500 text-white rounded-full p-3 cursor-pointer hover:bg-orange-600 transition-colors shadow-lg">
                    <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={onPickAvatar} />
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                    </svg>
                  </label>
                </div>
                <p className="text-sm text-gray-500 mt-6">Haz clic en el ícono para cambiar la foto (opcional)</p>
                
                {/* Average Rating */}
                <div className="mt-4">
                  {profile?.average_rating !== null && profile?.average_rating !== undefined ? (
                    <div className="flex flex-col items-center space-y-2">
                      <div className="flex items-center justify-center space-x-2">
                        <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <span className="text-lg font-semibold text-gray-800">{profile.average_rating.toFixed(1)}</span>
                        <span className="text-sm text-gray-500">({profile.rating_count} {profile.rating_count === 1 ? 'valoración' : 'valoraciones'})</span>
                      </div>
                      {profile.rating_count > 0 && currentUserId && (
                        <button
                          onClick={() => setShowReviewsModal(true)}
                          className="text-sm text-green-600 hover:text-green-700 font-medium underline transition-colors"
                        >
                          Ver valoraciones
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">No hay valoraciones aún</div>
                  )}
                </div>
              </div>

              {/* Form Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Nombre *
                  </label>
                  <input
                    {...register("first_name")}
                    className="w-full px-4 py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-lg font-medium"
                    placeholder="Ej. Alberto"
                  />
                  {errors.first_name && (
                    <p className="text-red-500 text-sm mt-2">{errors.first_name.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Apellidos *
                  </label>
                  <input
                    {...register("last_name")}
                    className="w-full px-4 py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-lg font-medium"
                    placeholder="Ej. Fernández Rodríguez"
                  />
                  {errors.last_name && (
                    <p className="text-red-500 text-sm mt-2">{errors.last_name.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Universidad *
                  </label>
                  <input
                    {...register("university")}
                    className="w-full px-4 py-4 border border-gray-300 rounded-xl text-lg font-medium bg-gray-50 cursor-not-allowed"
                    placeholder="Ej. Universidad CEU"
                    disabled
                    readOnly
                    title="La universidad se detecta automáticamente desde tu email y no se puede editar"
                  />
                  <p className="text-sm text-gray-500 mt-2 flex items-center space-x-1">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
                    </svg>
                    <span>Detectada automáticamente desde tu email</span>
                  </p>
                  {errors.university && (
                    <p className="text-red-500 text-sm mt-2">{errors.university.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Carrera *
                  </label>
                  <input
                    {...register("degree")}
                    className="w-full px-4 py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-lg font-medium"
                    placeholder="Ej. Ingeniería Informática"
                  />
                  {errors.degree && (
                    <p className="text-red-500 text-sm mt-2">{errors.degree.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Curso *
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={6}
                    {...register("course", { valueAsNumber: true })}
                    className="w-full px-4 py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-lg font-medium"
                    placeholder="1-6"
                  />
                  {errors.course && (
                    <p className="text-red-500 text-sm mt-2">{errors.course.message}</p>
                  )}
                </div>

                <div>
                  <AddressAutocomplete
                    id="home-address"
                    label="Dirección *"
                    placeholder="Ej. Calle Gran Vía, 1"
                    initialValue={homeAddress}
                    onChange={(value) => {
                      setHomeAddress(value);
                      setValue("home_address", value, { shouldValidate: true, shouldDirty: true });
                    }}
                    required={true}
                    error={errors.home_address?.message}
                    showVerifiedBadge={true}
                    className="w-full"
                  />
                </div>
              </div>

              {/* Messages */}
              {successMsg && (
                <div className="bg-gray-50 border border-green-200 rounded-xl p-4">
                  <p className="text-green-800 text-sm font-medium">{successMsg}</p>
                </div>
              )}
              {avatarMsg && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <p className="text-blue-800 text-sm font-medium">{avatarMsg}</p>
                </div>
              )}
              {serverError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <p className="text-red-800 text-sm font-medium">{serverError}</p>
                </div>
              )}


              {/* Submit Button */}
              <div className="pt-6">
                <button
                  type="submit"
                  disabled={saving || !isDirty}
                  className="w-full bg-orange-500 text-white py-4 px-8 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-orange-600 transition-colors text-lg shadow-lg"
                >
                  {saving ? "Guardando..." : "Guardar Perfil"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      
      {/* Reviews Modal */}
      {currentUserId && (
        <ReviewsModal
          isOpen={showReviewsModal}
          userId={currentUserId}
          onClose={() => setShowReviewsModal(false)}
        />
      )}
    </DesktopLayout>
  );
}
