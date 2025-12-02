"use client";

import { useRouter } from "next/navigation";

interface BankAccountBannerProps {
  onDismiss?: () => void;
  onConfigure?: () => void;
}

export default function BankAccountBanner({ onDismiss, onConfigure }: BankAccountBannerProps) {
  const router = useRouter();

  const handleDismiss = () => {
    if (onDismiss) {
      onDismiss();
    }
  };

  const handleConfigureAccount = () => {
    if (onConfigure) {
      onConfigure();
    } else {
      router.push("/my-cards");
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-2xl">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex-shrink-0">
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
                <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-lg">Configura tu cuenta bancaria</h3>
              <p className="text-sm text-orange-100">
                Para recibir pagos como conductor, necesitas añadir tu IBAN. Recibirás el 85% de cada viaje completado.
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleConfigureAccount}
              className="bg-white text-orange-600 px-6 py-2 rounded-lg font-semibold hover:bg-orange-50 transition-colors shadow-md"
            >
              Configurar ahora
            </button>
            <button
              onClick={handleDismiss}
              className="text-white hover:text-orange-100 transition-colors p-2"
              aria-label="Cerrar"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

