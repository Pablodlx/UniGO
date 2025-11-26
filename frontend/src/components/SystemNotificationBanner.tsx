"use client";

import { useSystemNotifications } from "@/hooks/useSystemNotifications";

export default function SystemNotificationBanner() {
  const { notification, visible, dismiss } = useSystemNotifications();

  if (!visible || !notification || notification.type !== "booking_update") {
    return null;
  }

  // Determinar si es aceptada o rechazada basándose en el mensaje
  const messageLower = notification.message.toLowerCase();
  const isAccepted = messageLower.includes("aceptada");
  const isRejected = messageLower.includes("rechazada");

  // Extraer origen y destino del mensaje
  // El formato del backend es: "Tu reserva para el viaje {origen} → {destino} ha sido ACEPTADA/RECHAZADA."
  const messageMatch = notification.message.match(/viaje (.+?)\s*→\s*(.+?)\s+ha sido/i);
  const origin = messageMatch ? messageMatch[1].trim() : "";
  const destination = messageMatch ? messageMatch[2].trim() : "";


  return (
    <div
      style={{
        position: "fixed",
        bottom: "20px",
        left: "20px",
        zIndex: 9998,
        background: "white",
        border: "1px solid #ddd",
        padding: "15px",
        borderRadius: "10px",
        width: "360px",
        boxShadow: "0 4px 15px rgba(0,0,0,0.15)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {/* Icono según el tipo */}
          <div
            style={{
              width: "24px",
              height: "24px",
              borderRadius: "50%",
              backgroundColor: isAccepted ? "#10b981" : isRejected ? "#ef4444" : "#166534",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: "14px",
              fontWeight: "bold",
            }}
          >
            {isAccepted ? "✓" : isRejected ? "✗" : "!"}
          </div>
          <strong style={{ color: isAccepted ? "#10b981" : isRejected ? "#ef4444" : "#166534" }}>
            {isAccepted ? "Reserva aceptada" : isRejected ? "Reserva rechazada" : "Notificación"}
          </strong>
        </div>
        <button
          onClick={dismiss}
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
        <p style={{ fontSize: "14px", color: "#666" }}>
          {origin && destination ? (
            <>
              Tu reserva para <strong>{origin} → {destination}</strong> ha sido{" "}
              {isAccepted ? "aceptada" : isRejected ? "rechazada" : "actualizada"}.
            </>
          ) : (
            notification.message
          )}
        </p>
      </div>
    </div>
  );
}

