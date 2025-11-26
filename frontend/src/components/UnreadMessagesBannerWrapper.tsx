"use client";

import { useEffect, useState } from "react";
import UnreadMessagesBanner from "./UnreadMessagesBanner";

export default function UnreadMessagesBannerWrapper() {
  const [token, setToken] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // Obtener token desde localStorage - formato exacto solicitado
    const storedToken =
      typeof window !== "undefined"
        ? localStorage.getItem("token")
        : null;
    
    console.log("UnreadMessagesBannerWrapper - Token from localStorage:", storedToken ? "Found" : "Not found");
    if (storedToken) {
      console.log("UnreadMessagesBannerWrapper - Token length:", storedToken.length);
      console.log("UnreadMessagesBannerWrapper - Token preview:", storedToken.substring(0, 20) + "...");
    }
    
    setToken(storedToken);
    
    // Listen for storage changes (in case token is set in another tab)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "token") {
        const newToken = e.newValue;
        console.log("UnreadMessagesBannerWrapper - Token storage changed. New value:", newToken ? "Found" : "Not found");
        setToken(newToken);
      }
    };
    
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // Don't render on server side
  if (!mounted) {
    return null;
  }

  // Si no hay token, NO renderizar el banner
  if (!token || token.trim() === "") {
    console.log("UnreadMessagesBannerWrapper - No token, not rendering banner.");
    return null;
  }

  console.log("UnreadMessagesBannerWrapper - Rendering banner with token.");
  // Pasar el token al componente
  return <UnreadMessagesBanner token={token} />;
}

