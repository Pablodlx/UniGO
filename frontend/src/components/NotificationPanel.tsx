"use client";

import { useNotificationContext } from "@/contexts/NotificationContext";
import { useRouter } from "next/navigation";

export default function NotificationPanel() {
  const {
    showNotificationsPanel,
    unreadMessages,
    closePanelManually,
    markAsRead,
  } = useNotificationContext();

  const router = useRouter();

  if (!showNotificationsPanel || unreadMessages.length === 0) {
    return null;
  }

  const handleOpenChat = (tripId: number) => {
    // Mark this specific trip as read
    markAsRead(tripId);
    
    // Navigate to my-rides and open the chat for this trip
    // We'll use a query parameter or state to indicate which chat to open
    router.push(`/my-rides?openChat=${tripId}`);
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Ahora";
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffMins < 1440) {
      const hours = Math.floor(diffMins / 60);
      return `Hace ${hours}h`;
    }

    return date.toLocaleDateString("es-ES", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Group messages by trip
  const messagesByTrip = unreadMessages.reduce((acc, msg) => {
    if (!acc[msg.trip_id]) {
      acc[msg.trip_id] = {
        trip_id: msg.trip_id,
        trip_title: msg.trip_title,
        messages: [],
      };
    }
    acc[msg.trip_id].messages.push(msg);
    return acc;
  }, {} as Record<number, { trip_id: number; trip_title: string; messages: typeof unreadMessages }>);

  const trips = Object.values(messagesByTrip);

  return (
    <div
      style={{
        position: "fixed",
        bottom: "20px",
        right: "20px",
        zIndex: 9999,
        background: "white",
        border: "1px solid #ddd",
        padding: "15px",
        borderRadius: "10px",
        width: "360px",
        maxHeight: "500px",
        overflowY: "auto",
        boxShadow: "0 4px 15px rgba(0,0,0,0.15)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
        <strong>Mensajes sin leer</strong>
        <button
          onClick={closePanelManually}
          style={{
            background: "transparent",
            border: "none",
            fontSize: "20px",
            cursor: "pointer",
            padding: "0 5px",
            lineHeight: "1",
          }}
          aria-label="Cerrar"
        >
          ✕
        </button>
      </div>

      <div style={{ marginTop: "10px" }}>
        {trips.map((trip) => (
          <div
            key={trip.trip_id}
            style={{
              marginBottom: "15px",
              paddingBottom: "15px",
              borderBottom: trips.length > 1 ? "1px solid #eee" : "none",
            }}
          >
            <div
              style={{
                fontWeight: "bold",
                marginBottom: "8px",
                color: "#166534",
                cursor: "pointer",
              }}
              onClick={() => handleOpenChat(trip.trip_id)}
            >
              {trip.trip_title}
            </div>
            <div style={{ fontSize: "14px", color: "#666" }}>
              {trip.messages.length} mensaje{trip.messages.length !== 1 ? "s" : ""} sin leer
            </div>
            <div style={{ marginTop: "8px" }}>
              {trip.messages.slice(0, 3).map((msg) => (
                <div
                  key={msg.id}
                  style={{
                    marginBottom: "8px",
                    padding: "8px",
                    background: "#f9fafb",
                    borderRadius: "6px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span style={{ fontWeight: "600", fontSize: "13px" }}>
                      {msg.sender_name}
                    </span>
                    <span style={{ fontSize: "11px", color: "#999" }}>
                      {formatTimestamp(msg.timestamp)}
                    </span>
                  </div>
                  <div style={{ fontSize: "13px", color: "#333" }}>
                    {msg.message.length > 100
                      ? `${msg.message.substring(0, 100)}...`
                      : msg.message}
                  </div>
                </div>
              ))}
              {trip.messages.length > 3 && (
                <div style={{ fontSize: "12px", color: "#666", marginTop: "4px" }}>
                  +{trip.messages.length - 3} mensaje{trip.messages.length - 3 !== 1 ? "s" : ""} más
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {trips.length === 1 && (
        <button
          onClick={() => handleOpenChat(trips[0].trip_id)}
          style={{
            marginTop: "10px",
            width: "100%",
            padding: "10px",
            background: "#166534",
            color: "white",
            borderRadius: "6px",
            border: "none",
            cursor: "pointer",
            fontWeight: "600",
          }}
        >
          Abrir chat
        </button>
      )}
    </div>
  );
}

