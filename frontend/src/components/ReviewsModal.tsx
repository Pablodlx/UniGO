"use client";

import { useState, useEffect } from "react";
import { getUserReviews, ReviewDetail } from "@/lib/api";
import Image from "next/image";

function getAvatarUrl(avatarUrl: string | null | undefined): string | null {
  if (!avatarUrl) return null;
  if (avatarUrl.startsWith("http://") || avatarUrl.startsWith("https://")) {
    return avatarUrl;
  }
  if (avatarUrl.startsWith("/static/avatars/")) {
    return `${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"}${avatarUrl}`;
  }
  return `${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"}/static/avatars/${avatarUrl}`;
}

interface ReviewsModalProps {
  isOpen: boolean;
  userId: number;
  onClose: () => void;
}

export default function ReviewsModal({ isOpen, userId, onClose }: ReviewsModalProps) {
  const [reviews, setReviews] = useState<ReviewDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && userId) {
      fetchReviews();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, userId]);

  const fetchReviews = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getUserReviews(userId);
      setReviews(data);
    } catch (err: any) {
      console.error("Error fetching reviews:", err);
      setError("No se pudieron cargar las valoraciones");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-md backdrop-saturate-200"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-gray-200 transform transition-all max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-green-50 to-green-100 border-b border-green-200 rounded-t-xl px-8 py-6 flex-shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">
              ⭐ Valoraciones
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-3xl font-light transition-colors"
              aria-label="Cerrar"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-gray-500">Cargando valoraciones...</div>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          ) : reviews.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">No hay valoraciones aún</p>
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((review, index) => {
                const avatarUrl = getAvatarUrl(review.reviewer_avatar_url);
                return (
                  <div
                    key={index}
                    className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start space-x-4">
                      {/* Avatar */}
                      <div className="flex-shrink-0">
                        {avatarUrl ? (
                          <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-gray-200">
                            <Image
                              src={avatarUrl}
                              alt={review.reviewer_name}
                              width={48}
                              height={48}
                              className="w-12 h-12 rounded-full object-cover"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                const fallback = target.nextElementSibling as HTMLElement;
                                if (fallback) fallback.style.display = 'flex';
                              }}
                            />
                            <div className="w-12 h-12 bg-green-500 rounded-full items-center justify-center hidden">
                              <span className="text-white text-lg font-bold">
                                {review.reviewer_name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center border-2 border-gray-200">
                            <span className="text-white text-lg font-bold">
                              {review.reviewer_name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        {/* Header: Name and Date */}
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="text-base font-semibold text-gray-900">
                              {review.reviewer_name}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {new Date(review.created_at).toLocaleDateString("es-ES", {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                              })}
                            </p>
                          </div>
                        </div>

                        {/* Stars */}
                        <div className="flex items-center space-x-1 mb-3">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <svg
                              key={star}
                              className={`w-5 h-5 ${
                                star <= review.rating
                                  ? "text-yellow-400 fill-current"
                                  : "text-gray-300"
                              }`}
                              fill={star <= review.rating ? "currentColor" : "none"}
                              stroke={star <= review.rating ? "currentColor" : "currentColor"}
                              strokeWidth={star <= review.rating ? 0 : 1.5}
                              viewBox="0 0 20 20"
                            >
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          ))}
                        </div>

                        {/* Comment */}
                        {review.comment && (
                          <p className="text-gray-700 text-sm leading-relaxed mt-2">
                            {review.comment}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-8 py-4 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full px-6 py-3 bg-green-500 text-white rounded-xl font-medium hover:bg-green-600 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

