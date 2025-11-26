"use client";

import { useRouter } from "next/navigation";

interface ProfileRequiredModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProfileRequiredModal({ isOpen, onClose }: ProfileRequiredModalProps) {
  const router = useRouter();

  if (!isOpen) return null;

  const handleGoToProfile = () => {
    onClose();
    router.push("/profile/edit");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-md backdrop-saturate-200" onClick={onClose}>
      <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full border border-gray-200 transform transition-all" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-50 to-orange-100 border-b border-orange-200 rounded-t-xl px-8 py-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">Completa tu perfil</h2>
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
        <div className="p-8">
          <p className="text-gray-600 text-center mb-8">
            Para poder reservar un viaje debes completar los datos obligatorios de tu perfil.
          </p>

          {/* Buttons */}
          <div className="flex flex-col space-y-3">
            <button
              onClick={handleGoToProfile}
              className="w-full bg-green-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-green-700 transition-colors shadow-lg"
            >
              Ir a mi perfil
            </button>

            <button
              onClick={onClose}
              className="w-full bg-gray-100 text-gray-700 px-6 py-3 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

