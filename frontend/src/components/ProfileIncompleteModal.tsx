"use client";

interface ProfileIncompleteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProfileIncompleteModal({ isOpen, onClose }: ProfileIncompleteModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-md backdrop-saturate-200" onClick={onClose}>
      <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full border border-gray-200 transform transition-all" onClick={(e) => e.stopPropagation()}>
        <div className="p-8">
          <div className="flex items-center justify-center mb-6">
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          </div>
          
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-4">
            👤 Completa tu perfil
          </h2>
          
          <p className="text-gray-600 text-center">
            Para continuar debes llenar todos los campos obligatorios de tu perfil.
          </p>
        </div>
      </div>
    </div>
  );
}

