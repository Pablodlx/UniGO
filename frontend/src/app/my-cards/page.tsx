"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import DesktopLayout from "@/components/DesktopLayout";
import { getToken, listPaymentMethods, deletePaymentMethod, PaymentMethod } from "@/lib/api";
import PaymentModal from "@/components/PaymentModal";
import ConfirmModal from "@/components/ConfirmModal";
import BankAccountForm from "@/components/BankAccountForm";
import { useToast } from "@/hooks/useToast";

const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000/api";

interface BankAccountInfo {
  has_bank_account: boolean;
  last4?: string;
  bank_name?: string;
  country?: string;
  stripe_account_id?: string;
}

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
  const [bankAccount, setBankAccount] = useState<BankAccountInfo | null>(null);
  const [showBankAccountModal, setShowBankAccountModal] = useState(false);
  const [deleteBankModal, setDeleteBankModal] = useState(false);

  useEffect(() => {
    const token = getToken();
    setIsLoggedIn(!!token);
    if (!token) {
      router.push("/login");
      return;
    }
    loadPaymentMethods();
    loadBankAccountInfo();
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

  const loadBankAccountInfo = async () => {
    try {
      const token = getToken();
      const response = await fetch(`${BASE}/bank-account/info`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setBankAccount(data);
      }
    } catch (error) {
      console.error("Error loading bank account:", error);
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

  const handleAddBankAccount = () => {
    setShowBankAccountModal(true);
  };

  const handleBankAccountAdded = () => {
    setShowBankAccountModal(false);
    loadBankAccountInfo();
    showToast("✅ Cuenta bancaria configurada correctamente");
  };

  const handleDeleteBankAccount = async () => {
    try {
      const token = getToken();
      await fetch(`${BASE}/bank-account`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      setDeleteBankModal(false);
      showToast("✅ Cuenta bancaria eliminada");
      loadBankAccountInfo();
    } catch (error: any) {
      showToast(error?.message || "Error al eliminar la cuenta bancaria");
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

          {/* Bank Account Section */}
          <div className="mt-12">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">Cuenta Bancaria (IBAN)</h2>
              {!bankAccount?.has_bank_account && (
                <button
                  onClick={handleAddBankAccount}
                  className="bg-green-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-green-600 transition-colors"
                >
                  + Añadir IBAN
                </button>
              )}
            </div>

            {loading ? (
              <div className="text-center py-8 text-gray-500">Cargando...</div>
            ) : bankAccount?.has_bank_account ? (
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                      <span className="text-3xl">🏦</span>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800 text-lg">Cuenta Bancaria</p>
                      <p className="text-gray-600">
                        **** **** **** {bankAccount.last4}
                      </p>
                      {bankAccount.bank_name && (
                        <p className="text-sm text-gray-500">{bankAccount.bank_name}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex space-x-3">
                    <button
                      onClick={handleAddBankAccount}
                      className="text-blue-600 hover:text-blue-700 font-medium px-4 py-2 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => setDeleteBankModal(true)}
                      className="text-red-600 hover:text-red-700 font-medium px-4 py-2 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
                <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    💰 Recibirás el 85% del precio de cada viaje completado en esta cuenta.
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-xl p-12 text-center border-2 border-dashed border-gray-300">
                <div className="text-6xl mb-4">🏦</div>
                <p className="text-gray-600 text-lg mb-6">
                  Añade tu IBAN para recibir pagos de los viajes que publiques
                </p>
                <button
                  onClick={handleAddBankAccount}
                  className="bg-green-500 text-white px-8 py-3 rounded-xl font-semibold hover:bg-green-600 transition-colors"
                >
                  Añadir IBAN
                </button>
              </div>
            )}
          </div>
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

      {/* Bank Account Modal */}
      {showBankAccountModal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-md backdrop-saturate-200 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-8 shadow-2xl">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">
              {bankAccount?.has_bank_account ? "Editar" : "Añadir"} Cuenta Bancaria
            </h2>
            <BankAccountForm
              onSuccess={handleBankAccountAdded}
              onCancel={() => setShowBankAccountModal(false)}
            />
          </div>
        </div>
      )}

      {/* Delete Bank Account Confirmation Modal */}
      {deleteBankModal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-md backdrop-saturate-200 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-gray-800 mb-4">
              ¿Eliminar cuenta bancaria?
            </h3>
            <p className="text-gray-600 mb-6">
              Esta acción eliminará tu IBAN y no podrás recibir pagos hasta que añadas uno nuevo.
            </p>
            <div className="flex space-x-4">
              <button
                onClick={() => setDeleteBankModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteBankAccount}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {ToastComponent}
    </DesktopLayout>
  );
}

