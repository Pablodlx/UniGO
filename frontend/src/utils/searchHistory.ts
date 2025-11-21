// Utility functions to manage search history in localStorage

export interface SearchHistoryItem {
  address: string;
  placeId?: string;
  lat?: number;
  lng?: number;
  timestamp: number;
  fieldType: 'departure' | 'destination';
}

const SEARCH_HISTORY_KEY = 'unigo_search_history';
const MAX_HISTORY_ITEMS = 20; // Keep last 20 searches

/**
 * Get all search history items
 */
export function getSearchHistory(): SearchHistoryItem[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const stored = localStorage.getItem(SEARCH_HISTORY_KEY);
    if (!stored) return [];
    
    const history = JSON.parse(stored) as SearchHistoryItem[];
    // Sort by timestamp (most recent first)
    return history.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error('Error reading search history:', error);
    return [];
  }
}

/**
 * Get search history filtered by field type
 */
export function getSearchHistoryByField(fieldType: 'departure' | 'destination'): SearchHistoryItem[] {
  const allHistory = getSearchHistory();
  return allHistory
    .filter(item => item.fieldType === fieldType)
    .slice(0, 10); // Return max 10 items per field type
}

/**
 * Add a search to history
 */
export function addToSearchHistory(
  address: string,
  fieldType: 'departure' | 'destination',
  placeId?: string,
  lat?: number,
  lng?: number
): void {
  if (typeof window === 'undefined') return;
  
  try {
    const history = getSearchHistory();
    
    // Remove duplicates (same address and field type)
    const filtered = history.filter(
      item => !(item.address === address && item.fieldType === fieldType)
    );
    
    // Add new item at the beginning
    const newItem: SearchHistoryItem = {
      address,
      placeId,
      lat,
      lng,
      timestamp: Date.now(),
      fieldType,
    };
    
    const updated = [newItem, ...filtered].slice(0, MAX_HISTORY_ITEMS);
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Error saving search history:', error);
  }
}

/**
 * Clear all search history
 */
export function clearSearchHistory(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(SEARCH_HISTORY_KEY);
}


