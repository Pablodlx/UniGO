"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import DesktopLayout from "@/components/DesktopLayout";
import { getToken } from "@/lib/api";
import { useToast } from "@/hooks/useToast";

const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000/api";

export default function BankAccountPage() {
  const router = useRouter();
  const { showToast, ToastComponent } = useToast();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    dob_day: "",
    dob_month: "",
    dob_year: "",
    iban: "",
    id_number: "",
    address_line1: "",
    address_city: "",
    address_postal_code: "",
    phone: "",
  });

  useEffect(() => {
    // Redirect to my-cards where IBAN management is now integrated
    router.push("/my-cards");
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.first_name || !formData.last_name) {
      showToast("Por favor, completa tu nombre y apellidos");
      return;
    }
    
    if (!formData.dob_day || !formData.dob_month || !formData.dob_year) {
      showToast("Por favor, completa tu fecha de nacimiento");
      return;
    }
    
    if (!formData.iban) {
      showToast("Por favor, introduce tu IBAN");
      return;
    }
    
    if (!formData.id_number) {
      showToast("Por favor, introduce tu DNI/NIE");
      return;
    }
    
    if (!formData.address_line1 || !formData.address_city || !formData.address_postal_code) {
      showToast("Por favor, completa tu dirección");
      return;
    }

    setLoading(true);

    try {
      const token = getToken();
      const response = await fetch(`${BASE}/payments/connect/onboarding`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          first_name: formData.first_name,
          last_name: formData.last_name,
          dob_day: parseInt(formData.dob_day),
          dob_month: parseInt(formData.dob_month),
          dob_year: parseInt(formData.dob_year),
          iban: formData.iban,
          id_number: formData.id_number,
          address_line1: formData.address_line1,
          address_city: formData.address_city,
          address_postal_code: formData.address_postal_code,
          phone: formData.phone || undefined,
        }),
      });

      if (response.ok) {
        showToast("✅ Cuenta bancaria configurada correctamente");
        setTimeout(() => {
          router.push("/profile");
        }, 2000);
      } else {
        const errorData = await response.json();
        showToast(errorData.detail || "Error al configurar la cuenta bancaria");
      }
    } catch (error: any) {
      console.error("Error:", error);
      showToast(error?.message || "Error al configurar la cuenta bancaria");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (!isLoggedIn) {
    return null;
  }

  return (
    <DesktopLayout showSidebar={false}>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="px-8 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center shadow-md">
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
                    <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="text-2xl font-bold text-gray-800">UniGO</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-3xl mx-auto px-8 py-12">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Configurar Cuenta Bancaria</h1>
            <p className="text-gray-600 mb-8">
              Para recibir pagos como conductor, necesitamos tus datos bancarios. Esta información se guarda de forma segura con Stripe.
            </p>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Nombre y Apellidos */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nombre
                  </label>
                  <input
                    type="text"
                    value={formData.first_name}
                    onChange={(e) => handleChange("first_name", e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Juan"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Apellidos
                  </label>
                  <input
                    type="text"
                    value={formData.last_name}
                    onChange={(e) => handleChange("last_name", e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="García López"
                    required
                  />
                </div>
              </div>

              {/* Fecha de Nacimiento */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fecha de Nacimiento
                </label>
                <div className="grid grid-cols-3 gap-4">
                  <input
                    type="number"
                    value={formData.dob_day}
                    onChange={(e) => handleChange("dob_day", e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Día"
                    min="1"
                    max="31"
                    required
                  />
                  <input
                    type="number"
                    value={formData.dob_month}
                    onChange={(e) => handleChange("dob_month", e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Mes"
                    min="1"
                    max="12"
                    required
                  />
                  <input
                    type="number"
                    value={formData.dob_year}
                    onChange={(e) => handleChange("dob_year", e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Año"
                    min="1900"
                    max="2010"
                    required
                  />
                </div>
              </div>

              {/* IBAN */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  IBAN
                </label>
                <input
                  type="text"
                  value={formData.iban}
                  onChange={(e) => handleChange("iban", e.target.value.toUpperCase())}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="ES9121000418450200051332"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Tu número de cuenta bancaria internacional (IBAN)
                </p>
              </div>

              {/* DNI/NIE */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  DNI/NIE
                </label>
                <input
                  type="text"
                  value={formData.id_number}
                  onChange={(e) => handleChange("id_number", e.target.value.toUpperCase())}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="12345678A"
                  required
                />
              </div>

              {/* Dirección */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Dirección
                </label>
                <input
                  type="text"
                  value={formData.address_line1}
                  onChange={(e) => handleChange("address_line1", e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Calle Principal 123"
                  required
                />
              </div>

              {/* Ciudad y Código Postal */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ciudad
                  </label>
                  <input
                    type="text"
                    value={formData.address_city}
                    onChange={(e) => handleChange("address_city", e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Madrid"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Código Postal
                  </label>
                  <input
                    type="text"
                    value={formData.address_postal_code}
                    onChange={(e) => handleChange("address_postal_code", e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="28001"
                    required
                  />
                </div>
              </div>

              {/* Teléfono (Opcional) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Teléfono <span className="text-gray-400 text-xs">(Opcional)</span>
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="+34 612 345 678"
                />
              </div>

              {/* Info Box */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <div className="text-sm text-blue-800">
                    <p className="font-semibold mb-1">Información segura</p>
                    <p>
                      Tus datos bancarios se guardan de forma segura con Stripe. 
                      Recibirás automáticamente el 85% del precio de cada viaje completado.
                      La app retiene un 15% de comisión.
                    </p>
                  </div>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => router.push("/profile")}
                  className="flex-1 px-6 py-3 border border-gray-300 rounded-xl font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                  disabled={loading}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-green-500 text-white py-3 px-6 rounded-xl font-semibold hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Guardando..." : "Guardar Cuenta Bancaria"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {ToastComponent}
    </DesktopLayout>
  );
}

