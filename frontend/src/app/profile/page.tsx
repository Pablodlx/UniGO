"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import DesktopLayout from "@/components/DesktopLayout";
import Link from "next/link";
import { clearToken } from "@/lib/api";

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
  const r = await fetch(`${BASE}/me/profile`, { headers: { ...authHeaders() }, cache: "no-store" });
  if (!r.ok) throw new Error(`Perfil: ${r.status}`);
  return r.json();
}
async function updateProfile(payload: any) {
  console.log("Sending payload to backend:", payload); // Debug log
  
  const r = await fetch(`${BASE}/me/profile`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  });
  
  console.log("Backend response status:", r.status); // Debug log
  
  if (!r.ok) {
    const txt = await r.text();
    console.error("Backend error response:", txt); // Debug log
    throw new Error(txt || `Update: ${r.status}`);
  }
  
  const result = await r.json();
  console.log("Backend response data:", result); // Debug log
  return result;
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
  university: z.string().min(1, "Obligatorio").max(150),
  degree: z.string().min(1, "Obligatorio").max(150),
  course: z.number().int().min(1, "Mínimo 1").max(6, "Máximo 6"),
  ride_intent: z.enum(["offers", "seeks", "both"]),
});
type FormValues = z.infer<typeof schema>;

interface ProfileData {
  email: string;
  full_name: string | null;
  university: string | null;
  degree: string | null;
  course: number | null;
  ride_intent: string | null;
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
      ride_intent: "both",
    },
  });

  useEffect(() => {
    const currentToken = getToken();
    
    if (!currentToken) {
      // Reset all state when no token
      setProfile(null);
      setLoading(false);
      router.push("/login");
      return;
    }
    loadProfile();
  }, [router]);

  async function loadProfile() {
    try {
      const p = await getProfile();
      console.log("Loaded profile data:", p); // Debug log
      setProfile(p);
      
      // Split full_name into first_name and last_name
      const fullName = p.full_name ?? "";
      const nameParts = fullName.split(" ");
      const firstName = nameParts[0] ?? "";
      const lastName = nameParts.slice(1).join(" ") ?? "";
      
      setValue("first_name", firstName);
      setValue("last_name", lastName);
      setValue("university", p.university ?? "");
      setValue("degree", p.degree ?? "");
      setValue("course", p.course ?? 1);
      setValue("ride_intent", (p.ride_intent ?? "both") as FormValues["ride_intent"]);
    } catch (e: any) {
      const errorMessage = e?.message ?? "Error cargando perfil";
      if (errorMessage.includes("401") || errorMessage.includes("credentials")) {
        // Token is invalid or expired, redirect to login
        localStorage.removeItem("token");
        router.push("/login");
        return;
      }
      setServerError(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  function mapMissingFieldsToErrors(message: string) {
    const m = message.match(/Faltan campos obligatorios:\s*(.+)/i);
    if (!m) return;
    const list = m[1]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const map: Record<string, keyof FormValues> = {
      full_name: "first_name", // Map backend full_name to frontend first_name
      first_name: "first_name",
      last_name: "last_name",
      university: "university",
      degree: "degree",
      course: "course",
      ride_intent: "ride_intent",
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
    
    console.log("Submitting profile data:", values); // Debug log
    
    try {
      // Combine first_name and last_name into full_name for backend
      const payload = {
        full_name: `${values.first_name} ${values.last_name}`.trim(),
        university: values.university,
        degree: values.degree,
        course: values.course,
        ride_intent: values.ride_intent,
      };
      
      console.log("Sending payload to backend:", payload); // Debug log
      
      const updated = await updateProfile(payload);
      console.log("Profile updated successfully:", updated); // Debug log
      setProfile(updated);
      setSuccessMsg("Perfil guardado correctamente ✅");
      
      // Force reload the profile data to ensure it's saved
      setTimeout(() => {
        loadProfile();
      }, 1000);
      
    } catch (e: any) {
      console.error("Error updating profile:", e); // Debug log
      const msg = e?.message ?? "No se pudo guardar";
      if (msg.includes("401") || msg.includes("credentials")) {
        // Token is invalid or expired, redirect to login
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
    
    console.log("Selected file:", file); // Debug log
    
    try {
      const updated = await uploadAvatar(file);
      console.log("Avatar upload response:", updated); // Debug log
      setProfile(updated);
      setAvatarMsg("Avatar actualizado ✅");
    } catch (e: any) {
      console.error("Avatar upload error:", e); // Debug log
      const msg = e?.message ?? "No se pudo subir el avatar";
      if (msg.includes("401") || msg.includes("credentials")) {
        // Token is invalid or expired, redirect to login
        localStorage.removeItem("token");
        router.push("/login");
        return;
      }
      setServerError(msg);
    } finally {
      e.target.value = "";
    }
  }

  // Check token immediately to prevent flash of old content
  const hasToken = typeof window !== "undefined" && getToken();
  
  if (!hasToken || loading) {
    return (
      <DesktopLayout>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
            <p className="mt-4 text-gray-600">{!hasToken ? "Redirecting to login..." : "Cargando perfil..."}</p>
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
                  // Force navigation to trigger state reset
                  window.location.href = "/profile";
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

          {/* Profile Form Card */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
              {/* Photo Section */}
              <div className="text-center">
                <div className="relative inline-block">
                  <div className="w-32 h-32 bg-gray-200 rounded-full flex items-center justify-center mx-auto">
                    {profile?.avatar_url ? (
                      <>
                        {console.log("Avatar URL:", profile.avatar_url)} {/* Debug log */}
                        <img
                          src={profile.avatar_url.startsWith('http') ? profile.avatar_url : `${BASE.replace('/api', '')}${profile.avatar_url}`}
                          alt="Avatar"
                          className="w-32 h-32 rounded-full object-cover"
                          onError={(e) => {
                            console.error("Image load error:", e); // Debug log
                            e.currentTarget.style.display = 'none';
                          }}
                          onLoad={() => {
                            console.log("Image loaded successfully"); // Debug log
                          }}
                        />
                      </>
                    ) : (
                      <>
                        {console.log("No avatar URL found")} {/* Debug log */}
                        <svg className="w-16 h-16 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                        </svg>
                      </>
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
                    className="w-full px-4 py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-lg font-medium"
                    placeholder="Ej. Universidad CEU"
            />
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
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Preferencia de viaje *
                  </label>
                  <select
                    {...register("ride_intent")}
                    className="w-full px-4 py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-lg font-medium"
                  >
                    <option value="offers">Ofrezco viajes</option>
                    <option value="seeks">Busco viajes</option>
                    <option value="both">Ambos</option>
                  </select>
                  {errors.ride_intent && (
                    <p className="text-red-500 text-sm mt-2">{errors.ride_intent.message}</p>
                  )}
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
    </DesktopLayout>
  );
}