"use client";

import { Ride } from "@/lib/api";

interface RideDetailProps {
  ride: Ride;
  onBack: () => void;
  onContact: () => void;
  bookingSuccess?: boolean;
  onReturnHome?: () => void;
}

export default function RideDetail({ ride, onBack, onContact, bookingSuccess = false, onReturnHome }: RideDetailProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    return `${days[date.getDay()]}, ${date.getDate()} de ${months[date.getMonth()]}`;
  };

  const formatTime = (timeString: string) => {
    return timeString;
  };

  // Show success message if booking was successful
  if (bookingSuccess && onReturnHome) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="px-8 py-6">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center shadow-md">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"/>
                  <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1V8a1 1 0 00-1-1h-3z"/>
                </svg>
              </div>
              <span className="text-2xl font-bold text-gray-800">UniGO</span>
            </div>
          </div>
        </div>

        {/* Success Message */}
        <div className="max-w-2xl mx-auto px-8 py-16">
          <div className="bg-white rounded-2xl shadow-xl border border-green-200 p-12 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-12 h-12 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-4">¡Viaje reservado correctamente!</h1>
            <p className="text-gray-600 text-lg mb-8">
              Tu reserva ha sido confirmada. El conductor se pondrá en contacto contigo pronto.
            </p>
            <button
              onClick={onReturnHome}
              className="bg-orange-500 text-white px-8 py-4 rounded-xl font-semibold hover:bg-orange-600 transition-colors flex items-center justify-center space-x-2 shadow-lg mx-auto"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.707.707a1 1 0 001.414-1.414l-7-7z"/>
              </svg>
              <span>Volver al inicio</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {/* Back Button on Left */}
              <button
                onClick={onBack}
                className="mr-4 p-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Back to results"
              >
                <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center shadow-md">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"/>
                  <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1V8a1 1 0 00-1-1h-3z"/>
                </svg>
              </div>
              <span className="text-2xl font-bold text-gray-800">UniGO</span>
            </div>

            <div className="flex items-center space-x-4">
              {/* Profile and other buttons if needed */}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-8 py-12">
        {/* Date Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800">{formatDate(ride.departure_date)}</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Panel - Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Ride Itinerary Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
              <div className="space-y-6">
                {/* Departure */}
                <div className="flex items-start space-x-4">
                  <div className="text-2xl font-bold text-gray-800">
                    {formatTime(ride.departure_time)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 text-gray-900 font-semibold mb-1">
                      <svg className="w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/>
                      </svg>
                      <span>{ride.departure_city}</span>
                    </div>
                    <div className="text-sm text-gray-600">
                      {ride.vehicle_info || 'Sin detalles adicionales de ubicación'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Driver Details Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
              <div className="space-y-6">
                {/* Driver Profile */}
                <div className="flex items-start space-x-4">
                  <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg className="w-8 h-8 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/>
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">{ride.driver_name}</h3>
                    {ride.driver_university && (
                      <p className="text-gray-600 mb-3">{ride.driver_university}</p>
                    )}
                  </div>
                </div>

                {/* Driver Message */}
                {ride.additional_details && (
                  <div className="pt-4 border-t border-gray-200">
                    <p className="text-gray-700 italic">&quot;{ride.additional_details}&quot;</p>
                  </div>
                )}

                {/* Booking Confirmation */}
                <div className="pt-4 border-t border-gray-200">
                  <div className="flex items-center space-x-2 text-gray-700">
                    <svg className="w-5 h-5 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd"/>
                    </svg>
                    <span className="font-medium">Tu reserva se confirmará en el acto</span>
                  </div>
                </div>

                {/* Contact Button */}
                <div className="pt-4">
                  <button
                    onClick={onContact}
                    className="w-full bg-orange-500 text-white px-6 py-4 rounded-xl font-semibold hover:bg-orange-600 transition-colors flex items-center justify-center space-x-2 shadow-md"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/>
                      <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/>
                    </svg>
                    <span>Reservar</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel - Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sticky top-8">
              {/* Summary */}
              <div className="space-y-6">
                <div className="pb-4 border-b border-gray-200">
                  <h3 className="text-xl font-bold text-gray-800">{formatDate(ride.departure_date)}</h3>
                </div>

                {/* Departure Summary */}
                <div>
                  <div className="text-lg font-semibold text-gray-900">{formatTime(ride.departure_time)} {ride.departure_city}</div>
                  <div className="text-sm text-gray-600">{ride.vehicle_info || 'Ubicación de salida'}</div>
                </div>

                {/* Driver Summary */}
                <div className="pt-4 border-t border-gray-200">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"/>
                      </svg>
                    </div>
                    <div className="flex-1">
                      <div className="text-gray-900 font-medium">{ride.driver_name}</div>
                      {ride.driver_university && (
                        <div className="text-sm text-gray-500">{ride.driver_university}</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Price and Passengers */}
                <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700 font-medium">1 pasajero</span>
                    <span className="text-2xl font-bold text-orange-600">{ride.price_per_seat.toFixed(2)} €</span>
                  </div>
                </div>

                {/* Reserve Button */}
                <button
                  onClick={onContact}
                  className="w-full bg-orange-500 text-white px-6 py-4 rounded-xl font-semibold hover:bg-orange-600 transition-colors flex items-center justify-center space-x-2 shadow-lg"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd"/>
                  </svg>
                  <span>Reservar</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

