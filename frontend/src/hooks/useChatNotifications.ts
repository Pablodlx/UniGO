"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getUnreadChatNotifications, ChatNotification } from "@/lib/api";
import { getToken } from "@/lib/api";

const POLLING_INTERVAL = 4000; // 4 seconds

export function useChatNotifications() {
  const [notifications, setNotifications] = useState<ChatNotification[]>([]);
  const [visible, setVisible] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchNotifications = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setNotifications([]);
      setVisible(false);
      return;
    }

    try {
      const data = await getUnreadChatNotifications();
      setNotifications(data);
      setVisible(data.length > 0);
    } catch (error) {
      console.error("useChatNotifications: Error fetching notifications:", error);
      setNotifications([]);
      setVisible(false);
    }
  }, []);

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
    notifications,
    visible,
    refresh: fetchNotifications,
  };
}

