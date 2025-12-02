"use client";

import { useState, useEffect } from "react";
import {
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

interface PaymentFormProps {
  clientSecret: string;
  onSuccess: (setupIntentId: string, paymentMethodId: string, customerId?: string) => void;
  onError: (error: string) => void;
  onCancel?: () => void;
}

export default function PaymentForm({
  clientSecret,
  onSuccess,
  onError,
  onCancel,
}: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!stripe || !clientSecret) {
      return;
    }
  }, [stripe, clientSecret]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setMessage(null);

    try {
      // Submit the form first to validate PaymentElement
      const { error: submitError } = await elements.submit();
      if (submitError) {
        setMessage(submitError.message || "Error al validar el formulario");
        onError(submitError.message || "Error al validar el formulario");
        setIsProcessing(false);
        return;
      }

      const { setupIntent, error: confirmError } = await stripe.confirmSetup({
        elements,
        clientSecret,
        confirmParams: {},
        redirect: "if_required",
      });

      if (confirmError) {
        setMessage(confirmError.message || "Error al confirmar el método de pago");
        onError(confirmError.message || "Error al confirmar el método de pago");
        setIsProcessing(false);
        return;
      }

      if (setupIntent && setupIntent.status === "succeeded") {
        const paymentMethodId = setupIntent.payment_method as string;
        const customerId = setupIntent.customer as string | undefined;

        // Call backend to save payment method
        const { confirmSetupIntent } = await import("@/lib/api");
        try {
          const result = await confirmSetupIntent({
            setup_intent_id: setupIntent.id,
            payment_method_id: paymentMethodId,
            customer_id: customerId,
          });

          onSuccess(setupIntent.id, result.payment_method_id, result.customer_id);
        } catch (apiError: any) {
          const errorMsg = apiError?.message || "Error al guardar el método de pago";
          setMessage(errorMsg);
          onError(errorMsg);
        }
      } else {
        const errorMsg = "El método de pago no se pudo confirmar";
        setMessage(errorMsg);
        onError(errorMsg);
      }
    } catch (err: any) {
      const errorMsg = err?.message || "Error inesperado al procesar el pago";
      setMessage(errorMsg);
      onError(errorMsg);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!stripe || !elements) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500">Cargando...</div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <PaymentElement
          options={{
            layout: "tabs",
          }}
        />
      </div>

      {message && (
        <div className={`p-4 rounded-lg ${
          message.includes("Error") || message.includes("error")
            ? "bg-red-50 text-red-800 border border-red-200"
            : "bg-green-50 text-green-800 border border-green-200"
        }`}>
          {message}
        </div>
      )}

      <div className="flex gap-4">
        <button
          type="submit"
          disabled={isProcessing || !stripe || !elements}
          className="flex-1 bg-green-500 text-white py-3 px-6 rounded-xl font-semibold hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing ? "Procesando..." : "Guardar Método de Pago"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isProcessing}
            className="px-6 py-3 border border-gray-300 rounded-xl font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}

