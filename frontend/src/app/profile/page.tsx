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
  console.log("[updateProfile] Saving profile...");
  console.log("[updateProfile] Payload:", payload);
  console.log("[updateProfile] URL:", `${BASE}/me/profile`);
  
  let response: Response | null = null;
  
  try {
    response = await fetch(`${BASE}/me/profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(payload),
    });
  } catch (fetchError: unknown) {
    console.error("[updateProfile] Fetch error:", fetchError);
    // Handle ALL fetch errors - never let TypeError propagate
    const errorMsg = fetchError instanceof Error ? fetchError.message : String(fetchError);
    if (errorMsg.includes("Failed to fetch") || fetchError instanceof TypeError) {
      throw new Error("No se pudo conectar con el servidor. Por favor, verifica que el backend esté corriendo.");
    }
    throw new Error("Error de red al guardar el perfil");
  }
  
  if (!response) {
    throw new Error("No se recibió respuesta del servidor");
  }
  
  console.log("[updateProfile] Response status:", response.status, response.statusText);
  
  // Read response text once - handle errors gracefully
  let responseText = "";
  try {
    responseText = await response.text();
    console.log("[updateProfile] Response text length:", responseText.length);
    if (responseText.length > 0) {
      console.log("[updateProfile] Response text preview:", responseText.substring(0, 500));
    }
  } catch (readError: unknown) {
    console.error("[updateProfile] Error reading response:", readError);
    // If we can't read but status is OK, assume success
    if (response.ok) {
      return null;
    } else {
      throw new Error(`Error al actualizar el perfil: ${response.status} ${response.statusText}`);
    }
  }
  
  if (!response.ok) {
    // Try to parse error as JSON
    let errorMessage = `Error al actualizar el perfil: ${response.status}`;
    try {
      if (responseText && responseText.trim()) {
        const errorJson = JSON.parse(responseText);
        errorMessage = errorJson.detail || errorJson.message || errorJson.error || responseText || errorMessage;
      }
    } catch {
      // Not JSON, use text as is if available
      if (responseText && responseText.trim()) {
        errorMessage = responseText;
      }
    }
    console.error("[updateProfile] Backend error:", errorMessage);
    throw new Error(errorMessage);
  }
  
  // Parse successful response
  if (!responseText || responseText.trim() === "") {
    console.log("[updateProfile] Empty response, returning null");
    return null;
  }
  
  try {
    const parsed = JSON.parse(responseText);
    console.log("[updateProfile] Successfully parsed response");
    return parsed;
  } catch (parseError: unknown) {
    console.error("[updateProfile] JSON parse error:", parseError);
    console.error("[updateProfile] Response text that failed:", responseText);
    // If we can't parse but status was OK, assume success
    return null;
  }
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
  completed_driver_trips: number;
  completed_passenger_trips: number;
}

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
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
        
        // Construir URL completa del avatar si es relativa
        if (p.avatar_url && !p.avatar_url.startsWith('http')) {
          p.avatar_url = `${BASE.replace('/api', '')}${p.avatar_url}`;
        }
        
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
    
    console.log("[onSubmit] Starting profile save...");
    console.log("[onSubmit] Form values:", values);
    
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
      
      console.log("[onSubmit] Payload to send:", payload);
      
      const updated = await updateProfile(payload);
      console.log("[onSubmit] Update response received:", updated);
      
      // If updateProfile returns null (empty response), fetch the updated profile
      let profileData = updated;
      if (!profileData) {
        console.log("[onSubmit] Empty response, fetching profile...");
        try {
          profileData = await getProfile();
          console.log("[onSubmit] Profile fetched:", profileData);
        } catch (fetchError) {
          console.error("[onSubmit] Error fetching profile:", fetchError);
          // If we can't fetch, still show success since the update likely succeeded
          setSuccessMsg("Perfil guardado correctamente ✅");
          setSaving(false);
          return;
        }
      }
      
      if (profileData) {
        setProfile(profileData);
        setSuccessMsg("Perfil guardado correctamente ✅");
        
        const fullName = profileData.full_name ?? "";
        const nameParts = fullName.split(" ");
        const firstName = nameParts[0] ?? "";
        const lastName = nameParts.slice(1).join(" ") ?? "";
        
        setValue("first_name", firstName);
        setValue("last_name", lastName);
        setValue("university", profileData.university ?? "");
        setValue("degree", profileData.degree ?? "");
        setValue("course", profileData.course ?? 1);
        
        if (profileData.home_address) {
          const addressValue: AddressValue = {
            formattedAddress: profileData.home_address.formatted_address,
            placeId: profileData.home_address.place_id,
            lat: profileData.home_address.lat,
            lng: profileData.home_address.lng,
          };
          setHomeAddress(addressValue);
          setValue("home_address", addressValue);
        } else {
          setHomeAddress(null);
          setValue("home_address", null);
        }
      } else {
        setSuccessMsg("Perfil guardado correctamente ✅");
      }
    } catch (e: unknown) {
      console.error("[onSubmit] Error caught:", e);
      console.error("[onSubmit] Error type:", typeof e);
      console.error("[onSubmit] Error constructor:", e?.constructor?.name);
      
      // Ensure we always have a proper error message
      let errorMessage = "No se pudo guardar el perfil";
      
      if (e instanceof Error) {
        errorMessage = e.message;
        console.error("[onSubmit] Error message:", errorMessage);
      } else if (typeof e === "string") {
        errorMessage = e;
      } else if (e && typeof e === "object" && "message" in e) {
        errorMessage = String(e.message);
      } else {
        errorMessage = String(e);
      }
      
      // Never show TypeError or Load failed - replace with user-friendly message
      if (errorMessage.includes("TypeError") || 
          errorMessage.includes("Load failed") || 
          errorMessage.includes("Failed to load") ||
          errorMessage.toLowerCase().includes("typeerror")) {
        console.error("[onSubmit] Detected generic error, replacing with user-friendly message");
        errorMessage = "Error al guardar el perfil. Por favor, verifica que todos los campos estén completos e intenta de nuevo.";
      }
      
      if (errorMessage.includes("401") || 
          errorMessage.includes("credentials") || 
          errorMessage.includes("UNAUTHORIZED")) {
        localStorage.removeItem("token");
        router.push("/login");
        return;
      }
      
      setServerError(errorMessage);
      mapMissingFieldsToErrors(errorMessage);
    } finally {
      setSaving(false);
    }
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    console.log("📸 Archivo seleccionado:", file.name, file.type, file.size);

    // Previsualización inmediata
    const preview = URL.createObjectURL(file);
    setAvatarPreview(preview);

    // Subida simple al backend
    const formData = new FormData();
    formData.append("file", file);

    const url = `${BASE}/me/avatar`;
    console.log("📤 Subiendo a:", url);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { 
          ...authHeaders(),
          // NO establecer Content-Type - el navegador lo hace automáticamente con boundary
        },
        credentials: "include",
        body: formData,
      });

      console.log("📥 Respuesta recibida:", res.status, res.statusText);

      if (!res.ok) {
        const errorText = await res.text().catch(() => "");
        console.error("❌ Error del servidor:", res.status, errorText);
        alert(`Error al subir la imagen: ${errorText || res.statusText}`);
        URL.revokeObjectURL(preview);
        setAvatarPreview(null);
        return;
      }

      const data = await res.json();
      console.log("✅ Respuesta JSON:", data);
      
      const avatarUrl = data.avatar_url;
      console.log("🖼️ avatar_url recibido:", avatarUrl);

      if (!avatarUrl) {
        console.warn("⚠️ No hay avatar_url en la respuesta");
        URL.revokeObjectURL(preview);
        setAvatarPreview(null);
        return;
      }

      // Construir URL completa si es relativa
      // BASE es "http://127.0.0.1:8000/api"
      // avatarUrl es "/static/avatars/filename.jpg"
      // Necesitamos "http://127.0.0.1:8000/static/avatars/filename.jpg"
      let fullAvatarUrl = avatarUrl;
      if (!avatarUrl.startsWith('http')) {
        // Si es relativa, construir URL completa
        const baseUrl = BASE.replace('/api', ''); // "http://127.0.0.1:8000"
        fullAvatarUrl = `${baseUrl}${avatarUrl}`; // "http://127.0.0.1:8000/static/avatars/filename.jpg"
      }

      console.log("🔗 URL completa del avatar:", fullAvatarUrl);

      // Actualizar perfil con la nueva URL
      setProfile((prev) => {
        if (!prev) return prev;
        const updated = { ...prev, avatar_url: fullAvatarUrl };
        console.log("💾 Perfil actualizado:", updated);
        return updated;
      });

      // Limpiar previsualización - ahora usamos la URL del servidor
      setTimeout(() => {
        URL.revokeObjectURL(preview);
        setAvatarPreview(null);
      }, 200);
    } catch (err) {
      console.error("❌ Error de red:", err);
      const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
      // No mostrar "Load failed" genérico
      if (errorMsg.includes("Load failed") || errorMsg.includes("Failed to fetch")) {
        alert("Error de conexión. Por favor, verifica que el servidor esté funcionando e intenta de nuevo.");
      } else {
        alert(`Error al subir la imagen: ${errorMsg}`);
      }
      URL.revokeObjectURL(preview);
      setAvatarPreview(null);
    } finally {
      e.target.value = "";
    }
  };

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (avatarPreview) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarPreview]);

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
                  <div className="w-32 h-32 bg-gray-200 rounded-full flex items-center justify-center mx-auto overflow-hidden">
                    {avatarPreview ? (
                      <img
                        src={avatarPreview}
                        alt="Avatar preview"
                        className="h-32 w-32 rounded-full object-cover"
                      />
                    ) : profile?.avatar_url ? (
                      <img
                        src={
                          profile.avatar_url.startsWith('http') 
                            ? profile.avatar_url 
                            : `${BASE.replace('/api', '')}${profile.avatar_url}`
                        }
                        alt="Avatar"
                        className="h-32 w-32 rounded-full object-cover"
                        onError={(e) => {
                          console.error("❌ Error cargando imagen:", e.currentTarget.src);
                          // Ocultar la imagen y mostrar el fallback
                          e.currentTarget.style.display = 'none';
                          const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                          if (fallback) fallback.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    {/* Fallback: círculo con inicial */}
                    <div 
                      className={`w-32 h-32 bg-green-500 rounded-full flex items-center justify-center ${avatarPreview || profile?.avatar_url ? 'hidden' : ''}`}
                      style={{ display: avatarPreview || profile?.avatar_url ? 'none' : 'flex' }}
                    >
                      <span className="text-white text-4xl font-bold">
                        {(profile?.full_name || profile?.email || "U").charAt(0).toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <label className="absolute -bottom-2 -right-2 bg-orange-500 text-white rounded-full p-3 cursor-pointer hover:bg-orange-600 transition-colors shadow-lg">
                    <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                    </svg>
                  </label>
                </div>
                <p className="text-sm text-gray-500 mt-6">Haz clic en el ícono para cambiar la foto (opcional)</p>
                
                {/* Average Rating */}
                <div className="mt-4">
                  {profile?.average_rating !== null && profile?.average_rating !== undefined ? (
                    <div className="flex items-center justify-center space-x-2">
                      <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      <span className="text-lg font-semibold text-gray-800">{profile.average_rating.toFixed(1)}</span>
                      <span className="text-sm text-gray-500">({profile.rating_count} {profile.rating_count === 1 ? 'valoración' : 'valoraciones'})</span>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">No hay valoraciones aún</div>
                  )}
                </div>

                {/* Trip Statistics */}
                <div className="flex gap-6 mt-4 text-gray-800 justify-center">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🚗</span>
                    <div>
                      <p className="text-sm font-semibold">Conductor</p>
                      <p className="text-sm">{profile?.completed_driver_trips || 0} viajes</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-2xl">👤</span>
                    <div>
                      <p className="text-sm font-semibold">Pasajero</p>
                      <p className="text-sm">{profile?.completed_passenger_trips || 0} viajes</p>
                    </div>
                  </div>
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
              {serverError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <p className="text-red-800 text-sm font-medium">{serverError}</p>
                </div>
              )}

              {/* Ratings List */}
              {userRatings && userRatings.ratings.length > 0 && (
                <div className="mt-8 pt-8 border-t border-gray-200">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">Valoraciones recibidas</h3>
                  <div className="space-y-4">
                    {userRatings.ratings.map((rating, index) => (
                      <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <div className="flex">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <svg
                                  key={star}
                                  className={`w-5 h-5 ${
                                    star <= rating.score ? "text-yellow-400" : "text-gray-300"
                                  }`}
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                              ))}
                            </div>
                            <span className="text-sm text-gray-500">
                              {new Date(rating.created_at).toLocaleDateString('es-ES', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </span>
                          </div>
                        </div>
                        {rating.comment && (
                          <p className="text-gray-700 mt-2">{rating.comment}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {userRatings && userRatings.ratings.length === 0 && (
                <div className="mt-8 pt-8 border-t border-gray-200">
                  <p className="text-sm text-gray-500 text-center">Sin valoraciones aún</p>
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
    </DesktopLayout>
  );
}
