// frontend/src/lib/api.ts

// --- Helpers de token ---
export function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token"); // cambia la clave si usas otra
}

export function setToken(token: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem("token", token);
}

export function clearToken() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("token");
}

export function authHeaders() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

// --- Base API ---
const BASE = process.env.NEXT_PUBLIC_API_BASE;
if (!BASE) {
  // Suele venir de .env.local -> NEXT_PUBLIC_API_BASE=http://127.0.0.1:8000/api
  // No lances error en build; pero ayuda en dev si te olvidas de la env var.
  // eslint-disable-next-line no-console
  console.warn("NEXT_PUBLIC_API_BASE no está definida");
}

// --- Fetch helper con manejo de 401/errores ---
async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, {
    // evita caches agresivos del navegador con el App Router
    cache: "no-store",
    ...init,
    headers: {
      ...(init?.headers || {}),
    },
  });

  if (r.status === 401) {
    // útil para redirigir al login en la UI
    const msg = await r.text().catch(() => "");
    throw new Error(msg || "UNAUTHORIZED");
  }
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(text || `HTTP ${r.status}`);
  }
  return r.json();
}

// --- Auth: login ---
export type LoginResponse = { access_token?: string; token?: string; [k: string]: unknown };

export async function login(email: string, code: string): Promise<string> {
  const data = await fetchJson<LoginResponse>(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code }),
  });
  const tok = data.access_token ?? (data.token as string | undefined);
  if (!tok) throw new Error("Token no recibido del backend");
  setToken(tok);
  return tok;
}

// --- Perfil ---
export type ProfilePayload = {
  full_name: string;
  university: string;
  degree: string;
  course: number;
  ride_intent: "offers" | "seeks" | "both";
};

export async function getProfile() {
  return fetchJson<any>(`${BASE}/me/profile`, {
    headers: { ...authHeaders() },
  });
}

export async function updateProfile(payload: ProfilePayload) {
  return fetchJson<any>(`${BASE}/me/profile`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  });
}

export async function uploadAvatar(file: File) {
  const form = new FormData();
  form.append("file", file);
  return fetchJson<any>(`${BASE}/me/avatar`, {
    method: "POST",
    headers: { ...authHeaders() }, // NO pongas Content-Type, lo gestiona el browser
    body: form,
  });
}

// --- Utilidad para comprobar si el perfil está completo (RF-02) ---
export function isProfileComplete(p: any): boolean {
  return Boolean(
    p &&
      p.full_name &&
      p.university &&
      p.degree &&
      typeof p.course === "number" &&
      p.course >= 1 &&
      p.ride_intent
  );
}
