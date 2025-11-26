"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { getSystemNotifications, SystemNotification } from "@/lib/api";
import { getToken } from "@/lib/api";

const POLLING_INTERVAL = 10000; // 10 seconds
const STORAGE_KEY = "lastSeenNotificationId";

export function useSystemNotifications() {
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [visible, setVisible] = useState(false);
  const [latestNotification, setLatestNotification] = useState<SystemNotification | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchNotifications = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setVisible(false);
      setNotifications([]);
      setLatestNotification(null);
      return;
    }

    try {
      const data = await getSystemNotifications();
      setNotifications(data);

      // Get unread notifications of type "booking_update" (read_at is null)
      const unread = data.filter(n => n.read_at === null && n.type === "booking_update");
      
      if (unread.length > 0) {
        // Get the latest unread notification
        const latest = unread[0];
        setLatestNotification(latest);
        
        // Check if we've already shown this notification
        const lastSeenId = typeof window !== "undefined" 
          ? parseInt(localStorage.getItem(STORAGE_KEY) || "0", 10)
          : 0;
        
        if (latest.id > lastSeenId) {
          setVisible(true);
        } else {
          setVisible(false);
        }
      } else {
        setVisible(false);
        setLatestNotification(null);
      }
    } catch (error) {
      console.error("useSystemNotifications: Error fetching notifications:", error);
      setVisible(false);
      setNotifications([]);
      setLatestNotification(null);
    }
  }, []);

  const dismiss = useCallback(() => {
    if (latestNotification) {
      localStorage.setItem(STORAGE_KEY, String(latestNotification.id));
      setVisible(false);
    }
  }, [latestNotification]);

  useEffect(() => {
    fetchNotifications();

    intervalRef.current = setInterval(() => {
      fetchNotifications();
    }, POLLING_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchNotifications]);

  return { 
    notification: latestNotification, 
    visible, 
    dismiss,
    refresh: fetchNotifications
  };
}

