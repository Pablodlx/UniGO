"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import DesktopLayout from "@/components/DesktopLayout";

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
        let errorText = "";
        try {
          errorText = await res.text();
        } catch {
          errorText = `Error ${res.status}: ${res.statusText}`;
        }
        
        // Try to parse as JSON
        let errorMessage = errorText;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.detail || errorJson.message || errorText;
        } catch {
          // Not JSON, use text as is
        }
        
        // Replace generic errors with user-friendly messages
        if (errorMessage.includes("Load failed") || errorMessage.includes("Failed to fetch") || errorMessage.includes("TypeError")) {
          errorMessage = "Error de conexión. Por favor, verifica que el servidor esté funcionando.";
        } else if (errorMessage.includes("500") || errorMessage.includes("Internal Server Error") || errorMessage.includes("Error interno")) {
          errorMessage = "Error del servidor. Por favor, contacta al administrador o intenta más tarde.";
        } else if (errorMessage.includes("401") || errorMessage.includes("Unauthorized") || errorMessage.includes("Invalid credentials") || errorMessage.includes("Credenciales inválidas")) {
          errorMessage = "Email o contraseña incorrectos. Por favor, intenta de nuevo.";
        } else if (errorMessage.includes("403") || errorMessage.includes("Forbidden")) {
          errorMessage = "No tienes permiso para acceder. Contacta al administrador.";
        } else if (errorMessage.includes("Email no verificado") || errorMessage.includes("not verified")) {
          errorMessage = "Email no verificado. Por favor, verifica tu email primero.";
        }
        
        throw new Error(errorMessage);
      }

      const data = await res.json();
      // Ajusta si tu backend devuelve otra clave
      const token: string =
        data.access_token ?? data.token ?? data.jwt ?? "";

      if (!token) throw new Error("Token no recibido del backend.");
      localStorage.setItem("token", token);

      // ✅ Redirige directamente a Perfil
      router.replace("/profile");
    } catch (e: unknown) {
      let errorMessage = "Error en el login";
      if (e instanceof Error) {
        errorMessage = e.message;
        // Replace generic errors
        if (errorMessage.includes("Load failed") || errorMessage.includes("Failed to fetch") || errorMessage.includes("TypeError")) {
          errorMessage = "Error de conexión. Por favor, verifica que el servidor esté funcionando.";
        }
      } else if (typeof e === "string") {
        errorMessage = e;
      }
      setMsg(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyEmail() {
    if (!email) {
      setMsg("Por favor, introduce tu email primero");
      return;
    }
    
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch(`${BASE}/auth/verify-manual`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        setMsg("✅ Email verificado. Ahora puedes iniciar sesión.");
      } else {
        const text = await res.text();
        setMsg(`Error verificando email: ${text}`);
      }
    } catch (e: any) {
      setMsg(`Error verificando email: ${e?.message ?? "Error de conexión"}`);
    } finally {
      setLoading(false);
    }
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
              <button className="flex items-center space-x-2 text-gray-600 hover:text-orange-600 transition-colors font-medium">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd"/>
                </svg>
                <span>Mis Viajes</span>
              </button>
              <button className="flex items-center space-x-2 text-gray-600 hover:text-orange-600 transition-colors font-medium">
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
      <div className="bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="max-w-md w-full mx-auto px-8">
          {/* Login Form Card */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Iniciar sesión</h1>
              <p className="text-gray-600">Accede con tu email y contraseña</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-lg font-medium"
                  placeholder="tu@uni.es"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Contraseña
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-lg font-medium"
                  placeholder="••••••••"
                  required
                />
              </div>

              {msg && (
                <div className={`rounded-xl p-4 ${
                  msg.includes("✅") 
                    ? "bg-gray-50 border border-green-200 text-green-800" 
                    : "bg-red-50 border border-red-200 text-red-800"
                }`}>
                  <p className="text-sm font-medium">{msg}</p>
                </div>
              )}

              {msg && msg.includes("Email no verificado") && (
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={handleVerifyEmail}
                    disabled={loading}
                    className="w-full bg-blue-500 text-white py-3 px-6 rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors"
                  >
                    {loading ? "Verificando..." : "Verificar Email"}
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-orange-500 text-white py-4 px-8 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-orange-600 transition-colors text-lg shadow-lg"
              >
                {loading ? "Entrando..." : "Entrar"}
              </button>
            </form>

            <div className="mt-8 text-center">
              <p className="text-gray-600">
                ¿No tienes cuenta?{" "}
                <button
                  onClick={() => router.push("/register")}
                  className="text-orange-600 font-medium hover:text-orange-700 transition-colors"
                >
                  Regístrate aquí
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    </DesktopLayout>
  );
}