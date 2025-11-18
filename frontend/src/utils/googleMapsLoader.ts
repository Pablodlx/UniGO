/**
 * Utility to load Google Maps JavaScript API with Places library
 * Prevents duplicate script loads
 */

let loadPromise: Promise<void> | null = null;
let isLoaded = false;

declare global {
  interface Window {
    google?: typeof google;
    initGoogleMaps?: () => void;
  }
}

export function loadGoogleMaps(): Promise<void> {
  // Return existing promise if already loading
  if (loadPromise) {
    return loadPromise;
  }

  // Return resolved promise if already loaded
  if (isLoaded && window.google?.maps?.places) {
    return Promise.resolve();
  }

  // Check if script already exists and API is available
  const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
  if (existingScript && window.google?.maps?.places) {
    isLoaded = true;
    return Promise.resolve();
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  
  // If no API key, silently fail - don't show error until user tries to use it
  if (!apiKey) {
    // Check if Google Maps is already loaded (maybe via another method)
    if (window.google?.maps?.places) {
      isLoaded = true;
      return Promise.resolve();
    }
    
    // Return a promise that resolves but doesn't actually load anything
    // This allows the component to render without errors
    // The component will show a message when user actually tries to use autocomplete
    return Promise.resolve();
  }

  loadPromise = new Promise<void>((resolve, reject) => {
    // Create script element
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&language=es&region=ES`;
    script.async = true;
    script.defer = true;
    script.id = "google-maps-script";

    script.onload = () => {
      // Wait a bit for Google Maps to initialize
      const checkInterval = setInterval(() => {
        if (window.google?.maps?.places) {
          isLoaded = true;
          clearInterval(checkInterval);
          resolve();
        }
      }, 50);

      // Timeout after 5 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        if (window.google?.maps?.places) {
          isLoaded = true;
          resolve();
        } else {
          reject(new Error("Google Maps Places library failed to load"));
        }
      }, 5000);
    };

    script.onerror = () => {
      loadPromise = null;
      reject(new Error("Failed to load Google Maps script"));
    };

    // Append to head
    document.head.appendChild(script);
  });

  return loadPromise;
}
