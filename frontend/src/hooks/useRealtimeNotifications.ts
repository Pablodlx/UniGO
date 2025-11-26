import { useEffect, useState, useCallback, useRef } from "react";
import { UnreadSummaryResponse } from "@/lib/api";

const STORAGE_KEY = "lastDismissedMessageId";

interface ChatSummary {
  chat_id: number;
  unread_count: number;
  last_message_id: number;
  trip_title: string;
  other_user_name: string;
}

interface UnreadSummary {
  total_unread: number;
  max_message_id: number;
  chats: ChatSummary[];
}

export function useRealtimeNotifications(token: string | null) {
  const [summary, setSummary] = useState<UnreadSummary | null>(null);
  const [visible, setVisible] = useState(false);
  const [maxMessageId, setMaxMessageId] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);

  // Carga inicial mediante REST
  const fetchInitial = useCallback(async () => {
    if (!token) return;

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"}/api/chat/unread-summary`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!res.ok) {
        console.error("useRealtimeNotifications: Failed to fetch initial summary:", res.status);
        return;
      }

      const data: UnreadSummary = await res.json();
      setSummary(data);
      setMaxMessageId(data.max_message_id);

      const lastDismissed =
        typeof window !== "undefined"
          ? Number(localStorage.getItem(STORAGE_KEY) || "0")
          : 0;

      if (data.total_unread > 0 && data.max_message_id > lastDismissed) {
        setVisible(true);
      } else {
        setVisible(false);
      }
    } catch (err) {
      console.error("useRealtimeNotifications: Error fetching initial summary:", err);
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      setVisible(false);
      setSummary(null);
      setMaxMessageId(0);
      return;
    }

    // Carga inicial
    fetchInitial();

    // WebSocket en tiempo real
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
    const wsUrl = apiUrl
      .replace("http://", "ws://")
      .replace("https://", "wss://");

    const wsEndpoint = `${wsUrl}/api/chat/ws?token=${token}`;
    console.log("useRealtimeNotifications: Connecting to WebSocket:", wsEndpoint.replace(token, "TOKEN_HIDDEN"));

    const ws = new WebSocket(wsEndpoint);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("useRealtimeNotifications: WebSocket connected successfully");
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        console.log("useRealtimeNotifications: Received message:", msg);

        if (msg.type === "NEW_MESSAGE") {
          console.log("useRealtimeNotifications: Received NEW_MESSAGE", msg);
          
          const newMax = Math.max(maxMessageId, msg.message_id || 0);
          setMaxMessageId(newMax);

          // Si viene summary en el mensaje, úsalo
          if (msg.summary) {
            setSummary(msg.summary as UnreadSummary);
            const lastDismissed =
              typeof window !== "undefined"
                ? Number(localStorage.getItem(STORAGE_KEY) || "0")
                : 0;
            
            if (msg.summary.total_unread > 0 && msg.summary.max_message_id > lastDismissed) {
              setVisible(true);
            }
          } else {
            // Si no viene summary, recargar por REST
            fetchInitial();
          }
        }
      } catch (err) {
        console.error("useRealtimeNotifications: Error parsing WebSocket message:", err, "Raw data:", event.data);
      }
    };

    ws.onerror = (e) => {
      console.error("useRealtimeNotifications: WebSocket error", e);
      // El evento de error no tiene mucha información, pero podemos verificar el estado
      console.error("useRealtimeNotifications: WebSocket readyState:", ws.readyState);
      // Estados: 0 = CONNECTING, 1 = OPEN, 2 = CLOSING, 3 = CLOSED
    };

    ws.onclose = (e) => {
      console.log("useRealtimeNotifications: WebSocket closed", {
        code: e.code,
        reason: e.reason,
        wasClean: e.wasClean
      });
      
      // Solo intentar reconectar si fue un cierre inesperado (no fue limpio)
      if (!e.wasClean && token) {
        console.log("useRealtimeNotifications: Unexpected close, attempting to reconnect in 3 seconds...");
        setTimeout(() => {
          if (token) {
            fetchInitial();
          }
        }, 3000);
      }
    };

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [token, fetchInitial, maxMessageId]);

  // Listen for storage changes (multi-tab sync)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        console.log("useRealtimeNotifications: localStorage change detected, re-checking visibility");
        if (summary) {
          const lastDismissed = Number(e.newValue || "0");
          if (summary.total_unread > 0 && summary.max_message_id > lastDismissed) {
            setVisible(true);
          } else {
            setVisible(false);
          }
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [summary]);

  const dismiss = useCallback(() => {
    if (summary && summary.max_message_id > 0) {
      localStorage.setItem(STORAGE_KEY, String(summary.max_message_id));
      console.log("useRealtimeNotifications: Dismissed banner, saved max_message_id:", summary.max_message_id);
    } else {
      localStorage.setItem(STORAGE_KEY, String(maxMessageId));
      console.log("useRealtimeNotifications: Dismissed banner, saved maxMessageId (fallback):", maxMessageId);
    }
    setVisible(false);
  }, [summary, maxMessageId]);

  return {
    summary,
    visible,
    dismiss,
    refresh: fetchInitial,
  };
}

