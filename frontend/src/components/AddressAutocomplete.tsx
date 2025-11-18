"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { loadGoogleMaps } from "@/utils/googleMapsLoader";

export type AddressValue = {
  formattedAddress: string;
  placeId: string;
  lat: number;
  lng: number;
  addressComponents?: google.maps.GeocoderAddressComponent[];
};

interface AddressAutocompleteProps {
  id: string;
  label?: string;
  placeholder?: string;
  initialValue?: AddressValue | null;
  onChange: (value: AddressValue | null) => void;
  required?: boolean;
  restrictions?: { country?: string[] };
  className?: string;
  error?: string;
  showVerifiedBadge?: boolean;
}

interface Prediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

export default function AddressAutocomplete({
  id,
  label,
  placeholder = "Ej. Calle Gran Vía, 1",
  initialValue,
  onChange,
  required = false,
  restrictions = { country: ["ES"] },
  className = "",
  error,
  showVerifiedBadge = true,
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const blurTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isApiReady, setIsApiReady] = useState(false);

  const [value, setValue] = useState<AddressValue | null>(initialValue || null);
  const [inputText, setInputText] = useState(initialValue?.formattedAddress || "");
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [hasBlurred, setHasBlurred] = useState(false);
  const [isValid, setIsValid] = useState(!!initialValue?.placeId);
  const [apiErrorStatus, setApiErrorStatus] = useState<string | null>(null);

  // Initialize services if available - defined before useEffect
  const initializeServices = useCallback(() => {
    if (window.google?.maps?.places) {
      try {
        if (!autocompleteServiceRef.current) {
          autocompleteServiceRef.current = new window.google.maps.places.AutocompleteService();
        }
        if (!placesServiceRef.current) {
          const dummyDiv = document.createElement("div");
          placesServiceRef.current = new window.google.maps.places.PlacesService(dummyDiv);
        }
        return true;
      } catch (err) {
        console.error("Failed to initialize Google Maps services:", err);
        return false;
      }
    }
    return false;
  }, []);

  // Load Google Maps - silently, don't show errors until user tries to use it
  useEffect(() => {
    // Check if API key exists
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    
    if (!apiKey) {
      // No API key - silently mark as not ready, don't show error
      setIsApiReady(false);
      setIsLoading(false);
      return;
    }

    // Try to load Google Maps
    loadGoogleMaps()
      .then(() => {
        // Try to initialize services
        if (initializeServices()) {
          setIsApiReady(true);
        } else {
          setIsApiReady(false);
        }
        setIsLoading(false);
      })
      .catch((err) => {
        // Silently handle error - don't log to console
        // Check if API is actually available despite the error
        if (window.google?.maps?.places) {
          if (initializeServices()) {
            setIsApiReady(true);
          } else {
            setIsApiReady(false);
          }
        } else {
          // API truly not available
          setIsApiReady(false);
        }
        setIsLoading(false);
      });

    // Also check periodically if Google Maps becomes available
    const checkInterval = setInterval(() => {
      if (window.google?.maps?.places && !autocompleteServiceRef.current) {
        if (initializeServices()) {
          setIsApiReady(true);
          setIsLoading(false);
        }
      }
    }, 1000);

    // Stop checking after 10 seconds
    setTimeout(() => {
      clearInterval(checkInterval);
    }, 10000);

    return () => {
      clearInterval(checkInterval);
    };
  }, [initializeServices]);

  // Sync with initialValue prop
  useEffect(() => {
    if (inputRef.current && initialValue) {
      if (initialValue.formattedAddress !== inputRef.current.value) {
        inputRef.current.value = initialValue.formattedAddress;
        setInputText(initialValue.formattedAddress);
        setValue(initialValue);
        setIsValid(!!initialValue.placeId);
      }
    } else if (inputRef.current && !initialValue && inputRef.current.value) {
      // Clear if initialValue becomes null
      inputRef.current.value = "";
      setInputText("");
      setValue(null);
      setIsValid(false);
    }
  }, [initialValue]);

  // Fetch predictions
  const fetchPredictions = useCallback((input: string) => {
    if (!input.trim()) {
      setPredictions([]);
      setShowDropdown(false);
      return;
    }

    // Try to initialize services first - don't check API key, just try to use the API
    // The API might be loaded via another method or the key might be set elsewhere
    if (!autocompleteServiceRef.current) {
      if (!initializeServices()) {
        // Services not available - API might not be loaded
        // Don't set error - just return silently
        // Error will only be set if API call actually fails
        setPredictions([]);
        setShowDropdown(false);
        setIsFetching(false);
        return;
      }
    }

    // If we don't have services after initialization, we can't fetch
    if (!autocompleteServiceRef.current) {
      // Don't set error - services might initialize later
      // Only set error if API call actually fails
      setPredictions([]);
      setShowDropdown(false);
      setIsFetching(false);
      return;
    }
    
    // If we got here, we have services ready - clear any error status immediately
    // This is critical: if we can make API calls, clear errors right away
    // Don't wait for API response - clear errors as soon as we can make the call
    // Also mark API as ready since we can make calls
    setApiErrorStatus(null);
    setIsApiReady(true); // Mark as ready - we can make API calls

    setIsFetching(true);
    const request: google.maps.places.AutocompletionRequest = {
      input: input,
      types: ["establishment", "geocode"], // Include establishments (like universities) and addresses
      language: "es",
      region: "es",
    };

    if (restrictions.country && restrictions.country.length > 0) {
      request.componentRestrictions = { country: restrictions.country };
    }

    try {
      autocompleteServiceRef.current.getPlacePredictions(
        request,
        (results, status) => {
          setIsFetching(false);
          
          if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
            // API is working! Clear errors FIRST, then set predictions
            // This ensures error never shows if API works
            setApiErrorStatus(null); // CRITICAL: Clear error status immediately
            setIsApiReady(true); // Mark API as ready
            setPredictions(results); // Set predictions
            // Always show dropdown if we have results
            if (results.length > 0) {
              setShowDropdown(true);
              setSelectedIndex(-1);
              // Double-check: clear error again after setting dropdown
              setApiErrorStatus(null);
            } else {
              setShowDropdown(false);
            }
          } else if (status === window.google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
            // API is working but no results - this is normal, not an error
            // Clear error status - API responded successfully (even with no results)
            setApiErrorStatus(null); // Clear any error status - API responded successfully
            setIsApiReady(true);
            setPredictions([]);
            setShowDropdown(false);
          } else if (status === window.google.maps.places.PlacesServiceStatus.REQUEST_DENIED) {
            // API key issue - this is a real error
            setIsApiReady(false);
            setApiErrorStatus("REQUEST_DENIED");
            setPredictions([]);
            setShowDropdown(false);
          } else if (status === window.google.maps.places.PlacesServiceStatus.OVER_QUERY_LIMIT) {
            // Rate limit - API key might be invalid or over limit
            setIsApiReady(false);
            setApiErrorStatus("OVER_QUERY_LIMIT");
            setPredictions([]);
            setShowDropdown(false);
          } else if (status === window.google.maps.places.PlacesServiceStatus.INVALID_REQUEST) {
            // Invalid request - might be API key issue
            setIsApiReady(false);
            setApiErrorStatus("INVALID_REQUEST");
            setPredictions([]);
            setShowDropdown(false);
          } else {
            // Other errors - clear error status, might be transient or API might work
            setApiErrorStatus(null);
            setPredictions([]);
            setShowDropdown(false);
          }
        }
      );
    } catch (error) {
      // Only set error if it's a real failure
      setIsFetching(false);
      // Check if services are still available
      if (!autocompleteServiceRef.current || !window.google?.maps?.places) {
        setApiErrorStatus("SERVICE_UNAVAILABLE");
      }
      setPredictions([]);
      setShowDropdown(false);
    }
  }, [restrictions.country, initializeServices]);

  // Handle input change with debounce
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputText(newValue);
    
    // Clear error status immediately when user types - give API a chance to work
    setApiErrorStatus(null);
    
    // Invalidate if user types after selection
    if (value) {
        setValue(null);
        setIsValid(false);
        onChange(null);
      setHasBlurred(false); // Reset blur state when user starts typing
    }

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Debounce API calls
    if (newValue.trim().length > 0) {
      timeoutRef.current = setTimeout(() => {
        fetchPredictions(newValue);
      }, 300);
    } else {
      setPredictions([]);
      setShowDropdown(false);
      setApiErrorStatus(null);
    }
  };

  // Get place details from place_id using PlacesService
  const getPlaceDetails = useCallback((placeId: string) => {
    if (!placesServiceRef.current && window.google?.maps?.places) {
      // Create PlacesService if not already created
      const dummyDiv = document.createElement("div");
      placesServiceRef.current = new window.google.maps.places.PlacesService(dummyDiv);
    }

    if (!placesServiceRef.current) {
      // Fallback to geocoder if PlacesService is not available
      if (window.google?.maps?.Geocoder) {
        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode({ placeId }, (results, status) => {
          if (status === window.google.maps.GeocoderStatus.OK && results && results[0]) {
            const result = results[0];
            const location = result.geometry.location;

            const addressValue: AddressValue = {
              formattedAddress: result.formatted_address,
              placeId: placeId,
              lat: location.lat(),
              lng: location.lng(),
              addressComponents: result.address_components,
            };

            setValue(addressValue);
            setInputText(addressValue.formattedAddress);
            setIsValid(true);
            setShowDropdown(false);
            setPredictions([]);
            setHasBlurred(false);
            onChange(addressValue);
          }
        });
      }
      return;
    }

    const request: google.maps.places.PlaceDetailsRequest = {
      placeId: placeId,
      fields: ["name", "formatted_address", "geometry", "address_components", "place_id"],
      language: "es",
    };

    placesServiceRef.current.getDetails(request, (place, status) => {
      if (status === window.google.maps.places.PlacesServiceStatus.OK && place) {
        const location = place.geometry?.location;
        if (location) {
          // Prefer place name (like "CEU Monteprincipe") over formatted address
          // This matches Google Maps behavior where establishments show their name
          const displayName = place.name || place.formatted_address || "";

      const addressValue: AddressValue = {
            formattedAddress: displayName,
            placeId: placeId,
            lat: location.lat(),
            lng: location.lng(),
        addressComponents: place.address_components,
      };

      setValue(addressValue);
      setInputText(addressValue.formattedAddress);
      setIsValid(true);
          setShowDropdown(false);
          setPredictions([]);
      setHasBlurred(false);
      onChange(addressValue);
        }
      }
    });
  }, [onChange]);

  // Handle prediction selection
  const handleSelectPrediction = useCallback((prediction: Prediction) => {
    if (inputRef.current) {
      inputRef.current.focus(); // Keep focus to prevent blur issues
    }
    getPlaceDetails(prediction.place_id);
  }, [getPlaceDetails]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || predictions.length === 0) {
      if (e.key === "Enter") {
        e.preventDefault();
        // If required and no value, show error
        if (required && !isValid) {
          setHasBlurred(true);
        }
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => 
          prev < predictions.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < predictions.length) {
          handleSelectPrediction(predictions[selectedIndex]);
        }
        break;
      case "Escape":
        setShowDropdown(false);
        setSelectedIndex(-1);
        break;
    }
  };

  // Handle input focus
  const handleFocus = () => {
    // Clear blur timeout if exists
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }

    if (inputText && predictions.length > 0) {
      setShowDropdown(true);
    } else if (inputText && inputText.trim().length > 0) {
      fetchPredictions(inputText);
    }
  };

  // Handle input blur
  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    // Use longer timeout to allow click events on dropdown items
    blurTimeoutRef.current = setTimeout(() => {
      // Check if focus moved to dropdown or is still in container
      const activeElement = document.activeElement;
      const relatedTarget = e.relatedTarget as HTMLElement;
      
      // If focus moved to dropdown, don't hide it
      if (dropdownRef.current && (
        dropdownRef.current.contains(activeElement) ||
        dropdownRef.current.contains(relatedTarget)
      )) {
        // Focus is in dropdown, don't hide
        return;
      }
      
      // If focus is still in container (like the clear button), don't hide
      if (containerRef.current && containerRef.current.contains(activeElement)) {
        return;
      }
      
      // Focus moved outside, hide dropdown
      setShowDropdown(false);
      setHasBlurred(true);
      
      // Validate if input matches selected value
      if (value && inputRef.current?.value !== value.formattedAddress) {
        setValue(null);
        setIsValid(false);
        onChange(null);
      }
    }, 300);
  };

  // Handle clear
  const handleClear = () => {
    if (inputRef.current) {
      inputRef.current.value = "";
      setInputText("");
      setValue(null);
      setIsValid(false);
      onChange(null);
      setHasBlurred(false);
      setPredictions([]);
      setShowDropdown(false);
      inputRef.current.focus();
    }
  };

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && dropdownRef.current) {
      const selectedElement = dropdownRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  }, [selectedIndex]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

  // Don't show error while dropdown is open, user is actively typing, or when predictions exist
  // The error should only show when:
  // 1. User has blurred the field (interacted with it)
  // 2. Field is required
  // 3. Value is not valid (no selection made)
  // 4. Dropdown is NOT showing (user is not selecting)
  // 5. No predictions exist (user can't select anything)
  // 6. Not currently fetching (give API time to respond)
  const shouldShowError = 
    (error || (hasBlurred && required && !isValid)) && 
    !showDropdown && 
    !isFetching && 
    predictions.length === 0;

  // Only show API warning if ALL of these are true:
  // 1. We have an error status
  // 2. Not currently loading or fetching  
  // 3. Dropdown is NOT showing (if showing, API works!)
  // 4. NO predictions exist (if predictions.length > 0, API IS WORKING!)
  // 5. User has typed something meaningful (at least 2 characters)
  // 6. API is not ready (if API is ready, it's working!)
  //
  // ABSOLUTE RULE: If predictions.length > 0 OR showDropdown === true OR isApiReady === true,
  // the API IS WORKING, so NEVER EVER show the error message!
  //
  // IMPORTANT: Check predictions.length FIRST - if predictions exist, API is working, so NEVER show error!
  const showApiWarning = 
    apiErrorStatus !== null && 
    !isLoading && 
    !isFetching && 
    !showDropdown && // If dropdown shows, API works!
    predictions.length === 0 && // CRITICAL: If predictions exist, API works - NEVER show error!
    inputText.trim().length >= 2 &&
    !isApiReady; // If API is ready, it's working!

  return (
    <div className={className} ref={containerRef} style={{ overflow: 'visible', position: 'relative' }}>
      {label && (
        <label
          htmlFor={id}
          className="block text-sm font-semibold text-gray-700 mb-3"
        >
          <div className="flex items-center space-x-2">
            <svg
              className="w-4 h-4 text-red-500"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                clipRule="evenodd"
              />
            </svg>
            <span>
              {label} {required && "*"}
            </span>
          </div>
        </label>
      )}

      <div className="relative" style={{ zIndex: showDropdown ? 50 : 'auto', position: 'relative' }}>
        {/* Location Icon */}
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
          <svg
            className="w-6 h-6 text-gray-400"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
              clipRule="evenodd"
            />
          </svg>
        </div>

            {/* Input Field */}
        <input
          ref={inputRef}
          id={id}
          type="text"
          placeholder={placeholder}
              value={inputText}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={handleFocus}
              onBlur={handleBlur}
              autoComplete="off"
              data-form-type="other"
              className={`w-full pl-12 pr-10 py-4 border rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-base font-medium bg-gray-50 ${
                shouldShowError
              ? "border-red-500 focus:border-red-500 focus:ring-red-500"
              : "border-gray-300"
          } ${isLoading ? "opacity-50 cursor-wait" : ""}`}
          aria-label={label || placeholder}
          aria-required={required}
              aria-invalid={shouldShowError}
              aria-describedby={shouldShowError ? `${id}-error` : undefined}
              aria-autocomplete="list"
              aria-expanded={showDropdown}
              aria-controls={showDropdown ? `${id}-dropdown` : undefined}
          disabled={isLoading}
        />

        {/* Clear button */}
        {inputText && !isLoading && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors z-10"
            aria-label="Limpiar dirección"
            onMouseDown={(e) => e.preventDefault()}
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}


        {/* Custom Dropdown Menu - HIGH Z-INDEX to appear above everything */}
        {(showDropdown && (predictions.length > 0 || isFetching)) && (
          <div
            ref={dropdownRef}
            id={`${id}-dropdown`}
            className="absolute z-[10000] w-full bg-white rounded-lg shadow-2xl border-2 border-orange-300 max-h-80 overflow-y-auto"
            style={{ 
              top: 'calc(100% + 8px)', 
              left: 0,
              right: 0,
              marginTop: '8px',
              minHeight: predictions.length > 0 ? 'auto' : '60px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
            }}
            role="listbox"
            tabIndex={-1}
            onMouseDown={(e) => {
              e.preventDefault(); // Prevent input blur when clicking dropdown
              e.stopPropagation();
              // Clear blur timeout
              if (blurTimeoutRef.current) {
                clearTimeout(blurTimeoutRef.current);
                blurTimeoutRef.current = null;
              }
            }}
            onClick={(e) => {
              e.stopPropagation(); // Prevent event bubbling
            }}
            onMouseEnter={() => {
              // Clear blur timeout when mouse enters dropdown
              if (blurTimeoutRef.current) {
                clearTimeout(blurTimeoutRef.current);
                blurTimeoutRef.current = null;
              }
            }}
          >
            {isFetching ? (
              <div className="p-4 text-center text-gray-500">
                <div className="animate-pulse">Buscando direcciones...</div>
              </div>
            ) : predictions.length > 0 ? (
              predictions.map((prediction, index) => {
                const isSelected = index === selectedIndex;
                return (
                  <button
                    key={prediction.place_id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      // Clear blur timeout
                      if (blurTimeoutRef.current) {
                        clearTimeout(blurTimeoutRef.current);
                        blurTimeoutRef.current = null;
                      }
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log("Clicked prediction:", prediction);
                      handleSelectPrediction(prediction);
                    }}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`w-full text-left px-5 py-4 flex items-center justify-between transition-all duration-150 first:rounded-t-lg last:rounded-b-lg border-b border-gray-200 last:border-b-0 cursor-pointer ${
                      isSelected
                        ? "bg-orange-50 border-l-4 border-l-orange-500"
                        : "bg-white hover:bg-orange-50 hover:border-l-4 hover:border-l-orange-300"
                    }`}
                  >
                    <div className="flex-1 min-w-0 pr-4">
                      <div className={`text-base font-semibold break-words ${
                        isSelected ? "text-orange-700" : "text-gray-900"
                      }`}>
                        {prediction.structured_formatting.main_text}
                      </div>
                      <div className="text-sm text-gray-600 break-words mt-1">
                        {prediction.structured_formatting.secondary_text}
                      </div>
                    </div>
                    <div className="ml-3 flex-shrink-0">
                      <svg
                        className={`w-5 h-5 transition-colors ${
                          isSelected ? "text-orange-500" : "text-gray-400"
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        strokeWidth={2.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                  </button>
                );
              })
            ) : null}
          </div>
        )}
      </div>

      {/* API Key Missing Warning - Only show when API truly not working AND no predictions */}
      {/* CRITICAL: Never show if dropdown is showing OR predictions exist - API is working! */}
      {showApiWarning && (
        <div className="mt-2 p-4 bg-orange-50 border-2 border-orange-300 rounded-lg relative z-10">
          <div className="flex items-start space-x-3">
            <svg className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-semibold text-orange-900 mb-1">
                Google Maps API Key Required
              </p>
              <p className="text-sm text-orange-800 mb-2">
                To use address autocomplete, you need to configure a Google Maps API key.
              </p>
              <div className="text-xs text-orange-700 space-y-1">
                <p><strong>Quick Setup:</strong></p>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>Create a file named <code className="bg-orange-100 px-1 rounded">.env.local</code> in the <code className="bg-orange-100 px-1 rounded">frontend</code> directory</li>
                  <li>Add: <code className="bg-orange-100 px-1 rounded">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_api_key_here</code></li>
                  <li>Get your API key from <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="underline font-medium">Google Cloud Console</a></li>
                  <li>Enable "Places API" and "Maps JavaScript API"</li>
                  <li>Restart your development server</li>
                </ol>
                <p className="mt-2">
                  See <code className="bg-orange-100 px-1 rounded">GOOGLE_MAPS_SETUP.md</code> for detailed instructions.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Verified badge */}
      {showVerifiedBadge && isValid && value && (
        <div className="mt-2 flex items-center space-x-1 text-sm text-green-600">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          <span className="font-medium">Dirección verificada</span>
        </div>
      )}

      {/* Error message - only show when dropdown is closed, no predictions, and not fetching */}
      {shouldShowError && (
        <p
          id={`${id}-error`}
          className="text-red-500 text-sm mt-2"
          role="alert"
        >
          {error || "Selecciona una dirección de la lista."}
        </p>
      )}

      {/* Loading state */}
      {isLoading && (
        <p className="text-gray-500 text-sm mt-2">
          Cargando sugerencias de direcciones...
        </p>
      )}
    </div>
  );
}
