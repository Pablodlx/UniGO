"use client";

import { useState } from "react";
import { getToken } from "@/lib/api";
import AddressAutocomplete, { AddressValue } from "@/components/AddressAutocomplete";

const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000/api";

interface BankAccountFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

interface FormData {
  first_name: string;
  last_name: string;
  dob_day: string;
  dob_month: string;
  dob_year: string;
  iban: string;
  id_number: string;
  phone: string;
}

export default function BankAccountForm({ onSuccess, onCancel }: BankAccountFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [address, setAddress] = useState<AddressValue | null>(null);
  const [formData, setFormData] = useState<FormData>({
    first_name: "",
    last_name: "",
    dob_day: "",
    dob_month: "",
    dob_year: "",
    iban: "",
    id_number: "",
    phone: "",
  });

  // Extract address components when address changes
  const handleAddressChange = (value: AddressValue | null) => {
    setAddress(value);
    
    if (value && value.formattedAddress) {
      // Use the formatted address as address_line1
      // This will be sent to Stripe
      console.log("[BankAccountForm] Address selected:", value);
    }
  };

  const handleChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.first_name || !formData.last_name) {
      setError("Por favor, completa tu nombre y apellidos");
      return;
    }
    
    if (!formData.dob_day || !formData.dob_month || !formData.dob_year) {
      setError("Por favor, completa tu fecha de nacimiento");
      return;
    }
    
    if (!formData.iban) {
      setError("Por favor, introduce tu IBAN");
      return;
    }
    
    if (!formData.id_number) {
      setError("Por favor, introduce tu DNI/NIE");
      return;
    }
    
    if (!address || !address.formattedAddress) {
      setError("Por favor, selecciona una dirección válida de las sugerencias");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const token = getToken();
      const response = await fetch(`${BASE}/bank-account/create-or-update`, {
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
          // Extract address components from formatted address
          address_line1: address?.formattedAddress?.split(",")[0]?.trim() || "",
          address_city: address?.formattedAddress?.split(",")[1]?.trim() || "Madrid",
          address_postal_code: address?.formattedAddress?.match(/\d{5}/)?.[0] || "28001",
          phone: formData.phone || undefined,
        }),
      });

      if (response.ok) {
        onSuccess();
      } else {
        const errorData = await response.json();
        setError(errorData.detail || "Error al configurar la cuenta bancaria");
      }
    } catch (err: any) {
      console.error("Error:", err);
      setError(err?.message || "Error al configurar la cuenta bancaria");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

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

      {/* Dirección con Google Autocomplete */}
      <div>
        <AddressAutocomplete
          id="bank-account-address"
          label="Dirección Completa"
          placeholder="Ej. Calle Gran Vía, 123, Madrid"
          initialValue={address}
          onChange={handleAddressChange}
          required={true}
          restrictions={{ country: ["ES"] }}
          showVerifiedBadge={false}
        />
        <p className="text-xs text-gray-500 mt-1">
          Escribe tu dirección completa y selecciona de las sugerencias
        </p>
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
      <div className="flex space-x-4">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
          disabled={loading}
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-green-500 text-white py-3 px-6 rounded-lg font-semibold hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Guardando..." : "Guardar Cuenta Bancaria"}
        </button>
      </div>
    </form>
  );
}

