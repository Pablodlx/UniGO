"use client";

import { ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";

interface DesktopLayoutProps {
  children: ReactNode;
  className?: string;
  showSidebar?: boolean;
}

export default function DesktopLayout({ children, className = "", showSidebar = true }: DesktopLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();

  const navItems = [
    {
      id: "search",
      label: "Buscar",
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
        </svg>
      ),
      path: "/",
    },
    {
      id: "publish",
      label: "Publicar",
      icon: (
        <div className="w-5 h-5 bg-gray-200 rounded-full flex items-center justify-center">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
        </div>
      ),
      path: "/publish",
    },
    {
      id: "trips",
      label: "Tus viajes",
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
        </svg>
      ),
      path: "/trips",
    },
    {
      id: "messages",
      label: "Mensajes",
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
        </svg>
      ),
      path: "/messages",
      badge: 2,
    },
    {
      id: "alerts",
      label: "Mis Alertas",
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
        </svg>
      ),
      path: "/my-alerts",
    },
    {
      id: "profile",
      label: "Perfil",
      icon: (
        <div className="w-5 h-5 bg-teal-100 rounded-full flex items-center justify-center">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
          </svg>
        </div>
      ),
      path: "/profile",
    },
  ];

  const isActive = (path: string) => {
    if (path === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(path);
  };

  const handleNavClick = (item: any) => {
    // Make profile and alerts buttons functional
    if (item.id === "profile" || item.id === "alerts") {
      router.push(item.path);
    }
    // Other buttons do nothing
  };

  return (
    <div className={`min-h-screen bg-gray-50 flex ${className}`}>
      {/* Left Sidebar - Only show if showSidebar is true */}
      {showSidebar && (
        <div className="w-64 bg-white shadow-sm border-r border-gray-200">
          <div className="p-6">
            <h1 className="text-xl font-bold text-gray-900 mb-8">UniGO</h1>
            
            <nav className="space-y-2">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item)}
                  className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                    isActive(item.path) 
                      ? "bg-teal-50 text-teal-700 border border-teal-200" 
                      : "text-gray-600 hover:bg-gray-50"
                  } ${item.id !== "profile" && item.id !== "alerts" ? "opacity-50 cursor-not-allowed" : ""}`}
                  disabled={item.id !== "profile" && item.id !== "alerts"}
                >
                  {item.icon}
                  <span className="font-medium">{item.label}</span>
                  {item.badge && (
                    <div className="ml-auto bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {item.badge}
                    </div>
                  )}
                </button>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
}
