"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { TripGroupMessage, sendTripMessage, getTripMessages } from "@/lib/api";

// Helper to construct full avatar URL
const getAvatarUrl = (avatarUrl: string | null | undefined): string => {
  if (!avatarUrl) return "/default-avatar.png";
  
  // If it's already a full URL, return it as is
  if (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://')) {
    return avatarUrl;
  }
  
  // Otherwise, construct the full URL
  const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000/api";
  const baseUrl = BASE.replace('/api', '');
  return `${baseUrl}${avatarUrl}`;
};

interface TripGroupChatProps {
  isOpen: boolean;
  onClose: () => void;
  tripId: number;
  currentUserId: number;
}

export default function TripGroupChat({
  isOpen,
  onClose,
  tripId,
  currentUserId,
}: TripGroupChatProps) {
  const [messages, setMessages] = useState<TripGroupMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Load messages
  const loadMessages = useCallback(async () => {
    if (!tripId || tripId === 0 || !isOpen) {
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      const msgs = await getTripMessages(tripId);
      setMessages(msgs || []);
    } catch (error: unknown) {
      console.error("Error loading messages:", error);
      const errorMessage = error instanceof Error ? error.message : String(error) || "Unknown error";
      if (errorMessage.includes("403") || errorMessage.includes("Chat not available") || errorMessage.includes("Forbidden")) {
        setError("El chat no está disponible para este viaje.");
      } else if (errorMessage.includes("401") || errorMessage.includes("Unauthorized")) {
        setError("Debes iniciar sesión para usar el chat.");
      } else {
        // Show error but allow retry
        setError("Error al cargar mensajes. Reintentando...");
        console.warn("Could not load messages. Will retry...");
      }
    } finally {
      setLoading(false);
    }
  }, [tripId, isOpen]);

  // Initial load
  useEffect(() => {
    if (isOpen) {
      loadMessages();
    }
  }, [isOpen, loadMessages]);

  // Polling every 3 seconds
  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(() => {
      loadMessages();
    }, 3000);

    return () => clearInterval(interval);
  }, [isOpen, loadMessages]);

  // Auto-scroll when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle send message
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    const messageText = newMessage.trim();
    setNewMessage("");
    setSending(true);

    try {
      await sendTripMessage({
        trip_id: tripId,
        message: messageText,
      });
      await loadMessages();
    } catch (error: unknown) {
      console.error("Error sending message:", error);
      const errorMessage = error instanceof Error ? error.message : "Error al enviar el mensaje";
      alert(errorMessage);
      setNewMessage(messageText); // Restore message on error
    } finally {
      setSending(false);
    }
  };

  // Format timestamp (only on client to avoid hydration issues)
  const formatTime = (timestamp: string) => {
    if (!mounted) return ""; // Return empty string during SSR
    
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

  if (!isOpen || !mounted) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-md backdrop-saturate-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
                <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Chat del Viaje</h2>
              <p className="text-sm text-gray-500">Conversación grupal con todos los pasajeros</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Cerrar chat"
          >
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50"
        >
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}
        {loading && messages.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <div className="text-gray-500">Cargando mensajes...</div>
          </div>
        ) : !Array.isArray(messages) || messages.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <div className="text-center text-gray-500">
              <p className="text-sm mb-2">No hay mensajes aún</p>
              <p className="text-xs">Envía el primer mensaje para comenzar la conversación</p>
            </div>
          </div>
        ) : (
          (Array.isArray(messages) ? messages : []).map((msg) => {
            const isCurrentUser = msg.sender_id === currentUserId;
            const avatarUrl = getAvatarUrl(msg.sender_avatar_url);
            
            return (
              <div
                key={msg.id}
                className={`flex items-end gap-2 ${isCurrentUser ? "flex-row-reverse" : "flex-row"}`}
              >
                {/* Avatar - izquierda para otros, derecha para mí */}
                <div className="flex-shrink-0">
                  <img
                    src={avatarUrl}
                    alt={msg.sender_name}
                    className="w-8 h-8 rounded-full object-cover"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = "/default-avatar.png";
                    }}
                  />
                </div>
                
                {/* Message bubble container */}
                <div className={`flex flex-col ${isCurrentUser ? "items-end" : "items-start"} max-w-[70%]`}>
                  {/* Nombre del remitente - siempre visible */}
                  <p className={`text-xs text-gray-500 mb-1 px-1 font-medium ${isCurrentUser ? "text-right" : "text-left"}`}>
                    {msg.sender_name}
                  </p>
                  
                  {/* Burbuja del mensaje */}
                  <div
                    className={`rounded-2xl px-4 py-2 ${
                      isCurrentUser
                        ? "bg-orange-500 text-white rounded-br-sm"
                        : "bg-white text-gray-900 border border-gray-200 rounded-bl-sm"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                    <p
                      className={`text-xs mt-1 ${
                        isCurrentUser ? "text-orange-100" : "text-gray-500"
                      }`}
                    >
                      {formatTime(msg.timestamp)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSend} className="p-6 border-t border-gray-200 bg-white">
          <div className="flex items-center space-x-3">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Escribe un mensaje..."
              className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
              disabled={sending}
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || sending}
              className="px-6 py-3 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {sending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Enviando...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  <span>Enviar</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

