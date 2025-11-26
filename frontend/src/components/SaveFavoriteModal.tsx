"use client";

import { useState } from "react";

interface SaveFavoriteModalProps {
  isOpen: boolean;
  onSave: (name: string) => void;
  onCancel: () => void;
}

export default function SaveFavoriteModal({
  isOpen,
  onSave,
  onCancel,
}: SaveFavoriteModalProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("El nombre es obligatorio");
      return;
    }
    if (name.trim().length > 100) {
      setError("El nombre no puede tener más de 100 caracteres");
      return;
    }
    setError("");
    onSave(name.trim());
    setName("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-md backdrop-saturate-200 pointer-events-none">
      <div 
        className="relative bg-white rounded-xl shadow-2xl max-w-md w-full border border-gray-200 transform transition-all pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-8">
          <h3 className="text-2xl font-semibold text-gray-900 mb-4">
            Guardar como favorito
          </h3>
          
          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nombre del viaje favorito
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError("");
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-lg"
                placeholder="Ej. Viaje a Universidad CEU"
                maxLength={100}
                autoFocus
              />
              {error && (
                <p className="text-red-500 text-sm mt-2">{error}</p>
              )}
            </div>
            
            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={() => {
                  setName("");
                  setError("");
                  onCancel();
                }}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-6 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors shadow-sm"
              >
                Guardar
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}



