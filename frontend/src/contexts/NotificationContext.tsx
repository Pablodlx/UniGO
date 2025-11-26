"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

interface UnreadMessage {
  id: number;
  sender_id: number;
  sender_name: string;
  message: string;
  timestamp: number;
  trip_id: number;
  trip_title?: string;
}

interface NotificationState {
  lastSeenMessageTimestamp: number;
  lastMessageTimestamp: number;
  panelClosedManually: boolean;
  panelClosedAt: number;
  showNotificationsPanel: boolean;
  unreadMessages: UnreadMessage[];
}

interface NotificationContextType extends NotificationState {
  updateLastMessageTimestamp: (timestamp: number) => void;
  closePanelManually: () => void;
  markAsRead: (tripId?: number) => void;
  setUnreadMessages: (messages: UnreadMessage[]) => void;
  setShowPanel: (show: boolean) => void;
  resetPanelClosedState: () => void;
}

const STORAGE_KEYS = {
  LAST_SEEN: "notification_lastSeenMessageTimestamp",
  LAST_MESSAGE: "notification_lastMessageTimestamp",
  PANEL_CLOSED: "notification_panelClosedManually",
  PANEL_CLOSED_AT: "notification_panelClosedAt",
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<NotificationState>(() => {
    // Initialize from localStorage
    if (typeof window === "undefined") {
      return {
        lastSeenMessageTimestamp: 0,
        lastMessageTimestamp: 0,
        panelClosedManually: false,
        panelClosedAt: 0,
        showNotificationsPanel: false,
        unreadMessages: [],
      };
    }

    return {
      lastSeenMessageTimestamp: Number(
        localStorage.getItem(STORAGE_KEYS.LAST_SEEN) || "0"
      ),
      lastMessageTimestamp: Number(
        localStorage.getItem(STORAGE_KEYS.LAST_MESSAGE) || "0"
      ),
      panelClosedManually:
        localStorage.getItem(STORAGE_KEYS.PANEL_CLOSED) === "true",
      panelClosedAt: Number(
        localStorage.getItem(STORAGE_KEYS.PANEL_CLOSED_AT) || "0"
      ),
      showNotificationsPanel: false,
      unreadMessages: [],
    };
  });

  // Persist to localStorage whenever state changes
  useEffect(() => {
    if (typeof window === "undefined") return;

    localStorage.setItem(
      STORAGE_KEYS.LAST_SEEN,
      String(state.lastSeenMessageTimestamp)
    );
    localStorage.setItem(
      STORAGE_KEYS.LAST_MESSAGE,
      String(state.lastMessageTimestamp)
    );
    localStorage.setItem(
      STORAGE_KEYS.PANEL_CLOSED,
      String(state.panelClosedManually)
    );
    localStorage.setItem(
      STORAGE_KEYS.PANEL_CLOSED_AT,
      String(state.panelClosedAt)
    );
  }, [
    state.lastSeenMessageTimestamp,
    state.lastMessageTimestamp,
    state.panelClosedManually,
    state.panelClosedAt,
  ]);

  const updateLastMessageTimestamp = useCallback((timestamp: number) => {
    setState((prev) => ({ ...prev, lastMessageTimestamp: timestamp }));
  }, []);

  const closePanelManually = useCallback(() => {
    const now = Date.now();
    setState((prev) => ({
      ...prev,
      panelClosedManually: true,
      panelClosedAt: now,
      showNotificationsPanel: false,
    }));
  }, []);

  const markAsRead = useCallback((tripId?: number) => {
    setState((prev) => {
      // If tripId is provided, only mark messages from that trip as read
      // Otherwise, mark all as read
      let newLastSeenTimestamp = prev.lastMessageTimestamp;
      
      if (tripId !== undefined) {
        // Find the latest message timestamp for this specific trip
        const tripMessages = prev.unreadMessages.filter(msg => msg.trip_id === tripId);
        if (tripMessages.length > 0) {
          // Get the latest timestamp from this trip's messages
          const latestTripTimestamp = Math.max(...tripMessages.map(msg => msg.timestamp));
          // Update lastSeenMessageTimestamp to this trip's latest, but don't hide panel yet
          // The panel will hide automatically if no more unread messages remain
          newLastSeenTimestamp = Math.max(prev.lastSeenMessageTimestamp, latestTripTimestamp);
        }
      } else {
        // Mark all as read
        newLastSeenTimestamp = prev.lastMessageTimestamp;
      }
      
      return {
        ...prev,
        lastSeenMessageTimestamp: newLastSeenTimestamp,
        panelClosedManually: false,
        panelClosedAt: 0,
        // Don't hide panel here - let the polling logic decide based on remaining unread messages
      };
    });
  }, []);

  const setUnreadMessages = useCallback((messages: UnreadMessage[]) => {
    setState((prev) => ({ ...prev, unreadMessages: messages }));
  }, []);

  const setShowPanel = useCallback((show: boolean) => {
    setState((prev) => ({ ...prev, showNotificationsPanel: show }));
  }, []);

  const resetPanelClosedState = useCallback(() => {
    setState((prev) => ({
      ...prev,
      panelClosedManually: false,
      panelClosedAt: 0,
    }));
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        ...state,
        updateLastMessageTimestamp,
        closePanelManually,
        markAsRead,
        setUnreadMessages,
        setShowPanel,
        resetPanelClosedState,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotificationContext() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error(
      "useNotificationContext must be used within NotificationProvider"
    );
  }
  return context;
}

