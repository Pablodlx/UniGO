"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";

const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000/api";

// --- helpers token + api ---
function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}
function authHeaders() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}
async function getProfile() {
  const r = await fetch(`${BASE}/me/profile`, { headers: { ...authHeaders() }, cache: "no-store" });
  if (!r.ok) throw new Error(`Perfil: ${r.status}`);
  return r.json();
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
  full_name: z.string().min(1, "Obligatorio").max(150),
  university: z.string().min(1, "Obligatorio").max(150),
  degree: z.string().min(1, "Obligatorio").max(150),
  course: z.coerce.number().int().min(1, "Mínimo 1").max(6, "Máximo 6"),
  ride_intent: z.enum(["offers", "seeks", "both"], { required_error: "Elige una opción" }),
});
type FormValues = z.infer<typeof schema>;

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
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
      full_name: "",
      university: "",
      degree: "",
      course: 1,
      ride_intent: "both",
    },
  });

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }
    (async () => {
      try {
        const p = await getProfile();
        setValue("full_name", p.full_name ?? "");
        setValue("university", p.university ?? "");
        setValue("degree", p.degree ?? "");
        setValue("course", p.course ?? 1);
        setValue("ride_intent", (p.ride_intent ?? "both") as FormValues["ride_intent"]);
        setAvatarUrl(p.avatar_url ?? null);
      } catch (e: any) {
        setServerError(e?.message ?? "Error cargando perfil");
      } finally {
        setLoading(false);
      }
    })();
  }, [router, setValue]);

  function mapMissingFieldsToErrors(message: string) {
    // Backend: "Faltan campos obligatorios: full_name, university, degree"
    const m = message.match(/Faltan campos obligatorios:\s*(.+)/i);
    if (!m) return;
    const list = m[1]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const map: Record<string, keyof FormValues> = {
      full_name: "full_name",
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
    try {
      const updated = await updateProfile(values);
      setAvatarUrl(updated.avatar_url ?? null);
      setSuccessMsg("Perfil guardado correctamente ✅");
    } catch (e: any) {
      const msg = e?.message ?? "No se pudo guardar";
      setServerError(msg);
      // intenta marcar campos faltantes si es el error de RF-02
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
      setAvatarUrl(updated.avatar_url ?? null);
      setAvatarMsg("Avatar actualizado ✅");
    } catch (e: any) {
      setServerError(e?.message ?? "No se pudo subir el avatar");
    } finally {
      e.target.value = "";
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <h1 className="text-2xl font-semibold">Perfil</h1>
        <p className="opacity-70 mt-2">Cargando…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">Perfil</h1>
      <p className="text-sm opacity-70 mt-1">
        Completa los campos obligatorios (nombre, universidad, carrera, curso y preferencia). La foto es opcional.
      </p>

      {successMsg && (
        <div className="mt-4 rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-800">
          {successMsg}
        </div>
      )}
      {avatarMsg && (
        <div className="mt-2 rounded-md border border-blue-300 bg-blue-50 p-3 text-sm text-blue-800">
          {avatarMsg}
        </div>
      )}
      {serverError && (
        <div className="mt-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {serverError}
        </div>
      )}

      {/* Avatar */}
      <div className="mt-6 flex items-center gap-4">
        <div className="h-20 w-20 overflow-hidden rounded-full bg-gray-200">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-gray-400 text-xs">
              Sin foto
            </div>
          )}
        </div>
        <label className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer hover:bg-gray-50">
          <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={onPickAvatar} />
          Subir foto
        </label>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 grid grid-cols-1 gap-4">
        <div>
          <label className="block text-sm font-medium">Nombre completo *</label>
          <input
            {...register("full_name")}
            className="mt-1 w-full rounded-md border px-3 py-2"
            placeholder="Ej. Ada Lovelace"
          />
          {errors.full_name && <p className="text-xs text-red-600 mt-1">{errors.full_name.message}</p>}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium">Universidad *</label>
            <input
              {...register("university")}
              className="mt-1 w-full rounded-md border px-3 py-2"
              placeholder="Ej. Universidad XYZ"
            />
            {errors.university && <p className="text-xs text-red-600 mt-1">{errors.university.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium">Carrera/Grado *</label>
            <input
              {...register("degree")}
              className="mt-1 w-full rounded-md border px-3 py-2"
              placeholder="Ej. Ingeniería Informática"
            />
            {errors.degree && <p className="text-xs text-red-600 mt-1">{errors.degree.message}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium">Curso *</label>
            <input
              type="number"
              min={1}
              max={6}
              {...register("course", { valueAsNumber: true })}
              className="mt-1 w-full rounded-md border px-3 py-2"
            />
            {errors.course && <p className="text-xs text-red-600 mt-1">{errors.course.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium">Preferencia *</label>
            <select
              {...register("ride_intent")}
              className="mt-1 w-full rounded-md border px-3 py-2 bg-white"
            >
              <option value="offers">Ofrezco viajes</option>
              <option value="seeks">Busco viajes</option>
              <option value="both">Ambos</option>
            </select>
            {errors.ride_intent && <p className="text-xs text-red-600 mt-1">{errors.ride_intent.message}</p>}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-black px-4 py-2 text-white disabled:opacity-50"
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
          {!isDirty && (
            <span className="text-sm opacity-60 self-center">No hay cambios</span>
          )}
        </div>
      </form>
    </div>
  );
}
