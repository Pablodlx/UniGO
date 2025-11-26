import { useEffect, useState, useCallback, useRef } from "react";
import { UnreadSummaryResponse } from "@/lib/api";

const STORAGE_KEY = "lastDismissedMessageId";
const POLLING_INTERVAL = 20000; // 20 seconds
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export function useUnreadBanner(token: string | null) {
  const [summary, setSummary] = useState<UnreadSummaryResponse | null>(null);
  const [visible, setVisible] = useState(false);
  const [maxMessageId, setMaxMessageId] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchSummary = useCallback(async () => {
    // Obtener token desde prop o localStorage
    const currentToken = token || 
      (typeof window !== "undefined" ? localStorage.getItem("token") : null);

    // Si no hay token, NO llamar al backend
    if (!currentToken || currentToken.trim() === "") {
      console.log("useUnreadBanner: No token available, skipping fetch. Token prop:", !!token);
      setVisible(false);
      setSummary(null);
      setMaxMessageId(0);
      return;
    }

    try {
      const lastDismissed =
        typeof window !== "undefined"
          ? Number(localStorage.getItem(STORAGE_KEY) || "0")
          : 0;
      console.log("useUnreadBanner: lastDismissed from localStorage:", lastDismissed);

      const endpointUrl = `${API_URL}/api/chat/unread-summary`;
      console.log("useUnreadBanner: Fetching from:", endpointUrl);
      console.log("useUnreadBanner: Token exists:", !!currentToken, "Length:", currentToken.length);

      // Fetch con el formato exacto solicitado
      const res = await fetch(endpointUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentToken}`,
        },
      });

      console.log("useUnreadBanner: Response status:", res.status, res.statusText);

      if (!res.ok) {
        console.error("useUnreadBanner: Response not OK:", res.status, res.statusText);
        try {
          const text = await res.text();
          console.error("useUnreadBanner: Response body:", text);
        } catch (e) {
          console.error("useUnreadBanner: Could not read response body");
        }
        setVisible(false);
        setSummary(null);
        setMaxMessageId(0);
        return;
      }

      const data: UnreadSummaryResponse = await res.json();
      console.log("useUnreadBanner: Received data:", JSON.stringify(data, null, 2));
      console.log("useUnreadBanner: Data summary:", {
        total_unread: data.total_unread,
        max_message_id: data.max_message_id,
        chats_count: data.chats.length,
        chats: data.chats.map(c => ({
          chat_id: c.chat_id,
          is_group_chat: c.is_group_chat,
          unread_count: c.unread_count,
          last_message_id: c.last_message_id
        }))
      });

      setSummary(data);
      setMaxMessageId(data.max_message_id);

      // Mostrar banner si hay mensajes nuevos (max_message_id > lastDismissed)
      const shouldShow = data.total_unread > 0 && data.max_message_id > lastDismissed;
      console.log(
        "useUnreadBanner: Visibility check:",
        {
          total_unread: data.total_unread,
          max_message_id: data.max_message_id,
          lastDismissed: lastDismissed,
          condition1: data.total_unread > 0,
          condition2: data.max_message_id > lastDismissed,
          shouldShow: shouldShow
        }
      );

      if (shouldShow) {
        console.log("useUnreadBanner: ✅ Showing banner");
        setVisible(true);
      } else {
        console.log("useUnreadBanner: ❌ Hiding banner");
        setVisible(false);
      }
    } catch (err) {
      console.error("useUnreadBanner: Error fetching unread summary:", err);
      setVisible(false);
      setSummary(null);
      setMaxMessageId(0);
    }
  }, [token]); // Incluir token en dependencias

  useEffect(() => {
    // Obtener token desde localStorage o del prop
    const currentToken = token || 
      (typeof window !== "undefined" ? localStorage.getItem("token") : null);

    console.log("useUnreadBanner: useEffect triggered, token prop:", !!token, "localStorage token:", !!currentToken);

    // Si no hay token, no hacer nada
    if (!currentToken || currentToken.trim() === "") {
      console.log("useUnreadBanner: No token in useEffect, skipping setup.");
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setVisible(false);
      setSummary(null);
      setMaxMessageId(0);
      return;
    }

    // Limpiar intervalo anterior si existe
    if (intervalRef.current) {
      console.log("useUnreadBanner: Clearing previous interval");
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Initial fetch
    console.log("useUnreadBanner: Setting up polling with token");
    fetchSummary();

    // Set up polling interval - cada 20 segundos
    intervalRef.current = setInterval(() => {
      console.log("useUnreadBanner: Polling interval triggered");
      fetchSummary();
    }, POLLING_INTERVAL);

    console.log("useUnreadBanner: Polling interval set up, ID:", intervalRef.current);

    // Cleanup on unmount
    return () => {
      console.log("useUnreadBanner: Cleaning up polling interval");
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [token, fetchSummary]); // Depende de token y fetchSummary

  // Listen for storage changes (multi-tab sync)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        console.log(
          "useUnreadBanner: localStorage change detected for",
          STORAGE_KEY,
          ". Re-fetching summary."
        );
        fetchSummary(); // Re-check visibility when dismissed message ID changes
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [fetchSummary]);

  const dismiss = useCallback(() => {
    const currentMaxMessageId = summary?.max_message_id || maxMessageId;
    if (currentMaxMessageId > 0) {
      localStorage.setItem(STORAGE_KEY, String(currentMaxMessageId));
      console.log(
        "useUnreadBanner: Dismissed banner, saved max_message_id:",
        currentMaxMessageId
      );
    }
    setVisible(false);
  }, [summary, maxMessageId]);

  return {
    summary,
    visible,
    dismiss,
    refresh: fetchSummary,
  };
}
