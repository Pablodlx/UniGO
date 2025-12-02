"use client";

import { useState, useEffect } from "react";
import { Elements, useStripe } from "@stripe/react-stripe-js";
import PaymentForm from "./PaymentForm";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onError?: (error: string) => void;
}

export default function PaymentModal({
  isOpen,
  onClose,
  onSuccess,
  onError,
}: PaymentModalProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      createSetupIntent();
    } else {
      // Reset state when modal closes
      setClientSecret(null);
      setError(null);
      setLoading(false);
    }
  }, [isOpen]);

  const createSetupIntent = async () => {
    setLoading(true);
    setError(null);

    try {
      const { createSetupIntent } = await import("@/lib/api");
      const response = await createSetupIntent();
      setClientSecret(response.client_secret);
    } catch (err: any) {
      const errorMsg = err?.message || "Error al inicializar el formulario de pago";
      setError(errorMsg);
      if (onError) {
        onError(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSuccess = (setupIntentId: string, paymentMethodId: string) => {
    onSuccess();
    onClose();
  };

  const handleError = (errorMsg: string) => {
    setError(errorMsg);
    if (onError) {
      onError(errorMsg);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-green-50 to-green-100 border-b border-green-200 rounded-t-xl px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">
              💳 Método de Pago
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl font-light transition-colors"
              aria-label="Cerrar"
            >
              ×
            </button>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Guarda tu tarjeta para que el conductor pueda aceptar tu reserva. No se cobrará hasta que el viaje se complete.
          </p>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading && !clientSecret ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-gray-500">Cargando formulario de pago...</div>
            </div>
          ) : error && !clientSecret ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800 text-sm">{error}</p>
              <button
                onClick={onClose}
                className="mt-4 w-full bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors"
              >
                Cerrar
              </button>
            </div>
          ) : clientSecret ? (
            <ElementsContent
              clientSecret={clientSecret}
              onSuccess={handleSuccess}
              onError={handleError}
              onCancel={onClose}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

// Inner component that uses Elements (requires StripeProviderWrapper parent)
function ElementsContent({
  clientSecret,
  onSuccess,
  onError,
  onCancel,
}: {
  clientSecret: string;
  onSuccess: (setupIntentId: string, paymentMethodId: string) => void;
  onError: (error: string) => void;
  onCancel: () => void;
}) {
  const stripe = useStripe();

  if (!stripe) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800 text-sm">
          Stripe no está configurado. Por favor, configura NEXT_PUBLIC_STRIPE_PUBLIC_KEY en las variables de entorno.
        </p>
        <button
          onClick={onCancel}
          className="mt-4 w-full bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors"
        >
          Cerrar
        </button>
      </div>
    );
  }

  return (
    <Elements options={{ clientSecret }} stripe={stripe}>
      <PaymentForm
        clientSecret={clientSecret}
        onSuccess={onSuccess}
        onError={onError}
        onCancel={onCancel}
      />
    </Elements>
  );
}

