"use client";

import { useState } from "react";
import { MagnifyingGlassIcon, PlusIcon, TruckIcon, ChatBubbleLeftRightIcon, UserIcon } from "@heroicons/react/24/outline";

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onSignIn: () => void;
  isLoggedIn: boolean;
}

export default function Sidebar({ activeTab, onTabChange, onSignIn, isLoggedIn }: SidebarProps) {
  const menuItems = [
    { id: "buscar", label: "Buscar", icon: MagnifyingGlassIcon },
    { id: "publicar", label: "Publicar", icon: PlusIcon },
    { id: "viajes", label: "Tus viajes", icon: TruckIcon },
    { id: "mensajes", label: "Mensajes", icon: ChatBubbleLeftRightIcon },
  ];

  return (
    <div className="w-64 bg-white h-screen flex flex-col shadow-lg">
      {/* Logo */}
      <div className="p-6 border-b border-gray-200">
        <h1 className="text-2xl font-bold text-blue-900">UniGo</h1>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            
            return (
              <li key={item.id}>
                <button
                  onClick={() => onTabChange(item.id)}
                  className={`w-full flex items-center px-4 py-3 rounded-lg text-left transition-colors ${
                    isActive
                      ? "bg-blue-100 text-blue-700 border border-blue-200"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  }`}
                >
                  <Icon className={`w-5 h-5 mr-3 ${isActive ? "text-blue-700" : "text-gray-500"}`} />
                  <span className="font-medium">{item.label}</span>
                </button>
              </li>
            );
          })}
          
          {/* Sign In / Profile Button */}
          <li>
            <button
              onClick={onSignIn}
              className="w-full flex items-center px-4 py-3 rounded-lg text-left transition-colors text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            >
              <UserIcon className="w-5 h-5 mr-3 text-gray-500" />
              <span className="font-medium">{isLoggedIn ? "Perfil" : "Iniciar sesión"}</span>
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}
