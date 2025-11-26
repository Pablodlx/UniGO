"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import DesktopLayout from "@/components/DesktopLayout";
import ChatModal from "@/components/ChatModal";
import { getCurrentUserId, getRide, getMessages } from "@/lib/api";
import Link from "next/link";

export default function ChatPage() {
  const router = useRouter();
  const params = useParams();
  const tripId = params?.tripId ? parseInt(params.tripId as string, 10) : null;
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [otherUserId, setOtherUserId] = useState<number | null>(null);
  const [otherUserName, setOtherUserName] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userId = getCurrentUserId();
    setCurrentUserId(userId);

    if (!tripId || !userId) {
      setLoading(false);
      return;
    }

    // Obtener información del viaje y mensajes para determinar el otro usuario
    const loadChatInfo = async () => {
      try {
        const [ride, messages] = await Promise.all([
          getRide(tripId),
          getMessages(tripId).catch(() => []) // Si falla, usar array vacío
        ]);
        
        // Determinar el otro usuario basándose en los mensajes o el viaje
        if (messages && messages.length > 0) {
          // Usar el primer mensaje para determinar el otro usuario
          const firstMessage = messages[0];
          if (firstMessage.sender_id === userId) {
            setOtherUserId(firstMessage.receiver_id);
            setOtherUserName(firstMessage.receiver_name);
          } else {
            setOtherUserId(firstMessage.sender_id);
            setOtherUserName(firstMessage.sender_name);
          }
        } else {
          // Si no hay mensajes, determinar basándose en el viaje
          if (ride.driver_id === userId) {
            // Si soy el conductor, el otro usuario es el primer pasajero
            const passengersIds = Array.isArray(ride.passengers_ids) 
              ? ride.passengers_ids 
              : ride.passengers_ids 
                ? [ride.passengers_ids] 
                : [];
            
            if (passengersIds.length > 0) {
              const firstPassenger = ride.passengers?.[0];
              if (firstPassenger) {
                setOtherUserId(firstPassenger.id);
                setOtherUserName(firstPassenger.name);
              } else {
                setOtherUserId(passengersIds[0]);
                setOtherUserName("Usuario");
              }
            }
          } else {
            // Si soy pasajero, el otro usuario es el conductor
            setOtherUserId(ride.driver_id);
            setOtherUserName(ride.driver_name || "Conductor");
          }
        }
      } catch (error) {
        console.error("Error loading chat info:", error);
      } finally {
        setLoading(false);
      }
    };

    loadChatInfo();
  }, [tripId]);

  const handleClose = () => {
    router.push("/my-rides");
  };

  if (loading) {
    return (
      <DesktopLayout>
        <div className="flex items-center justify-center h-64">
          <p>Cargando chat...</p>
        </div>
      </DesktopLayout>
    );
  }

  if (!tripId || !currentUserId || !otherUserId) {
    return (
      <DesktopLayout>
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <p className="text-gray-600">No se pudo cargar el chat.</p>
          <Link
            href="/my-rides"
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Volver a Mis Viajes
          </Link>
        </div>
      </DesktopLayout>
    );
  }

  return (
    <DesktopLayout>
      <ChatModal
        isOpen={true}
        onClose={handleClose}
        tripId={tripId!}
        currentUserId={currentUserId!}
        otherUserId={otherUserId!}
        otherUserName={otherUserName}
      />
    </DesktopLayout>
  );
}

