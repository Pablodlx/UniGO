"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Login ${res.status}`);
      }

      const data = await res.json();
      // Ajusta si tu backend devuelve otra clave
      const token: string =
        data.access_token ?? data.token ?? data.jwt ?? "";

      if (!token) throw new Error("Token no recibido del backend.");
      localStorage.setItem("token", token);

      // ✅ Redirige directamente a Perfil
      router.replace("/profile");
    } catch (e: any) {
      setMsg(e?.message ?? "Error en el login");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "40px auto", fontFamily: "Arial, sans-serif" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>Iniciar sesión</h1>
      <p style={{ color: "#555", fontSize: 14, marginTop: 4 }}>
        Accede con tu email y contraseña.
      </p>

      {msg && (
        <div
          style={{
            marginTop: 12,
            padding: "8px 10px",
            borderRadius: 6,
            border: "1px solid #fca5a5",
            background: "#fef2f2",
            color: "#991b1b",
            fontSize: 14,
          }}
        >
          {msg}
        </div>
      )}

      <form onSubmit={handleLogin} style={{ marginTop: 16, display: "grid", gap: 12 }}>
        <div>
          <label style={{ display: "block", fontSize: 14 }}>Email</label>
          <input
            type="email"
            required
            placeholder="tu@uni.es"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid #ccc" }}
          />
        </div>

        <div>
          <label style={{ display: "block", fontSize: 14 }}>Contraseña</label>
          <input
            type="password"
            required
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid #ccc" }}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "10px 12px",
            borderRadius: 6,
            border: "none",
            background: "#10b981",
            color: "white",
            fontWeight: 700,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
