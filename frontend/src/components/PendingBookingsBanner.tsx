"use client";

import { usePendingBookings } from "@/hooks/usePendingBookings";

interface PendingBookingsBannerProps {
  onOpenModal: () => void;
}

export default function PendingBookingsBanner({ onOpenModal }: PendingBookingsBannerProps) {
  const { summary, visible, dismiss } = usePendingBookings();

  if (!visible || !summary || summary.total_pending === 0) {
    return null;
  }

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
        <strong style={{ color: "#166534" }}>Solicitudes de reserva</strong>
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
        <p style={{ fontSize: "14px", color: "#666", marginBottom: "10px" }}>
          Tienes {summary.total_pending} solicitud{summary.total_pending !== 1 ? "es" : ""} de reserva pendiente{summary.total_pending !== 1 ? "s" : ""}.
        </p>
        <button
          onClick={onOpenModal}
          style={{
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
          Ver detalles
        </button>
      </div>
    </div>
  );
}

