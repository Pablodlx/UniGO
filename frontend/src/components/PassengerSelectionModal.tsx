"use client";

import { useState } from "react";

// Helper to construct full avatar URL
const getAvatarUrl = (avatarUrl: string | null | undefined): string | null => {
  if (!avatarUrl) return null;
  
  // If it's already a full URL, return it as is
  if (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://')) {
    return avatarUrl;
  }
  
  // Otherwise, construct the full URL
  const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000/api";
  const baseUrl = BASE.replace('/api', '');
  return `${baseUrl}${avatarUrl}`;
};

export interface Passenger {
  booking_id: number;
  passenger_id: number;
  passenger_name: string;
  passenger_avatar?: string | null;
  has_rated: boolean;
  can_rate: boolean;
}

interface PassengerSelectionModalProps {
  isOpen: boolean;
  passengers: Passenger[];
  onClose: () => void;
  onSelectPassenger: (passenger: Passenger) => void;
}

export default function PassengerSelectionModal({
  isOpen,
  passengers,
  onClose,
  onSelectPassenger,
}: PassengerSelectionModalProps) {
  if (!isOpen) return null;

  // Filter to only show passengers that can be rated
  const rateablePassengers = passengers.filter(p => p.can_rate);
  const ratedPassengers = passengers.filter(p => p.has_rated);

  const handleSelect = (passenger: Passenger) => {
    if (passenger.can_rate) {
      onSelectPassenger(passenger);
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-md backdrop-saturate-200"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-gray-200 transform transition-all max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-50 to-orange-100 border-b border-orange-200 rounded-t-xl px-8 py-6 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Seleccionar Pasajero</h2>
              <p className="text-sm text-gray-600 mt-1">Elige un pasajero para valorar</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-3xl font-light transition-colors"
              aria-label="Cerrar"
            >
              ×
            </button>
          </div>
        </div>

        {/* Passenger List */}
        <div className="flex-1 overflow-y-auto p-6">
          {rateablePassengers.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-gray-600 text-lg mb-2">Todos los pasajeros han sido valorados</p>
              <p className="text-gray-500">Ya has valorado a todos los pasajeros de este viaje</p>
            </div>
          ) : (
            <div className="space-y-3">
              {rateablePassengers.map((passenger) => {
                const avatarUrl = getAvatarUrl(passenger.passenger_avatar);
                return (
                  <button
                    key={passenger.booking_id}
                    onClick={() => handleSelect(passenger)}
                    className="w-full flex items-center space-x-4 p-4 border-2 border-gray-200 rounded-xl hover:border-orange-500 hover:bg-orange-50 transition-all text-left"
                  >
                    <div className="relative w-14 h-14 flex-shrink-0">
                      {avatarUrl ? (
                        <>
                          <img
                            src={avatarUrl}
                            alt={passenger.passenger_name}
                            className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-md"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const fallback = target.nextElementSibling as HTMLElement;
                              if (fallback) fallback.style.display = 'flex';
                            }}
                          />
                          <div className="w-14 h-14 bg-orange-500 rounded-full items-center justify-center hidden border-2 border-white shadow-md">
                            <span className="text-white text-xl font-bold">
                              {passenger.passenger_name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="w-14 h-14 bg-orange-500 rounded-full flex items-center justify-center border-2 border-white shadow-md">
                          <span className="text-white text-xl font-bold">
                            {passenger.passenger_name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-gray-900 truncate">
                        {passenger.passenger_name}
                      </h3>
                      <p className="text-sm text-gray-500">Pendiente de valoración</p>
                    </div>
                    <div className="flex-shrink-0">
                      <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Show rated passengers section if any */}
          {ratedPassengers.length > 0 && (
            <div className="mt-8 pt-6 border-t border-gray-200">
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Ya valorados</h3>
              <div className="space-y-2">
                {ratedPassengers.map((passenger) => {
                  const avatarUrl = getAvatarUrl(passenger.passenger_avatar);
                  return (
                    <div
                      key={passenger.booking_id}
                      className="w-full flex items-center space-x-4 p-3 border border-gray-200 rounded-xl bg-gray-50 opacity-75"
                    >
                      <div className="relative w-12 h-12 flex-shrink-0">
                        {avatarUrl ? (
                          <>
                            <img
                              src={avatarUrl}
                              alt={passenger.passenger_name}
                              className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-md"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                const fallback = target.nextElementSibling as HTMLElement;
                                if (fallback) fallback.style.display = 'flex';
                              }}
                            />
                            <div className="w-12 h-12 bg-gray-400 rounded-full items-center justify-center hidden border-2 border-white shadow-md">
                              <span className="text-white text-lg font-bold">
                                {passenger.passenger_name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          </>
                        ) : (
                          <div className="w-12 h-12 bg-gray-400 rounded-full flex items-center justify-center border-2 border-white shadow-md">
                            <span className="text-white text-lg font-bold">
                              {passenger.passenger_name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-medium text-gray-700 truncate">
                          {passenger.passenger_name}
                        </h3>
                      </div>
                      <div className="flex-shrink-0">
                        <div className="flex items-center space-x-1 text-green-600">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <span className="text-sm font-medium">Valorado</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-8 py-4 flex-shrink-0 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}


