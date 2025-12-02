"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import DesktopLayout from "@/components/DesktopLayout";
import { getToken, listPaymentMethods, deletePaymentMethod, PaymentMethod } from "@/lib/api";
import PaymentModal from "@/components/PaymentModal";
import ConfirmModal from "@/components/ConfirmModal";
import { useToast } from "@/hooks/useToast";

export default function MyCardsPage() {
  const router = useRouter();
  const { showToast, ToastComponent } = useToast();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddCardModal, setShowAddCardModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; cardId: string | null }>({
    isOpen: false,
    cardId: null,
  });

  useEffect(() => {
    const token = getToken();
    setIsLoggedIn(!!token);
    if (!token) {
      router.push("/login");
      return;
    }
    loadPaymentMethods();
  }, []);

  const loadPaymentMethods = async () => {
    try {
      setLoading(true);
      const cards = await listPaymentMethods();
      setPaymentMethods(cards);
    } catch (error: any) {
      console.error("Error loading payment methods:", error);
      showToast(error?.message || "Error al cargar las tarjetas");
    } finally {
      setLoading(false);
    }
  };

  const handleAddCard = () => {
    setShowAddCardModal(true);
  };

  const handleCardAdded = () => {
    setShowAddCardModal(false);
    loadPaymentMethods();
    showToast("✅ Tarjeta agregada correctamente");
  };

  const handleDeleteClick = (cardId: string) => {
    setDeleteModal({ isOpen: true, cardId });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteModal.cardId) return;

    try {
      await deletePaymentMethod(deleteModal.cardId);
      setDeleteModal({ isOpen: false, cardId: null });
      showToast("✅ Tarjeta eliminada correctamente");
      loadPaymentMethods();
    } catch (error: any) {
      console.error("Error deleting payment method:", error);
      showToast(error?.message || "Error al eliminar la tarjeta");
    }
  };

  const getCardBrandIcon = (brand: string) => {
    const brandLower = brand?.toLowerCase() || "";
    if (brandLower.includes("visa")) return "💳";
    if (brandLower.includes("mastercard")) return "💳";
    if (brandLower.includes("amex")) return "💳";
    return "💳";
  };

  const formatExpiry = (expMonth: number, expYear: number) => {
    return `${String(expMonth).padStart(2, '0')}/${String(expYear).slice(-2)}`;
  };

  const handleProfileClick = () => {
    router.push("/profile");
  };

  if (!isLoggedIn) {
    return null;
  }

  return (
    <DesktopLayout showSidebar={false}>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="px-8 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center shadow-md">
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"/>
                    <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1V8a1 1 0 00-1-1h-3z"/>
                  </svg>
                </div>
                <span className="text-2xl font-bold text-gray-800">UniGO</span>
              </div>

              <div className="flex items-center space-x-8">
                <Link href="/" className="flex items-center space-x-2 text-gray-600 hover:text-orange-600 transition-colors font-medium">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.707.707a1 1 0 001.414-1.414l-7-7z"/>
                  </svg>
                  <span>Inicio</span>
                </Link>
                <Link href="/my-rides" className="flex items-center space-x-2 text-gray-600 hover:text-orange-600 transition-colors font-medium">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd"/>
                  </svg>
                  <span>Mis Viajes</span>
                </Link>
                <Link href="/my-alerts" className="flex items-center space-x-2 text-gray-600 hover:text-orange-600 transition-colors font-medium">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"/>
                  </svg>
                  <span>Mis Alertas</span>
                </Link>
                <button className="flex items-center space-x-2 text-gray-700 hover:text-orange-600 transition-colors font-medium">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
                    <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
                  </svg>
                  <span>Mis Tarjetas</span>
                </button>
                <button
                  onClick={handleProfileClick}
                  className="flex items-center space-x-2 text-gray-600 hover:text-orange-600 transition-colors font-medium cursor-pointer"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/>
                  </svg>
                  <span>Perfil</span>
                </button>
                <Link href="/post-ride" className="bg-orange-500 text-white px-6 py-2 rounded-lg font-medium hover:bg-orange-600 transition-colors flex items-center space-x-2 shadow-md">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd"/>
                  </svg>
                  <span>Publicar Viaje</span>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-8 py-12">
          {/* Page Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-4xl font-bold text-gray-800">Mis Tarjetas</h1>
              <button
                onClick={handleAddCard}
                className="bg-green-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-600 transition-colors flex items-center space-x-2 shadow-md"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd"/>
                </svg>
                <span>Añadir Tarjeta</span>
              </button>
            </div>
            <p className="text-gray-600">
              Gestiona tus métodos de pago. Necesitas al menos una tarjeta para reservar viajes.
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-gray-500">Cargando tarjetas...</div>
            </div>
          ) : paymentMethods.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <div className="text-6xl mb-4">💳</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No tienes tarjetas guardadas</h3>
              <p className="text-gray-600 mb-6">
                Añade una tarjeta para poder reservar viajes y crear alertas automáticas.
              </p>
              <button
                onClick={handleAddCard}
                className="bg-green-500 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-600 transition-colors inline-flex items-center space-x-2"
              >
                <span>Añadir mi primera tarjeta</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {paymentMethods.map((card) => (
                <div
                  key={card.id}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="text-4xl">{getCardBrandIcon(card.card?.brand || "")}</div>
                    {card.is_default && (
                      <span className="bg-green-100 text-green-800 text-xs font-semibold px-2 py-1 rounded">
                        Predeterminada
                      </span>
                    )}
                  </div>
                  
                  <div className="mb-4">
                    <div className="text-2xl font-bold text-gray-900 mb-1">
                      •••• •••• •••• {card.card?.last4 || "****"}
                    </div>
                    <div className="text-sm text-gray-600">
                      {card.card?.brand ? card.card.brand.charAt(0).toUpperCase() + card.card.brand.slice(1) : "Tarjeta"}
                    </div>
                    {card.card?.exp_month && card.card?.exp_year && (
                      <div className="text-sm text-gray-500 mt-1">
                        Expira: {formatExpiry(card.card.exp_month, card.card.exp_year)}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => handleDeleteClick(card.id)}
                    className="w-full text-red-600 hover:text-red-700 text-sm font-medium py-2 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    Eliminar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Card Modal */}
      <PaymentModal
        isOpen={showAddCardModal}
        onClose={() => setShowAddCardModal(false)}
        onSuccess={handleCardAdded}
        onError={(error) => showToast(error)}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, cardId: null })}
        onConfirm={handleDeleteConfirm}
        title="Eliminar tarjeta"
        message="¿Estás seguro de que quieres eliminar esta tarjeta? No podrás usarla para futuras reservas."
        confirmText="Eliminar"
        cancelText="Cancelar"
        confirmButtonClass="bg-red-500 hover:bg-red-600"
      />

      {ToastComponent}
    </DesktopLayout>
  );
}

