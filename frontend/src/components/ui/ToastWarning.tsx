"use client";

import { useEffect, useState } from "react";

interface ToastWarningProps {
  message: string;
  onClose: () => void;
  duration?: number;
  showProfileTitle?: boolean;
}

export default function ToastWarning({ message, onClose, duration = 5000, showProfileTitle = false }: ToastWarningProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300); // Wait for fade-out animation
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  if (!isVisible) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "20px",
        right: "20px",
        zIndex: 10000,
        background: "white",
        border: "1px solid #ddd",
        padding: "15px",
        borderRadius: "10px",
        width: "360px",
        boxShadow: "0 4px 15px rgba(0,0,0,0.15)",
        animation: "fadeIn 0.3s ease-in",
        opacity: isVisible ? 1 : 0,
        transition: "opacity 0.3s ease-out",
      }}
    >
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", flex: 1 }}>
          {/* Icono de advertencia amarillo */}
          <div
            style={{
              width: "24px",
              height: "24px",
              borderRadius: "50%",
              backgroundColor: "#fbbf24",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: "14px",
              fontWeight: "bold",
              flexShrink: 0,
            }}
          >
            ⚠️
          </div>
          <div style={{ flex: 1 }}>
            {showProfileTitle && (
              <strong style={{ color: "#166534", display: "block", marginBottom: "4px", fontSize: "15px" }}>
                Completa tu perfil
              </strong>
            )}
            <p style={{ fontSize: "14px", color: "#666", margin: 0 }}>
              {message}
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setIsVisible(false);
            setTimeout(onClose, 300);
          }}
          style={{
            background: "transparent",
            border: "none",
            fontSize: "20px",
            cursor: "pointer",
            padding: "0 5px",
            lineHeight: "1",
            color: "#999",
            flexShrink: 0,
          }}
          aria-label="Cerrar"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

