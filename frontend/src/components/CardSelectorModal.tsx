"use client";

import { useState, useEffect } from "react";
import { PaymentMethod, listPaymentMethods } from "@/lib/api";

interface CardSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (paymentMethodId: string) => void;
  title?: string;
}

export default function CardSelectorModal({
  isOpen,
  onClose,
  onSelect,
  title = "Elige tu método de pago",
}: CardSelectorModalProps) {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadPaymentMethods();
    } else {
      setSelectedCardId(null);
    }
  }, [isOpen]);

  const loadPaymentMethods = async () => {
    try {
      setLoading(true);
      const cards = await listPaymentMethods();
      setPaymentMethods(cards);
      // Auto-select first card so user can confirm quickly, but they must still confirm
      if (cards.length > 0) {
        setSelectedCardId(cards[0].id);
      }
    } catch (error: any) {
      console.error("Error loading payment methods:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (selectedCardId) {
      onSelect(selectedCardId);
      onClose();
    }
  };

  const getCardBrandIcon = (brand: string) => {
    const brandLower = brand?.toLowerCase() || "";
    if (brandLower.includes("visa")) return "💳";
    if (brandLower.includes("mastercard")) return "💳";
    if (brandLower.includes("amex")) return "💳";
    return "💳";
  };

  const formatExpiry = (expMonth: number, expYear: number) => {
    return `${String(expMonth).padStart(2, '0')}/${String(expYear).slice(-2)}`;
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-green-50 to-green-100 border-b border-green-200 rounded-t-xl px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">{title}</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl font-light transition-colors"
              aria-label="Cerrar"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-gray-500">Cargando tarjetas...</div>
            </div>
          ) : paymentMethods.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600 mb-4">No tienes tarjetas guardadas</p>
              <p className="text-sm text-gray-500">
                Por favor, añade una tarjeta en "Mis Tarjetas" antes de continuar.
              </p>
            </div>
          ) : (
            <div className="space-y-3 mb-6">
              {paymentMethods.map((card) => (
                <label
                  key={card.id}
                  className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                    selectedCardId === card.id
                      ? "border-green-500 bg-green-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value={card.id}
                    checked={selectedCardId === card.id}
                    onChange={() => setSelectedCardId(card.id)}
                    className="w-4 h-4 text-green-600 focus:ring-green-500 focus:ring-2"
                  />
                  <div className="ml-4 flex-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">{getCardBrandIcon(card.card?.brand || "")}</span>
                        <div>
                          <div className="font-semibold text-gray-900">
                            •••• •••• •••• {card.card?.last4 || "****"}
                          </div>
                          <div className="text-sm text-gray-600">
                            {card.card?.brand
                              ? card.card.brand.charAt(0).toUpperCase() + card.card.brand.slice(1)
                              : "Tarjeta"}
                            {card.card?.exp_month &&
                              card.card?.exp_year &&
                              ` • Expira ${formatExpiry(card.card.exp_month, card.card.exp_year)}`}
                          </div>
                        </div>
                      </div>
                      {card.is_default && (
                        <span className="bg-green-100 text-green-800 text-xs font-semibold px-2 py-1 rounded">
                          Predeterminada
                        </span>
                      )}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-4">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 rounded-xl font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={!selectedCardId || loading}
              className="flex-1 bg-green-500 text-white py-3 px-6 rounded-xl font-semibold hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Confirmar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

