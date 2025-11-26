"use client";

import { useEffect, useCallback, useRef } from "react";
import { useNotificationContext } from "@/contexts/NotificationContext";
import { getUnreadNotifications } from "@/lib/api";

const POLLING_INTERVAL = 4000; // 4 seconds (between 3-5s)

export function useNotifications() {
  const {
    lastSeenMessageTimestamp,
    lastMessageTimestamp,
    panelClosedManually,
    panelClosedAt,
    showNotificationsPanel,
    unreadMessages,
    updateLastMessageTimestamp,
    setUnreadMessages,
    setShowPanel,
    resetPanelClosedState,
  } = useNotificationContext();

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchUnreadInfo = useCallback(async () => {
    try {
      const data = await getUnreadNotifications();

      // Update lastMessageTimestamp
      if (data.latest_message_timestamp) {
        updateLastMessageTimestamp(data.latest_message_timestamp);
      }

      // Update unread messages - will be filtered later based on lastSeenMessageTimestamp
      if (data.messages && Array.isArray(data.messages)) {
        setUnreadMessages(data.messages);
      }

      const latestTimestamp = data.latest_message_timestamp || 0;
      const hasMessages = data.messages && data.messages.length > 0;

      // Case A: No messages at all
      if (!hasMessages || latestTimestamp === 0) {
        setShowPanel(false);
        // Reset panelClosedManually when no messages
        if (panelClosedManually) {
          // This will be handled by the context, but we can reset it here
          // Actually, we shouldn't reset it here per the rules
        }
        return;
      }

      // Case B: No unread messages (latest <= lastSeen)
      if (latestTimestamp <= lastSeenMessageTimestamp) {
        setShowPanel(false);
        // Reset panelClosedManually when no unread
        if (panelClosedManually) {
          // Don't reset here - keep the state
        }
        return;
      }

      // Case C: There ARE unread messages
      // Filter out messages that have been seen (timestamp <= lastSeenMessageTimestamp)
      const actuallyUnread = data.messages.filter(
        msg => msg.timestamp > lastSeenMessageTimestamp
      );

      // If no actually unread messages remain, hide panel
      if (actuallyUnread.length === 0) {
        setShowPanel(false);
        return;
      }

      // Update unread messages to only show actually unread ones
      setUnreadMessages(actuallyUnread);

      // Case 1: User NEVER closed the panel manually
      if (!panelClosedManually) {
        setShowPanel(true);
        return;
      }

      // Case 2: User DID close it manually
      // Only show if a newer message arrived AFTER closing
      if (panelClosedManually && latestTimestamp > panelClosedAt) {
        // New message arrived after closing - show panel again
        // Reset panelClosedManually so it can show
        resetPanelClosedState();
        setShowPanel(true);
      } else {
        // No new messages since closing - keep hidden
        setShowPanel(false);
      }
    } catch (error) {
      console.error("useNotifications: Error fetching unread info:", error);
      // Don't show panel on error
      setShowPanel(false);
    }
  }, [
    lastSeenMessageTimestamp,
    panelClosedManually,
    panelClosedAt,
    updateLastMessageTimestamp,
    setUnreadMessages,
    setShowPanel,
  ]);

  useEffect(() => {
    // Initial fetch
    fetchUnreadInfo();

    // Set up polling interval
    intervalRef.current = setInterval(() => {
      fetchUnreadInfo();
    }, POLLING_INTERVAL);

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [fetchUnreadInfo]);

  return {
    showNotificationsPanel,
    unreadMessages,
    fetchUnreadInfo,
  };
}

