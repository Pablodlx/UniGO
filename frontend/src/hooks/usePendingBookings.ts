"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { getPendingSummary, PendingSummaryResponse } from "@/lib/api";
import { getToken } from "@/lib/api";

const POLLING_INTERVAL = 5000; // 5 seconds

export function usePendingBookings() {
  const [summary, setSummary] = useState<PendingSummaryResponse | null>(null);
  const [visible, setVisible] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchSummary = useCallback(async () => {
    const token = getToken();
    if (!token) {
      console.log("usePendingBookings: No token, skipping fetch.");
      setVisible(false);
      setSummary(null);
      return;
    }

    try {
      console.log("usePendingBookings: Fetching pending bookings summary...");
      const data = await getPendingSummary();
      console.log("usePendingBookings: Received data:", data);

      setSummary(data);

      // Show banner if there are pending bookings
      if (data.total_pending > 0) {
        setVisible(true);
      } else {
        setVisible(false);
      }
    } catch (error) {
      console.error("usePendingBookings: Error fetching pending summary:", error);
      setVisible(false);
      setSummary(null);
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    fetchSummary();

    // Set up polling interval
    intervalRef.current = setInterval(() => {
      fetchSummary();
    }, POLLING_INTERVAL);

    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchSummary]);

  const dismiss = useCallback(() => {
    setVisible(false);
  }, []);

  return { summary, visible, dismiss, refresh: fetchSummary };
}

