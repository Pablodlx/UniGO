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

interface RatingModalProps {
  isOpen: boolean;
  ratedUserName: string;
  ratedUserAvatar?: string | null;
  ratedUserRole: "conductor" | "pasajero";
  onClose: () => void;
  onSubmit: (score: number, comment?: string) => Promise<void>;
}

export default function RatingModal({
  isOpen,
  ratedUserName,
  ratedUserAvatar,
  ratedUserRole,
  onClose,
  onSubmit,
}: RatingModalProps) {
  const [selectedRating, setSelectedRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (selectedRating === 0) {
      setError("Por favor, selecciona una valoración");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      await onSubmit(selectedRating, comment.trim() || undefined);
      // Reset form
      setSelectedRating(0);
      setHoveredRating(0);
      setComment("");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al enviar la valoración");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setSelectedRating(0);
      setHoveredRating(0);
      setComment("");
      setError("");
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-md backdrop-saturate-200"
      onClick={handleClose}
    >
      <div
        className="relative bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-gray-200 transform transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with user info */}
        <div className="bg-gradient-to-r from-orange-50 to-orange-100 border-b border-orange-200 rounded-t-xl px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="relative w-16 h-16 flex-shrink-0">
                {(() => {
                  const avatarUrl = getAvatarUrl(ratedUserAvatar);
                  return avatarUrl ? (
                    <>
                      <img
                        src={avatarUrl}
                        alt={ratedUserName}
                        className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-md"
                        onError={(e) => {
                          // Hide image on error
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          // Show fallback
                          const fallback = target.nextElementSibling as HTMLElement;
                          if (fallback) fallback.style.display = 'flex';
                        }}
                      />
                      <div className="w-16 h-16 bg-orange-500 rounded-full items-center justify-center hidden border-2 border-white shadow-md">
                        <span className="text-white text-2xl font-bold">
                          {ratedUserName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="w-16 h-16 bg-orange-500 rounded-full flex items-center justify-center border-2 border-white shadow-md">
                      <span className="text-white text-2xl font-bold">
                        {ratedUserName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  );
                })()}
              </div>
              <div>
                <p className="text-sm font-medium text-orange-700 mb-1">Valorando a:</p>
                <h3 className="text-2xl font-bold text-gray-900">{ratedUserName}</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {ratedUserRole === "conductor" ? "Conductor" : "Pasajero"}
                </p>
              </div>
            </div>
            {/* Close button */}
            <button
              onClick={handleClose}
              disabled={isSubmitting}
              className="text-gray-400 hover:text-gray-600 text-3xl font-light disabled:opacity-50 transition-colors"
              aria-label="Cerrar"
            >
              ×
            </button>
          </div>
        </div>

        <div className="p-8">

          {/* Star Rating */}
          <div className="mb-6">
            <div className="flex items-center space-x-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setSelectedRating(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  disabled={isSubmitting}
                  className="focus:outline-none disabled:opacity-50"
                >
                  <svg
                    className={`w-10 h-10 transition-colors ${
                      star <= (hoveredRating || selectedRating)
                        ? "text-yellow-400 fill-current"
                        : "text-gray-300"
                    }`}
                    fill={star <= (hoveredRating || selectedRating) ? "currentColor" : "none"}
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                    />
                  </svg>
                </button>
              ))}
            </div>
          </div>

          {/* Comment Text Area */}
          <div className="mb-6">
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Comparte detalles de tu experiencia en este viaje"
              disabled={isSubmitting}
              rows={6}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end space-x-4">
            <button
              onClick={handleClose}
              disabled={isSubmitting}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || selectedRating === 0}
              className="px-6 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Enviando..." : "Publicar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
