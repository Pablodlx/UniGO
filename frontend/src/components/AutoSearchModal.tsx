"use client";

import { useState } from "react";
import AddressAutocomplete, { AddressValue } from "./AddressAutocomplete";
import CardSelectorModal from "./CardSelectorModal";
import { listPaymentMethods } from "@/lib/api";

interface AutoSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onError?: (message: string) => void;
  userUniversity?: string | null;
  userHomeAddress?: AddressValue | null;
}

const FLEXIBILITY_OPTIONS = [
  { value: 5, label: "±5 min" },
  { value: 10, label: "±10 min" },
  { value: 15, label: "±15 min" },
  { value: 30, label: "±30 min" },
];

export default function AutoSearchModal({
  isOpen,
  onClose,
  onSuccess,
  onError,
  userUniversity,
  userHomeAddress,
}: AutoSearchModalProps) {
  const [origin, setOrigin] = useState<AddressValue | null>(null);
  const [destination, setDestination] = useState<AddressValue | null>(null);
  const [targetTime, setTargetTime] = useState<string>("09:00");
  const [specificDates, setSpecificDates] = useState<string[]>([]);
  const [newDate, setNewDate] = useState<string>("");
  const [flexibilityMinutes, setFlexibilityMinutes] = useState<number>(30);
  const [allowNearbySearch, setAllowNearbySearch] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCardSelector, setShowCardSelector] = useState(false);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string | null>(null);
  const [pendingSubmit, setPendingSubmit] = useState<boolean>(false);
  const [errors, setErrors] = useState<{
    origin?: string;
    destination?: string;
    dates?: string;
  }>({});

  if (!isOpen) return null;

  const addDate = () => {
    if (!newDate) return;
    
    // Check if date is not in the past
    const selectedDate = new Date(newDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (selectedDate < today) {
      setErrors((prev) => ({ ...prev, dates: "No puedes seleccionar fechas pasadas" }));
      return;
    }
    
    // Check if date is not already added
    if (specificDates.includes(newDate)) {
      setErrors((prev) => ({ ...prev, dates: "Esta fecha ya está seleccionada" }));
      return;
    }
    
    setSpecificDates((prev) => [...prev, newDate].sort());
    setNewDate("");
    if (errors.dates) {
      setErrors((prev) => ({ ...prev, dates: undefined }));
    }
  };

  const removeDate = (dateToRemove: string) => {
    setSpecificDates((prev) => prev.filter((d) => d !== dateToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Reset errors
    setErrors({});

    // Validation
    if (!origin) {
      setErrors((prev) => ({ ...prev, origin: "El origen es obligatorio" }));
      return;
    }

    if (!destination) {
      setErrors((prev) => ({ ...prev, destination: "El destino es obligatorio" }));
      return;
    }

    if (specificDates.length === 0) {
      setErrors((prev) => ({ 
        ...prev, 
        dates: "Selecciona al menos una fecha específica"
      }));
      return;
    }

    // VALIDATE PAYMENT METHODS - Always check before creating alert
    // If payment method is explicitly provided (from card selector), use it directly
    if (selectedPaymentMethodId) {
      // Payment method already selected, proceed with alert creation
      await createAlert();
      return;
    }

    // Always check payment methods before allowing alert creation
    try {
      const cards = await listPaymentMethods();
      
      if (cards.length === 0) {
        if (onError) {
          onError("Debes añadir un método de pago antes de continuar");
        }
        return;
      } else if (cards.length === 1) {
        // Use the only card automatically, proceed with creation
        setSelectedPaymentMethodId(cards[0].id);
        await createAlert();
      } else {
        // Multiple cards: always show selector modal to choose
        setPendingSubmit(true);
        setShowCardSelector(true);
      }
    } catch (error: any) {
      console.error("Error checking payment methods:", error);
      if (onError) {
        onError("Error al verificar métodos de pago. Por favor, intenta de nuevo.");
      }
    }
  };

  const createAlert = async () => {
    setIsSubmitting(true);

    try {
      const { createSearchAlert } = await import("@/lib/api");
      
      await createSearchAlert({
        origin: origin.formattedAddress,
        origin_lat: origin.lat,
        origin_lng: origin.lng,
        destination: destination.formattedAddress,
        destination_lat: destination.lat,
        destination_lng: destination.lng,
        target_time: targetTime,
        specific_dates: specificDates,
        flexibility_minutes: flexibilityMinutes,
        allow_nearby_search: allowNearbySearch,
      });

      onSuccess();
      handleClose();
    } catch (error: any) {
      console.error("Error creating search alert:", error);
      const errorMessage = error?.message || "Error al crear la alerta. Por favor, intenta de nuevo.";
      if (onError) {
        onError(errorMessage);
      }
    } finally {
      setIsSubmitting(false);
      setPendingSubmit(false);
    }
  };

  const handleCardSelected = async (paymentMethodId: string) => {
    setSelectedPaymentMethodId(paymentMethodId);
    setShowCardSelector(false);
    // Proceed with alert creation after card selection
    if (pendingSubmit) {
      setPendingSubmit(false);
      await createAlert();
    }
  };

  const handleClose = () => {
    // Reset form
    setOrigin(null);
    setDestination(null);
    setTargetTime("09:00");
    setSpecificDates([]);
    setNewDate("");
    setFlexibilityMinutes(30);
    setAllowNearbySearch(false);
    setErrors({});
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-md backdrop-saturate-200"
      onClick={handleClose}
    >
      <div
        className="relative bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-gray-200 transform transition-all max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-green-50 to-green-100 border-b border-green-200 rounded-t-xl px-8 py-6 flex-shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">
              ✨ Búsqueda Automática
            </h2>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 text-3xl font-light transition-colors"
              aria-label="Cerrar"
            >
              ×
            </button>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            Guardaremos estos datos y buscaremos por ti viajes nuevos y existentes que encajen con tu origen, destino y horario. Cuando haya uno compatible, crearemos una reserva pendiente de confirmar por el conductor y te avisaremos. Si te rechazan, la búsqueda seguirá activa y continuará buscando.
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Origin */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Origen deseado
              </label>
              <AddressAutocomplete
                id="alert-origin"
                placeholder="Ej. Calle Gran Vía, 1"
                initialValue={origin}
                onChange={(value) => {
                  setOrigin(value);
                  if (errors.origin) {
                    setErrors((prev) => ({ ...prev, origin: undefined }));
                  }
                }}
                required={true}
                error={errors.origin}
                showVerifiedBadge={false}
                className="w-full"
                university={userUniversity}
                homeAddress={userHomeAddress}
                fieldType="departure"
              />
            </div>

            {/* Destination */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Destino deseado
              </label>
              <AddressAutocomplete
                id="alert-destination"
                placeholder="Ej. Universidad CEU"
                initialValue={destination}
                onChange={(value) => {
                  setDestination(value);
                  if (errors.destination) {
                    setErrors((prev) => ({ ...prev, destination: undefined }));
                  }
                }}
                required={true}
                error={errors.destination}
                showVerifiedBadge={false}
                className="w-full"
                university={userUniversity}
                homeAddress={userHomeAddress}
                fieldType="destination"
              />
            </div>

            {/* Target Time */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Hora objetivo
              </label>
              <input
                type="time"
                value={targetTime}
                onChange={(e) => setTargetTime(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 text-lg"
                required
              />
            </div>

            {/* Specific Dates */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Fechas específicas
              </label>
              <div className="flex gap-2 mb-3">
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => {
                    setNewDate(e.target.value);
                    if (errors.dates) {
                      setErrors((prev) => ({ ...prev, dates: undefined }));
                    }
                  }}
                  min={new Date().toISOString().split('T')[0]}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
                <button
                  type="button"
                  onClick={addDate}
                  className="px-4 py-2 bg-green-500 text-white rounded-xl font-medium hover:bg-green-600 transition-colors"
                >
                  Añadir
                </button>
              </div>
              {specificDates.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {specificDates.map((date) => (
                    <div
                      key={date}
                      className="flex items-center gap-2 bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm"
                    >
                      <span>
                        {new Date(date).toLocaleDateString("es-ES", {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeDate(date)}
                        className="text-green-600 hover:text-green-800 font-bold"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {errors.dates && (
                <p className="text-red-500 text-sm mt-2">{errors.dates}</p>
              )}
            </div>

            {/* Flexibility */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Flexibilidad
              </label>
              <select
                value={flexibilityMinutes}
                onChange={(e) => setFlexibilityMinutes(Number(e.target.value))}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 text-lg"
              >
                {FLEXIBILITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Allow Nearby Search */}
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="allowNearbySearch"
                checked={allowNearbySearch}
                onChange={(e) => setAllowNearbySearch(e.target.checked)}
                className="w-5 h-5 text-green-500 border-gray-300 rounded focus:ring-green-500 focus:ring-2"
              />
              <label htmlFor="allowNearbySearch" className="text-sm font-medium text-gray-700 cursor-pointer">
                Buscar viajes a menos de 1 km de las direcciones especificadas
              </label>
            </div>
            {allowNearbySearch && (
              <p className="text-xs text-gray-500 -mt-2">
                Si activas esta opción, también se buscarán y confirmarán automáticamente viajes cercanos (dentro de 1 km) además de los que coincidan exactamente con las direcciones.
              </p>
            )}

            {/* Buttons */}
            <div className="flex justify-end space-x-4 pt-4">
              <button
                type="button"
                onClick={handleClose}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                disabled={isSubmitting}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-6 py-3 bg-green-500 text-white rounded-xl font-medium hover:bg-green-600 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Activando..." : "Activar búsqueda automática"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Card Selector Modal */}
      <CardSelectorModal
        isOpen={showCardSelector}
        onClose={() => {
          setShowCardSelector(false);
          setPendingSubmit(false);
          setSelectedPaymentMethodId(null);
        }}
        onSelect={handleCardSelected}
        title="Elige tu método de pago"
      />
    </div>
  );
}

