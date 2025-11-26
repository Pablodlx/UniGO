"use client";

import { useNotifications } from "@/hooks/useNotifications";
import { useEffect } from "react";

export default function NotificationHookWrapper() {
  // This component just initializes the polling hook
  useNotifications();
  return null;
}

