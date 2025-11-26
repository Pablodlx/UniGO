"use client";

import { FavoriteRide } from "@/lib/api";

interface FavoritesListModalProps {
  isOpen: boolean;
  favorites: FavoriteRide[];
  onSelect: (favorite: FavoriteRide) => void;
  onCancel: () => void;
  onDelete?: (favoriteId: number) => void;
}

export default function FavoritesListModal({
  isOpen,
  favorites,
  onSelect,
  onCancel,
  onDelete,
}: FavoritesListModalProps) {
  if (!isOpen) return null;

  const handleDelete = (e: React.MouseEvent, favoriteId: number) => {
    e.stopPropagation();
    if (onDelete && confirm("¿Estás seguro de que quieres eliminar este favorito?")) {
      onDelete(favoriteId);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-md backdrop-saturate-200 pointer-events-none">
      <div 
        className="relative bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-gray-200 transform transition-all pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-semibold text-gray-900">
              Viajes favoritos
            </h3>
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-600 text-3xl font-light transition-colors"
            >
              ×
            </button>
          </div>
          
          {favorites.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              <p className="text-gray-600 text-lg">No tienes viajes favoritos guardados</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {favorites.map((favorite) => (
                <div
                  key={favorite.id}
                  onClick={() => onSelect(favorite)}
                  className="p-4 border border-gray-200 rounded-lg hover:border-orange-500 hover:bg-orange-50 cursor-pointer transition-colors relative group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="text-lg font-semibold text-gray-900 mb-2">
                        {favorite.name}
                      </h4>
                      <div className="text-sm text-gray-600 space-y-1">
                        <div className="flex items-center space-x-2">
                          <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/>
                          </svg>
                          <span>{favorite.departure_city}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/>
                          </svg>
                          <span>{favorite.destination_city}</span>
                        </div>
                        {favorite.vehicle_brand || favorite.vehicle_color ? (
                          <div className="flex items-center space-x-2">
                            <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                              <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1V8a1 1 0 00-1-1h-3z" />
                            </svg>
                            <span>{[favorite.vehicle_brand, favorite.vehicle_color].filter(Boolean).join(' ')}</span>
                          </div>
                        ) : null}
                      </div>
                    </div>
                    {onDelete && (
                      <button
                        onClick={(e) => handleDelete(e, favorite.id)}
                        className="ml-4 p-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Eliminar favorito"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          
          <div className="mt-6 flex justify-end">
            <button
              onClick={onCancel}
              className="px-6 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors shadow-sm"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

