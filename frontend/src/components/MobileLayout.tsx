"use client";

import { ReactNode } from "react";
import BottomNavigation from "@/components/BottomNavigation";

interface MobileLayoutProps {
  children: ReactNode;
  showBottomNav?: boolean;
  className?: string;
}

export default function MobileLayout({ 
  children, 
  showBottomNav = true, 
  className = "" 
}: MobileLayoutProps) {
  return (
    <div className={`min-h-screen bg-gray-50 ${className}`}>
      {children}
      {showBottomNav && <BottomNavigation />}
    </div>
  );
}
