"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getUnreadChatNotifications, ChatNotification } from "@/lib/api";
import { getToken } from "@/lib/api";

const POLLING_INTERVAL = 4000; // 4 seconds

export function useChatNotificationsPolling() {
  const [bannerNotifications, setBannerNotifications] = useState<ChatNotification[]>([]);
  const [visible, setVisible] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<number>>(new Set());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const prevNotificationsRef = useRef<ChatNotification[]>([]);

  const fetchNotifications = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setBannerNotifications([]);
      setVisible(false);
      return;
    }

    try {
      // GET /notifications?unread=true devuelve TODAS las notificaciones no leídas
      const data = await getUnreadChatNotifications();
      
      // El array SIEMPRE representa el estado REAL de notificaciones pendientes
      // NO se conservan descartes anteriores (porque ya están marcadas como leídas en el backend)
      // Validar que data es un array
      if (Array.isArray(data)) {
        setBannerNotifications(data);
        setVisible(data.length > 0);
      } else {
        console.warn("useChatNotificationsPolling: Expected array, got:", typeof data);
        setBannerNotifications([]);
        setVisible(false);
      }
    } catch (error) {
      console.error("useChatNotificationsPolling: Error fetching notifications:", error);
      // No mostrar error al usuario, solo ocultar el banner
      setBannerNotifications([]);
      setVisible(false);
    }
  }, []);

  // Detectar cuando llegan nuevas notificaciones
  // Si hay notificaciones que no estaban en dismissedIds, significa que hay actividad nueva
  // En ese caso, limpiar la lista de descartadas para que todas vuelvan a aparecer
  useEffect(() => {
    if (bannerNotifications.length > 0) {
      // Verificar si hay notificaciones nuevas (que no estaban en el estado anterior)
      const prevIds = new Set(prevNotificationsRef.current.map(n => n.id));
      
      // Si hay notificaciones nuevas (que no estaban antes), limpiar descartadas
      const hasNewNotifications = bannerNotifications.some(notif => !prevIds.has(notif.id));
      
      if (hasNewNotifications) {
        // Limpiar la lista de descartadas para que todas las notificaciones vuelvan a aparecer
        setDismissedIds(new Set());
      }
      
      // Actualizar referencia
      prevNotificationsRef.current = bannerNotifications;
    }
  }, [bannerNotifications]);

  useEffect(() => {
    // Initial fetch
    fetchNotifications();

    // Set up polling interval
    intervalRef.current = setInterval(() => {
      fetchNotifications();
    }, POLLING_INTERVAL);

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [fetchNotifications]);

  return {
    bannerNotifications,
    visible,
    refresh: fetchNotifications,
    dismissedIds,
    setDismissedIds,
  };
}

