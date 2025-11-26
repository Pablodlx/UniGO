"use client";

import { useState } from "react";
import { login, register, verifyEmail, clearToken, getToken } from "@/lib/api";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: () => void;
}

export default function AuthModal({ isOpen, onClose, onLoginSuccess }: AuthModalProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      await login(email, password);
      onLoginSuccess();
      onClose();
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al iniciar sesión");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      await register(email, password);
      setRegistrationSuccess(true);
      setIsRegistering(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrarse");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifying(true);
    setError("");

    try {
      await verifyEmail(email, verificationCode);
      setRegistrationSuccess(false);
      setIsRegistering(false);
      resetForm();
      onClose();
      // Show success message or redirect to login
      alert("¡Email verificado! Ya puedes iniciar sesión.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Código de verificación inválido");
    } finally {
      setIsVerifying(false);
    }
  };

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setVerificationCode("");
    setError("");
    setIsRegistering(false);
    setRegistrationSuccess(false);
  };

  const handleLogout = () => {
    clearToken();
    onLoginSuccess();
    onClose();
  };

  if (!isOpen) return null;

  const isLoggedIn = !!getToken();

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-md backdrop-saturate-200 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            {isLoggedIn 
              ? "Mi Cuenta" 
              : registrationSuccess 
                ? "Verificar Email" 
                : isRegistering 
                  ? "Registrarse" 
                  : "Iniciar Sesión"
            }
          </h2>
          <button
            onClick={() => {
              resetForm();
              onClose();
            }}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        {isLoggedIn ? (
          <div className="space-y-4">
            <p className="text-gray-600">Ya has iniciado sesión en tu cuenta.</p>
            <button
              onClick={handleLogout}
              className="w-full bg-red-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-red-700 transition-colors"
            >
              Cerrar Sesión
            </button>
          </div>
        ) : registrationSuccess ? (
          <form onSubmit={handleVerify} className="space-y-4">
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
              ¡Registro exitoso! Revisa tu email y introduce el código de verificación.
            </div>
            
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="verificationCode" className="block text-sm font-medium text-gray-700 mb-2">
                Código de verificación (6 dígitos)
              </label>
              <input
                id="verificationCode"
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                required
                maxLength={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-lg tracking-widest"
                placeholder="123456"
              />
            </div>

            <button
              type="submit"
              disabled={isVerifying}
              className="w-full bg-green-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isVerifying ? "Verificando..." : "Verificar Email"}
            </button>

            <button
              type="button"
              onClick={() => setRegistrationSuccess(false)}
              className="w-full text-gray-600 py-2 px-4 rounded-lg font-medium hover:text-gray-800 transition-colors"
            >
              Volver al login
            </button>
          </form>
        ) : (
          <form onSubmit={isRegistering ? handleRegister : handleLogin} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Correo electrónico
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="tu@email.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="••••••••"
              />
              {isRegistering && (
                <p className="text-xs text-gray-500 mt-1">Mínimo 6 caracteres</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-900 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading 
                ? (isRegistering ? "Registrando..." : "Iniciando sesión...") 
                : (isRegistering ? "Registrarse" : "Iniciar Sesión")
              }
            </button>

            <button
              type="button"
              onClick={() => {
                setIsRegistering(!isRegistering);
                setError("");
              }}
              className="w-full text-gray-600 py-2 px-4 rounded-lg font-medium hover:text-gray-800 transition-colors"
            >
              {isRegistering ? "¿Ya tienes cuenta? Iniciar sesión" : "¿No tienes cuenta? Registrarse"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
