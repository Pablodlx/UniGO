"use client";

import { useState, useCallback } from "react";
import ToastWarning from "@/components/ui/ToastWarning";

export function useToast() {
  const [toast, setToast] = useState<{ message: string; id: number } | null>(null);

  const showToast = useCallback((message: string) => {
    const id = Date.now();
    setToast({ message, id });
  }, []);

  const hideToast = useCallback(() => {
    setToast(null);
  }, []);

  const ToastComponent = toast ? (
    <ToastWarning
      key={toast.id}
      message={toast.message}
      onClose={hideToast}
    />
  ) : null;

  return { showToast, ToastComponent };
}

