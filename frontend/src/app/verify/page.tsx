"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import DesktopLayout from "@/components/DesktopLayout";
import Link from "next/link";
import { verifyEmail } from "@/lib/api";

export default function VerifyPage() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Auto-focus first input
  useEffect(() => {
    const firstInput = document.getElementById("code-0");
    if (firstInput) {
      firstInput.focus();
    }
  }, []);

  const handleCodeChange = (index: number, value: string) => {
    if (value.length > 1) {
      // Handle paste
      const pastedCode = value.slice(0, 6);
      const codeArray = pastedCode.split("").slice(0, 6);
      const newCode = codeArray.join("").padEnd(6, "");
      setCode(newCode);
      
      // Auto-submit if all 6 digits are pasted
      if (codeArray.length === 6 && codeArray.every(d => d.trim() !== "")) {
        setTimeout(() => {
          handleSubmitWithCode(newCode);
        }, 100);
        return;
      }
      
      // Focus appropriate input
      const nextIndex = Math.min(codeArray.length, 5);
      const nextInput = document.getElementById(`code-${nextIndex}`);
      if (nextInput) {
        (nextInput as HTMLInputElement).focus();
      }
      return;
    }

    // Single character input
    const newCodeArray = code.split("");
    newCodeArray[index] = value;
    const updatedCode = newCodeArray.join("").slice(0, 6);
    setCode(updatedCode);

    // Auto-advance to next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`code-${index + 1}`);
      if (nextInput) {
        (nextInput as HTMLInputElement).focus();
      }
    }

    // Auto-submit when all 6 digits are entered and all are non-empty
    // Use a small delay to ensure React state is updated
    setTimeout(() => {
      // Re-check the actual input values to ensure they're all filled
      const allInputs = [0, 1, 2, 3, 4, 5].map(i => {
        const input = document.getElementById(`code-${i}`) as HTMLInputElement;
        return input?.value || "";
      });
      const completeCode = allInputs.join("");
      
      if (completeCode.length === 6 && /^\d{6}$/.test(completeCode)) {
        setCode(completeCode); // Sync state
        handleSubmitWithCode(completeCode);
      }
    }, 200); // Give React time to update state
  };

  const handleSubmitWithCode = async (codeToSubmit: string) => {
    // Clear any previous errors first
    setError("");
    
    // Validate that all 6 digits are filled
    if (!codeToSubmit || codeToSubmit.length !== 6) {
      setError("Por favor, introduce el código completo de 6 dígitos");
      return;
    }
    
    // Check that all characters are digits
    if (!/^\d{6}$/.test(codeToSubmit)) {
      setError("El código debe contener solo números");
      return;
    }

    setError("");
    setLoading(true);

    try {
      // Verify email and get token
      await verifyEmail(email, codeToSubmit);
      
      // Show success message briefly
      setSuccess(true);
      
      // Redirect to profile setup after a short delay
      setTimeout(() => {
        router.push("/profile");
      }, 1500);
    } catch (err: any) {
      setError(err?.message || "Código inválido. Por favor, inténtalo de nuevo.");
      setCode(""); // Clear code on error
      // Focus first input
      const firstInput = document.getElementById("code-0");
      if (firstInput) {
        (firstInput as HTMLInputElement).focus();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      const prevInput = document.getElementById(`code-${index - 1}`);
      if (prevInput) {
        (prevInput as HTMLInputElement).focus();
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleSubmitWithCode(code);
  };

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
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-gradient-to-br from-orange-50 via-white to-orange-50 min-h-screen flex items-center justify-center py-12 px-4">
        <div className="max-w-md w-full">
          {/* Verify Form Card */}
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 p-10 relative overflow-hidden">
            {/* Decorative background elements */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-100 rounded-full -mr-16 -mt-16 opacity-50"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-orange-100 rounded-full -ml-12 -mb-12 opacity-50"></div>
            
            <div className="relative z-10">
              {/* Success State */}
              {success ? (
                <div className="text-center py-8">
                  <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6 animate-scale-in">
                    <svg className="w-12 h-12 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">¡Cuenta verificada!</h2>
                  <p className="text-gray-600 mb-6">Redirigiendo a tu perfil...</p>
                  <div className="flex justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Icon */}
                  <div className="text-center mb-8">
                    <div className="mx-auto w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4">
                      <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                      </svg>
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-3">Verificar cuenta</h1>
                    <p className="text-gray-600 text-lg">
                      Introduce el código que hemos enviado a
                    </p>
                    <p className="text-gray-900 font-semibold text-lg mt-1">{email}</p>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-8">
                    {/* Code Input - 6 separate inputs */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-4 text-center">
                        Código de verificación
                      </label>
                      <div className="flex justify-center space-x-3">
                        {[0, 1, 2, 3, 4, 5].map((index) => (
                          <input
                            key={index}
                            id={`code-${index}`}
                            type="text"
                            inputMode="numeric"
                            maxLength={1}
                            value={code[index] || ""}
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, ""); // Only numbers
                              handleCodeChange(index, value);
                            }}
                            onKeyDown={(e) => handleKeyDown(index, e)}
                            className="w-14 h-16 text-center text-2xl font-bold border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
                            required
                            disabled={loading}
                          />
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 text-center mt-3">
                        El código se enviará automáticamente cuando completes los 6 dígitos
                      </p>
                    </div>

                    {error && (
                      <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 animate-shake">
                        <div className="flex items-start space-x-3">
                          <svg className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
                          </svg>
                          <p className="text-red-800 text-sm font-medium flex-1">{error}</p>
                        </div>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={loading || code.length !== 6 || !/^\d{6}$/.test(code)}
                      className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white py-4 px-8 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:from-orange-600 hover:to-orange-700 transition-all text-lg shadow-lg transform hover:scale-[1.02] active:scale-[0.98]"
                    >
                      {loading ? (
                        <span className="flex items-center justify-center">
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Verificando...
                        </span>
                      ) : (
                        "Verificar cuenta"
                      )}
                    </button>
                  </form>

                  <div className="mt-8 text-center">
                    <p className="text-gray-600 text-sm">
                      ¿No recibiste el código?{" "}
                      <button
                        onClick={() => router.push("/register")}
                        className="text-orange-600 font-semibold hover:text-orange-700 transition-colors underline"
                      >
                        Regístrate de nuevo
                      </button>
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Info Card */}
          <div className="mt-6 bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-orange-100">
            <div className="flex items-start space-x-3">
              <svg className="w-6 h-6 text-orange-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
              </svg>
              <div>
                <p className="text-sm font-semibold text-gray-900 mb-1">¿Dónde encontrar el código?</p>
                <p className="text-sm text-gray-600">
                  Revisa tu bandeja de entrada y la carpeta de spam. El código tiene 6 dígitos y expira en 10 minutos.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DesktopLayout>
  );
}
