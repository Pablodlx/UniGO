"use client";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmButtonColor?: "red" | "orange" | "blue";
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = "Aceptar",
  cancelText = "Cancelar",
  onConfirm,
  onCancel,
  confirmButtonColor = "red",
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const buttonColors = {
    red: "bg-red-500 hover:bg-red-600",
    orange: "bg-orange-500 hover:bg-orange-600",
    blue: "bg-blue-500 hover:bg-blue-600",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
      {/* Elegant modal window */}
      <div 
        className="relative bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-gray-200 transform transition-all pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-10">
          {/* Title */}
          <h3 className="text-3xl font-semibold text-gray-900 mb-5">{title}</h3>
          
          {/* Message */}
          <p className="text-xl text-gray-600 mb-10 leading-relaxed">{message}</p>
          
          {/* Buttons */}
          <div className="flex justify-end space-x-5">
            <button
              onClick={onCancel}
              className="px-10 py-4 text-lg border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              className={`px-10 py-4 text-lg ${buttonColors[confirmButtonColor]} text-white rounded-lg font-medium transition-colors shadow-sm`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

