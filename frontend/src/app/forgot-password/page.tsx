"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import DesktopLayout from "@/components/DesktopLayout";
import { forgotPassword } from "@/lib/api";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);
    
    try {
      await forgotPassword(email);
      setSuccess(true);
      setMsg("Si tu email existe, te enviamos un enlace de recuperación.");
    } catch (e: unknown) {
      let errorMessage = "Error al solicitar recuperación";
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
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Recuperar contraseña</h1>
              <p className="text-gray-600">Introduce tu email para recibir un enlace de recuperación</p>
            </div>

            {success ? (
              <div className="space-y-6">
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                  <p className="text-green-800 text-sm font-medium">{msg}</p>
                </div>
                <Link
                  href="/login"
                  className="block w-full bg-orange-500 text-white py-4 px-8 rounded-xl font-semibold hover:bg-orange-600 transition-colors text-lg shadow-lg text-center"
                >
                  Volver al login
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
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

                {msg && (
                  <div className={`rounded-xl p-4 ${
                    msg.includes("enviamos") 
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
                  {loading ? "Enviando..." : "Enviar enlace"}
                </button>
              </form>
            )}

            <div className="mt-8 text-center">
              <p className="text-gray-600">
                ¿Recordaste tu contraseña?{" "}
                <Link
                  href="/login"
                  className="text-orange-600 font-medium hover:text-orange-700 transition-colors"
                >
                  Iniciar sesión
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </DesktopLayout>
  );
}

