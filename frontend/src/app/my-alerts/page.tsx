"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import DesktopLayout from "@/components/DesktopLayout";
import { getToken, getMySearchAlerts, deleteSearchAlert, SearchAlert, updateSearchAlert, getProfile } from "@/lib/api";
import AutoSearchModal from "@/components/AutoSearchModal";
import ConfirmModal from "@/components/ConfirmModal";
import ProfileIncompleteModal from "@/components/ProfileIncompleteModal";
import CardSelectorModal from "@/components/CardSelectorModal";
import { useToast } from "@/hooks/useToast";
import AddressAutocomplete, { AddressValue } from "@/components/AddressAutocomplete";
import { isProfileComplete } from "@/utils/isProfileComplete";
import { listPaymentMethods } from "@/lib/api";

export default function MyAlertsPage() {
  const router = useRouter();
  const { showToast, ToastComponent } = useToast();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [alerts, setAlerts] = useState<SearchAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingAlert, setEditingAlert] = useState<SearchAlert | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; alertId: number | null }>({
    isOpen: false,
    alertId: null,
  });
  const [userUniversity, setUserUniversity] = useState<string | null>(null);
  const [userHomeAddress, setUserHomeAddress] = useState<AddressValue | null>(null);
  const [userProfile, setUserProfile] = useState<{
    full_name?: string | null;
    university?: string | null;
    degree?: string | null;
    course?: number | null;
    home_address?: {
      formatted_address: string;
      place_id: string;
      lat: number;
      lng: number;
    } | null;
  } | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showCardSelector, setShowCardSelector] = useState(false);
  const [pendingAlertAction, setPendingAlertAction] = useState<(() => void) | null>(null);

  useEffect(() => {
    const token = getToken();
    setIsLoggedIn(!!token);
    if (!token) {
      router.push("/login");
      return;
    }

    fetchUserProfile();
    fetchAlerts();
  }, [router]);

  const fetchUserProfile = async () => {
    try {
      const profile = await getProfile();
      setUserProfile({
        full_name: profile.full_name,
        university: profile.university,
        degree: profile.degree,
        course: profile.course,
        home_address: profile.home_address || undefined,
      });
      if (profile?.university) {
        setUserUniversity(profile.university);
      }
      if (profile?.home_address) {
        const addressValue: AddressValue = {
          formattedAddress: profile.home_address.formatted_address,
          placeId: profile.home_address.place_id,
          lat: profile.home_address.lat,
          lng: profile.home_address.lng,
        };
        setUserHomeAddress(addressValue);
      }
    } catch (error) {
      console.error("Error fetching user profile:", error);
    }
  };

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const data = await getMySearchAlerts();
      setAlerts(data);
    } catch (error) {
      console.error("Error fetching alerts:", error);
      showToast("Error al cargar las alertas", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (alert: SearchAlert) => {
    if (!isProfileComplete(userProfile)) {
      setShowProfileModal(true);
      return;
    }
    setEditingAlert(alert);
    setEditModalOpen(true);
  };

  const handleDelete = (alertId: number) => {
    setDeleteModal({ isOpen: true, alertId });
  };

  const confirmDelete = async () => {
    if (!deleteModal.alertId) return;

    try {
      await deleteSearchAlert(deleteModal.alertId);
      showToast("Alerta eliminada correctamente", "success");
      setDeleteModal({ isOpen: false, alertId: null });
      fetchAlerts();
    } catch (error: any) {
      console.error("Error deleting alert:", error);
      showToast(error?.message || "Error al eliminar la alerta", "error");
    }
  };

  const handleUpdateSuccess = () => {
    showToast("Alerta actualizada correctamente", "success");
    setEditModalOpen(false);
    setEditingAlert(null);
    fetchAlerts();
  };

  const formatDates = (dates: string[] | null | undefined): string => {
    if (!dates || dates.length === 0) return "N/A";
    return dates
      .map((d) => {
        const date = new Date(d);
        return date.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
      })
      .join(", ");
  };

  const formatTime = (time: string): string => {
    return time;
  };

  const handleProfileClick = () => {
    if (isLoggedIn) {
      router.push("/profile");
    } else {
      router.push("/login");
    }
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
                <button className="flex items-center space-x-2 text-gray-700 hover:text-orange-600 transition-colors font-medium">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"/>
                  </svg>
                  <span>Mis Alertas</span>
                </button>
                <Link href="/my-cards" className="flex items-center space-x-2 text-gray-600 hover:text-orange-600 transition-colors font-medium">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
                    <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
                  </svg>
                  <span>Mis Tarjetas</span>
                </Link>
                <Link href="/preguntas" className="flex items-center space-x-2 text-gray-600 hover:text-orange-600 transition-colors font-medium">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/>
                  </svg>
                  <span>Preguntas</span>
                </Link>
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
              <h1 className="text-4xl font-bold text-gray-800">Mis Alertas</h1>
              <button
                onClick={async () => {
                  if (!isProfileComplete(userProfile)) {
                    setShowProfileModal(true);
                    return;
                  }
                  
                  // Validate payment methods before creating alert
                  try {
                    const cards = await listPaymentMethods();
                    if (cards.length === 0) {
                      showToast("Necesitas un método de pago antes de crear una alerta. Añade una tarjeta en 'Mis Tarjetas'.", "error");
                      router.push("/my-cards");
                      return;
                    }
                    
                    setEditingAlert(null);
                    setEditModalOpen(true);
                  } catch (error: any) {
                    console.error("Error checking payment methods:", error);
                    showToast("Error al verificar métodos de pago. Por favor, intenta de nuevo.", "error");
                  }
                }}
                className="bg-orange-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-orange-600 transition-colors flex items-center space-x-2 shadow-md"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd"/>
                </svg>
                <span>Nueva Alerta</span>
              </button>
            </div>
          </div>

          {/* Content */}
          {loading ? (
            <div className="text-center py-12">
              <p className="text-gray-600">Cargando alertas...</p>
            </div>
          ) : alerts.length === 0 ? (
            <div className="bg-white rounded-xl shadow-md p-12 text-center">
              <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">No tienes alertas activas</h3>
              <p className="text-gray-600 mb-6">Crea una alerta para recibir notificaciones automáticas cuando haya viajes que coincidan con tu búsqueda</p>
                <button
                  onClick={() => {
                    if (!isProfileComplete(userProfile)) {
                      setShowProfileModal(true);
                      return;
                    }
                    setEditingAlert(null);
                    setEditModalOpen(true);
                  }}
                  className="bg-orange-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-orange-600 transition-colors"
                >
                  Crear Primera Alerta
                </button>
            </div>
          ) : (
            <div className="space-y-4">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`bg-white rounded-xl shadow-md p-6 border-2 ${
                    alert.active ? "border-green-200" : "border-gray-200"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="text-xl font-bold text-gray-900">
                          {alert.origin} → {alert.destination}
                        </h3>
                        {alert.active ? (
                          <span className="bg-green-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
                            Activa
                          </span>
                        ) : (
                          <span className="bg-gray-400 text-white px-3 py-1 rounded-full text-sm font-semibold">
                            Inactiva
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
                        <div>
                          <span className="font-semibold">Hora objetivo:</span> {formatTime(alert.target_time)}
                        </div>
                        <div>
                          <span className="font-semibold">Flexibilidad:</span> ±{alert.flexibility_minutes} min
                        </div>
                        <div>
                          <span className="font-semibold">Fechas:</span> {formatDates(alert.specific_dates)}
                        </div>
                        <div>
                          <span className="font-semibold">Creada:</span>{" "}
                          {new Date(alert.created_at).toLocaleDateString("es-ES", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleEdit(alert)}
                        className="bg-blue-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-600 transition-colors"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(alert.id)}
                        className="bg-red-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-600 transition-colors"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {ToastComponent}

      {/* Edit/Create Modal */}
      {editModalOpen && (
        <EditAlertModal
          isOpen={editModalOpen}
          onClose={() => {
            setEditModalOpen(false);
            setEditingAlert(null);
          }}
          onSuccess={handleUpdateSuccess}
          onError={(message) => showToast(message, "error")}
          alert={editingAlert}
          userUniversity={userUniversity}
          userHomeAddress={userHomeAddress}
        />
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModal.isOpen}
        title="Eliminar Alerta"
        message="¿Estás seguro de que quieres eliminar esta alerta? Esta acción no se puede deshacer."
        confirmText="Eliminar"
        cancelText="Cancelar"
        confirmButtonColor="red"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteModal({ isOpen: false, alertId: null })}
      />

      {/* Profile Incomplete Modal */}
      <ProfileIncompleteModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
      />
    </DesktopLayout>
  );
}

// Edit Alert Modal Component
interface EditAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onError?: (message: string) => void;
  alert: SearchAlert | null;
  userUniversity?: string | null;
  userHomeAddress?: AddressValue | null;
}

function EditAlertModal({
  isOpen,
  onClose,
  onSuccess,
  onError,
  alert,
  userUniversity,
  userHomeAddress,
}: EditAlertModalProps) {
  const [origin, setOrigin] = useState<AddressValue | null>(null);
  const [destination, setDestination] = useState<AddressValue | null>(null);
  const [targetTime, setTargetTime] = useState<string>("09:00");
  const [specificDates, setSpecificDates] = useState<string[]>([]);
  const [newDate, setNewDate] = useState<string>("");
  const [flexibilityMinutes, setFlexibilityMinutes] = useState<number>(30);
  const [allowNearbySearch, setAllowNearbySearch] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{
    origin?: string;
    destination?: string;
    dates?: string;
  }>({});

  useEffect(() => {
    if (alert && isOpen) {
      // Parse origin
      if (alert.origin) {
        // Try to create AddressValue from origin string
        // For now, we'll just set it as formatted address
        setOrigin({
          formattedAddress: alert.origin,
          placeId: "",
          lat: 0,
          lng: 0,
        });
      }
      // Parse destination
      if (alert.destination) {
        setDestination({
          formattedAddress: alert.destination,
          placeId: "",
          lat: 0,
          lng: 0,
        });
      }
      setTargetTime(alert.target_time);
      setSpecificDates(alert.specific_dates || []);
      setFlexibilityMinutes(alert.flexibility_minutes);
      setAllowNearbySearch(alert.allow_nearby_search || false);
    } else if (!alert && isOpen) {
      // Reset for new alert
      setOrigin(null);
      setDestination(null);
      setTargetTime("09:00");
      setSpecificDates([]);
      setNewDate("");
      setFlexibilityMinutes(30);
      setAllowNearbySearch(false);
      setErrors({});
    }
  }, [alert, isOpen]);

  const addDate = () => {
    if (!newDate) return;

    const selectedDate = new Date(newDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (selectedDate < today) {
      setErrors((prev) => ({ ...prev, dates: "No puedes seleccionar fechas pasadas" }));
      return;
    }

    if (specificDates.includes(newDate)) {
      setErrors((prev) => ({ ...prev, dates: "Esta fecha ya está seleccionada" }));
      return;
    }

    setSpecificDates((prev) => [...prev, newDate].sort());
    setNewDate("");
    if (errors.dates) {
      setErrors((prev) => ({ ...prev, dates: undefined }));
    }
  };

  const removeDate = (dateToRemove: string) => {
    setSpecificDates((prev) => prev.filter((d) => d !== dateToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setErrors({});

    if (!origin) {
      setErrors((prev) => ({ ...prev, origin: "El origen es obligatorio" }));
      return;
    }

    if (!destination) {
      setErrors((prev) => ({ ...prev, destination: "El destino es obligatorio" }));
      return;
    }

    if (specificDates.length === 0) {
      setErrors((prev) => ({
        ...prev,
        dates: "Selecciona al menos una fecha específica",
      }));
      return;
    }

    setIsSubmitting(true);

    try {
      const { createSearchAlert, updateSearchAlert } = await import("@/lib/api");

      if (alert) {
        // Update existing alert
        // For updates, we only send the fields that changed
        // Coordinates are optional in updates
        const updateData: any = {
          origin: origin.formattedAddress,
          destination: destination.formattedAddress,
          target_time: targetTime,
          specific_dates: specificDates,
          flexibility_minutes: flexibilityMinutes,
          allow_nearby_search: allowNearbySearch,
        };
        
        // Include coordinates if available (user may have changed the address)
        if (origin.lat !== 0 && origin.lng !== 0) {
          updateData.origin_lat = origin.lat;
          updateData.origin_lng = origin.lng;
        }
        if (destination.lat !== 0 && destination.lng !== 0) {
          updateData.destination_lat = destination.lat;
          updateData.destination_lng = destination.lng;
        }
        
        await updateSearchAlert(alert.id, updateData);
      } else {
        // Create new alert - coordinates are required
        if (origin.lat === 0 || origin.lng === 0 || destination.lat === 0 || destination.lng === 0) {
          if (onError) {
            onError("Por favor, selecciona direcciones válidas con autocompletado");
          }
          setIsSubmitting(false);
          return;
        }
        
        await createSearchAlert({
          origin: origin.formattedAddress,
          origin_lat: origin.lat,
          origin_lng: origin.lng,
          destination: destination.formattedAddress,
          destination_lat: destination.lat,
          destination_lng: destination.lng,
          target_time: targetTime,
          specific_dates: specificDates,
          flexibility_minutes: flexibilityMinutes,
          allow_nearby_search: allowNearbySearch,
        });
      }

      onSuccess();
    } catch (error: any) {
      console.error("Error saving alert:", error);
      const errorMessage = error?.message || "Error al guardar la alerta. Por favor, intenta de nuevo.";
      if (onError) {
        onError(errorMessage);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setOrigin(null);
    setDestination(null);
    setTargetTime("09:00");
    setSpecificDates([]);
    setNewDate("");
    setFlexibilityMinutes(30);
    setErrors({});
    onClose();
  };

  if (!isOpen) return null;

  const FLEXIBILITY_OPTIONS = [
    { value: 5, label: "±5 min" },
    { value: 10, label: "±10 min" },
    { value: 15, label: "±15 min" },
    { value: 30, label: "±30 min" },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-md backdrop-saturate-200"
      onClick={handleClose}
    >
      <div
        className="relative bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-gray-200 transform transition-all max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-green-50 to-green-100 border-b border-green-200 rounded-t-xl px-8 py-6 flex-shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">
              {alert ? "✏️ Editar Alerta" : "✨ Nueva Búsqueda Automática"}
            </h2>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 text-3xl font-light transition-colors"
              aria-label="Cerrar"
            >
              ×
            </button>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            {alert
              ? "Modifica los datos de tu alerta de búsqueda automática"
              : "Guardaremos estos datos y buscaremos por ti viajes nuevos y existentes que encajen con tu origen, destino y horario. Cuando haya uno compatible, crearemos una reserva pendiente de confirmar por el conductor y te avisaremos. Si te rechazan, la búsqueda seguirá activa y continuará buscando."}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Origen deseado</label>
              <AddressAutocomplete
                id="edit-alert-origin"
                placeholder="Ej. Calle Gran Vía, 1"
                initialValue={origin}
                onChange={(value) => {
                  setOrigin(value);
                  if (errors.origin) {
                    setErrors((prev) => ({ ...prev, origin: undefined }));
                  }
                }}
                required={true}
                error={errors.origin}
                showVerifiedBadge={false}
                className="w-full"
                university={userUniversity}
                homeAddress={userHomeAddress}
                fieldType="departure"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Destino deseado</label>
              <AddressAutocomplete
                id="edit-alert-destination"
                placeholder="Ej. Universidad CEU"
                initialValue={destination}
                onChange={(value) => {
                  setDestination(value);
                  if (errors.destination) {
                    setErrors((prev) => ({ ...prev, destination: undefined }));
                  }
                }}
                required={true}
                error={errors.destination}
                showVerifiedBadge={false}
                className="w-full"
                university={userUniversity}
                homeAddress={userHomeAddress}
                fieldType="destination"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Hora objetivo</label>
              <input
                type="time"
                value={targetTime}
                onChange={(e) => setTargetTime(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 text-lg"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Fechas específicas</label>
              <div className="flex gap-2 mb-3">
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => {
                    setNewDate(e.target.value);
                    if (errors.dates) {
                      setErrors((prev) => ({ ...prev, dates: undefined }));
                    }
                  }}
                  min={new Date().toISOString().split("T")[0]}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
                <button
                  type="button"
                  onClick={addDate}
                  className="px-4 py-2 bg-green-500 text-white rounded-xl font-medium hover:bg-green-600 transition-colors"
                >
                  Añadir
                </button>
              </div>
              {specificDates.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {specificDates.map((date) => (
                    <div
                      key={date}
                      className="flex items-center gap-2 bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm"
                    >
                      <span>
                        {new Date(date).toLocaleDateString("es-ES", {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeDate(date)}
                        className="text-green-600 hover:text-green-800 font-bold"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {errors.dates && <p className="text-red-500 text-sm mt-2">{errors.dates}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Flexibilidad</label>
              <select
                value={flexibilityMinutes}
                onChange={(e) => setFlexibilityMinutes(Number(e.target.value))}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 text-lg"
              >
                {FLEXIBILITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Allow Nearby Search */}
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="allowNearbySearch"
                checked={allowNearbySearch}
                onChange={(e) => setAllowNearbySearch(e.target.checked)}
                className="w-5 h-5 text-green-500 border-gray-300 rounded focus:ring-green-500 focus:ring-2"
              />
              <label htmlFor="allowNearbySearch" className="text-sm font-medium text-gray-700 cursor-pointer">
                Buscar viajes a menos de 1 km de las direcciones especificadas
              </label>
            </div>
            {allowNearbySearch && (
              <p className="text-xs text-gray-500 -mt-2">
                Si activas esta opción, también se buscarán y confirmarán automáticamente viajes cercanos (dentro de 1 km) además de los que coincidan exactamente con las direcciones.
              </p>
            )}

            <div className="flex justify-end space-x-4 pt-4">
              <button
                type="button"
                onClick={handleClose}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                disabled={isSubmitting}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-6 py-3 bg-green-500 text-white rounded-xl font-medium hover:bg-green-600 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Guardando..." : alert ? "Guardar Cambios" : "Activar búsqueda automática"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

