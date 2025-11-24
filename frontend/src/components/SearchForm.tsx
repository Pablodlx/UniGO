"use client";

import { useState, useEffect } from "react";
import { MapPinIcon, CalendarIcon, UserIcon } from "@heroicons/react/24/outline";

interface SearchFormProps {
  onSubmit: (searchData: SearchData) => void;
}

export interface SearchData {
  origin: string;
  destination: string;
  date: string;
  passengers: number;
}

export default function SearchForm({ onSubmit }: SearchFormProps) {
  const [mounted, setMounted] = useState(false);
  
  const [formData, setFormData] = useState<SearchData>({
    origin: "",
    destination: "",
    date: "",
    passengers: 1,
  });

  // Set mounted and update date when component mounts
  useEffect(() => {
    setMounted(true);
    setFormData(prev => ({
      ...prev,
      date: new Date().toLocaleDateString("es-ES")
    }));
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleInputChange = (field: keyof SearchData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 max-w-md mx-auto">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Origin */}
        <div>
          <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
            <MapPinIcon className="w-4 h-4 mr-2 text-red-500" />
            De
          </label>
          <input
            type="text"
            placeholder="Origen"
            value={formData.origin}
            onChange={(e) => handleInputChange("origin", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Destination */}
        <div>
          <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
            <MapPinIcon className="w-4 h-4 mr-2 text-red-500" />
            A
          </label>
          <input
            type="text"
            placeholder="Destino"
            value={formData.destination}
            onChange={(e) => handleInputChange("destination", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Date */}
        <div>
          <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
            <CalendarIcon className="w-4 h-4 mr-2 text-blue-500" />
            Hoy
          </label>
          <div className="relative">
            <input
              type="text"
              value={formData.date}
              onChange={(e) => handleInputChange("date", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
            />
            <CalendarIcon className="absolute right-3 top-2.5 w-4 h-4 text-gray-400" />
          </div>
        </div>

        {/* Passengers */}
        <div>
          <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
            <UserIcon className="w-4 h-4 mr-2 text-blue-500" />
            {formData.passengers} Niño o joven (0 a 26)
          </label>
          <p className="text-xs text-gray-500 mb-2">Sin tarjeta de descuento de tren</p>
          <input
            type="number"
            min="1"
            max="10"
            value={formData.passengers}
            onChange={(e) => handleInputChange("passengers", parseInt(e.target.value) || 1)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Search Button */}
        <button
          type="submit"
          className="w-full bg-blue-900 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Buscar
        </button>
      </form>
    </div>
  );
}
