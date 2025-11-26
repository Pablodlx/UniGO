"use client";

import { FavoriteRide } from "@/lib/api";

interface ConfirmFavoriteModalProps {
  isOpen: boolean;
  favorite: FavoriteRide | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmFavoriteModal({
  isOpen,
  favorite,
  onConfirm,
  onCancel,
}: ConfirmFavoriteModalProps) {
  if (!isOpen || !favorite) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-md backdrop-saturate-200 pointer-events-none">
      <div 
        className="relative bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-gray-200 transform transition-all pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-8">
          <h3 className="text-2xl font-semibold text-gray-900 mb-6">
            Confirmar viaje favorito
          </h3>
          
          <div className="mb-6 bg-gray-50 rounded-lg p-6 space-y-4">
            <div>
              <span className="text-sm font-medium text-gray-500">Nombre:</span>
              <p className="text-lg text-gray-900 font-semibold">{favorite.name}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-sm font-medium text-gray-500">Desde:</span>
                <p className="text-gray-900">{favorite.departure_city}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">Hasta:</span>
                <p className="text-gray-900">{favorite.destination_city}</p>
              </div>
            </div>
            
            {favorite.departure_time && (
              <div>
                <span className="text-sm font-medium text-gray-500">Hora de salida:</span>
                <p className="text-gray-900">{favorite.departure_time}</p>
              </div>
            )}
            
            {favorite.available_seats && (
              <div>
                <span className="text-sm font-medium text-gray-500">Asientos disponibles:</span>
                <p className="text-gray-900">{favorite.available_seats}</p>
              </div>
            )}
            
            {favorite.price_per_seat && (
              <div>
                <span className="text-sm font-medium text-gray-500">Precio por asiento:</span>
                <p className="text-gray-900">{favorite.price_per_seat.toFixed(2)} €</p>
              </div>
            )}
            
            {(favorite.vehicle_brand || favorite.vehicle_color) && (
              <div>
                <span className="text-sm font-medium text-gray-500">Vehículo:</span>
                <p className="text-gray-900">
                  {[favorite.vehicle_brand, favorite.vehicle_color].filter(Boolean).join(' ')}
                </p>
              </div>
            )}
            
            {favorite.additional_details && (
              <div>
                <span className="text-sm font-medium text-gray-500">Detalles adicionales:</span>
                <p className="text-gray-900">{favorite.additional_details}</p>
              </div>
            )}
          </div>
          
          <div className="flex justify-end space-x-4">
            <button
              onClick={onCancel}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={onConfirm}
              className="px-6 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors shadow-sm"
            >
              Usar este viaje
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}



