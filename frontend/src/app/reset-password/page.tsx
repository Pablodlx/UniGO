"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import DesktopLayout from "@/components/DesktopLayout";
import { validateResetToken, resetPassword } from "@/lib/api";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [valid, setValid] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Obtener token directamente de la URL usando window.location
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const tokenParam = urlParams.get("token");
      console.log("[ResetPassword] Token from URL:", tokenParam);
      if (tokenParam) {
        setToken(tokenParam);
        validateToken(tokenParam);
      } else {
        setValidating(false);
        setValid(false);
        setMsg("Token no encontrado en la URL");
      }
    }
  }, []);

  async function validateToken(tokenValue: string) {
    setValidating(true);
    setValid(false);
    setMsg(null);
    console.log("[ResetPassword] Validating token:", tokenValue);
    try {
      const result = await validateResetToken(tokenValue);
      console.log("[ResetPassword] Validation result:", result);
      setValid(result.valid);
      if (!result.valid) {
        setMsg("Token inválido o expirado");
      }
    } catch (e: unknown) {
      console.error("[ResetPassword] Validation error:", e);
      setValid(false);
      let errorMessage = "Error al validar el token";
      if (e instanceof Error) {
        errorMessage = e.message;
      }
      setMsg(errorMessage);
    } finally {
      setValidating(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (newPassword !== confirmPassword) {
      setMsg("Las contraseñas no coinciden");
      return;
    }

    if (newPassword.length < 6) {
      setMsg("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    if (!token) {
      setMsg("Token no válido");
      return;
    }

    setLoading(true);
    try {
      await resetPassword(token, newPassword);
      setSuccess(true);
      setMsg("Contraseña restablecida exitosamente");
      
      // Redirigir al login después de 2 segundos
      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } catch (e: unknown) {
      let errorMessage = "Error al restablecer la contraseña";
      if (e instanceof Error) {
        errorMessage = e.message;
      } else if (typeof e === "string") {
        errorMessage = e;
      }
      setMsg(errorMessage);
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
            <Link href="/login" className="text-gray-600 hover:text-orange-600 transition-colors font-medium">
              Volver al login
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="max-w-md w-full mx-auto px-8">
          {/* Form Card */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Restablecer contraseña</h1>
              <p className="text-gray-600">Introduce tu nueva contraseña</p>
            </div>

            {validating ? (
              <div className="text-center py-8">
                <p className="text-gray-600">Validando token...</p>
              </div>
            ) : !valid ? (
              <div className="space-y-6">
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                  <p className="text-red-800 text-sm font-medium">{msg || "Token inválido o expirado"}</p>
                </div>
                <Link
                  href="/forgot-password"
                  className="block w-full bg-orange-500 text-white py-4 px-8 rounded-xl font-semibold hover:bg-orange-600 transition-colors text-lg shadow-lg text-center"
                >
                  Solicitar nuevo enlace
                </Link>
              </div>
            ) : success ? (
              <div className="space-y-6">
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                  <p className="text-green-800 text-sm font-medium">{msg}</p>
                  <p className="text-green-600 text-xs mt-2">Redirigiendo al login...</p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Nueva contraseña
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-lg font-medium"
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Confirmar contraseña
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-lg font-medium"
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                </div>

                {msg && (
                  <div className={`rounded-xl p-4 ${
                    msg.includes("exitosamente") 
                      ? "bg-green-50 border border-green-200 text-green-800" 
                      : "bg-red-50 border border-red-200 text-red-800"
                  }`}>
                    <p className="text-sm font-medium">{msg}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-orange-500 text-white py-4 px-8 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-orange-600 transition-colors text-lg shadow-lg"
                >
                  {loading ? "Restableciendo..." : "Restablecer contraseña"}
                </button>
              </form>
            )}

            <div className="mt-8 text-center">
              <p className="text-gray-600">
                <Link
                  href="/login"
                  className="text-orange-600 font-medium hover:text-orange-700 transition-colors"
                >
                  Volver al login
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </DesktopLayout>
  );
}

