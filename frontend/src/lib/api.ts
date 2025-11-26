// frontend/src/lib/api.ts

// --- Helpers de token ---
export function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token"); // cambia la clave si usas otra
}

export function getCurrentUserId(): number | null {
  const token = getToken();
  if (!token) return null;
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    const decoded = JSON.parse(jsonPayload);
    return parseInt(decoded.sub);
  } catch (error) {
    console.error("Error decoding token:", error);
    return null;
  }
}

export function setToken(token: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem("token", token);
}

export function clearToken() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("token");
}

export function authHeaders() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

// --- Base API ---
const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000/api";

// --- Fetch helper con manejo de 401/errores ---
async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  try {
    console.log("Fetching:", url);
    const r = await fetch(url, {
      // evita caches agresivos del navegador con el App Router
      cache: "no-store",
      ...init,
      headers: {
        ...(init?.headers || {}),
      },
    });

    console.log("Response status:", r.status);

    if (r.status === 401) {
      // útil para redirigir al login en la UI
      const msg = await r.text().catch(() => "");
      throw new Error(msg || "UNAUTHORIZED");
    }
    if (!r.ok) {
      let errorText = "";
      try {
        errorText = await r.text();
      } catch (e) {
        errorText = `HTTP ${r.status} ${r.statusText}`;
      }
      console.error("Request failed:", r.status, r.statusText, errorText);
      
      // Try to parse as JSON if possible
      let errorMessage = errorText;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.detail || errorJson.message || errorText;
      } catch {
        // Not JSON, use text as is
      }
      
      const error = new Error(errorMessage || `HTTP ${r.status}`);
      (error as any).status = r.status;
      (error as any).statusText = r.statusText;
      throw error;
    }
  
  // Handle empty responses (like 204 No Content)
  const contentType = r.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    return null as T;
  }
  
  // Check if response has content before trying to parse JSON
  const text = await r.text();
  if (!text) {
    return null as T;
  }
  
  try {
    return JSON.parse(text);
  } catch (e) {
    console.error("JSON parse error:", e, "Response:", text);
    throw new Error(`Invalid JSON response: ${text}`);
  }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Fetch error:", error, "URL:", url, "Error message:", errorMessage);
    if (errorMessage.includes("Failed to fetch") || errorMessage === "Failed to fetch") {
      throw new Error(`Network error: Could not reach ${url}. Is the backend running?`);
    }
    throw error;
  }
}

// --- Auth: login ---
export type LoginResponse = { access_token?: string; token?: string; [k: string]: unknown };

export async function login(email: string, password: string): Promise<string> {
  const data = await fetchJson<LoginResponse>(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const tok = data.access_token ?? (data.token as string | undefined);
  if (!tok) throw new Error("Token no recibido del backend");
  setToken(tok);
  return tok;
}

// --- Auth: register ---
export async function register(email: string, password: string): Promise<void> {
  await fetchJson<void>(`${BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

// --- Auth: verify email ---
export async function verifyEmail(email: string, code: string): Promise<string> {
  const data = await fetchJson<LoginResponse>(`${BASE}/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code }),
  });
  const tok = data.access_token ?? (data.token as string | undefined);
  if (!tok) throw new Error("Token no recibido del backend");
  setToken(tok);
  return tok;
}

// --- Perfil ---
export type ProfilePayload = {
  full_name: string;
  university?: string; // Auto-detected from email, not required in updates
  degree: string;
  course: number;
  home_address: {
    formatted_address: string;
    place_id: string;
    lat: number;
    lng: number;
  } | null;
};

export async function getProfile() {
  return fetchJson<{
    id: number;
    email: string;
    full_name: string;
    university?: string;
    degree?: string;
    course?: number;
    home_address?: {
      formatted_address: string;
      place_id: string;
      lat: number;
      lng: number;
    };
    avatar_url?: string;
    average_rating: number | null;
    rating_count: number;
  }>(`${BASE}/me/profile`, {
    headers: { ...authHeaders() },
  });
}

export interface UserProfile {
  email: string;
  full_name: string | null;
  university: string | null;
  degree: string | null;
  course: number | null;
  home_address: {
    formatted_address: string;
    place_id: string;
    lat: number;
    lng: number;
  } | null;
  avatar_url: string | null;
  average_rating: number | null;
  rating_count: number;
  average_rating_display: string;
}

export async function getUserProfile(userId: number): Promise<UserProfile> {
  return fetchJson<UserProfile>(`${BASE}/me/user/${userId}/profile`, {
    headers: { ...authHeaders() },
  });
}

export async function updateProfile(payload: ProfilePayload) {
  return fetchJson<{
    id: number;
    email: string;
    full_name: string;
    university?: string;
    degree?: string;
    course?: number;
    home_address?: {
      formatted_address: string;
      place_id: string;
      lat: number;
      lng: number;
    } | null;
    avatar_url?: string;
    average_rating: number | null;
    rating_count: number;
  }>(`${BASE}/me/profile`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  });
}

export async function uploadAvatar(file: File) {
  const form = new FormData();
  form.append("file", file);
  return fetchJson<{
    id: number;
    email: string;
    full_name: string;
    university?: string;
    degree?: string;
    course?: number;
    home_address?: {
      formatted_address: string;
      place_id: string;
      lat: number;
      lng: number;
    } | null;
    avatar_url?: string;
    average_rating: number | null;
    rating_count: number;
  }>(`${BASE}/me/avatar`, {
    method: "POST",
    headers: { ...authHeaders() }, // NO pongas Content-Type, lo gestiona el browser
    body: form,
  });
}

// --- Utilidad para comprobar si el perfil está completo (RF-02) ---
export function isProfileComplete(p: {
  full_name?: string;
  university?: string;
  degree?: string;
  course?: number;
  home_address?: {
    formatted_address?: string;
    place_id?: string;
  } | null;
}): boolean {
  return Boolean(
    p &&
      p.full_name &&
      p.university &&
      p.degree &&
      typeof p.course === "number" &&
      p.course >= 1 &&
      p.home_address &&
      p.home_address.formatted_address &&
      p.home_address.place_id
  );
}

// --- Rides ---
export interface PassengerInfo {
  id: number;
  name: string;
  avatar_url?: string | null;
}

export interface Ride {
  id: number;
  driver_id: number;
  driver_name: string;
  driver_university?: string;
  driver_average_rating?: number;
  departure_city: string;
  destination_city: string;
  departure_lat?: number | null;
  departure_lng?: number | null;
  destination_lat?: number | null;
  destination_lng?: number | null;
  departure_date: string;
  departure_time: string;
  arrival_time?: string; // "HH:MM" format, calculated from departure_time + duration
  available_seats: number;
  price_per_seat: number;
  vehicle_brand?: string;
  vehicle_color?: string;
  additional_details?: string;
  estimated_duration_minutes?: number;
  is_active: boolean;
  created_at: string;
  reserved_by_user_id?: number | null; // ID of the first passenger with confirmed booking
  passengers?: PassengerInfo[]; // List of all confirmed passengers
  passengers_ids?: number[]; // List of all confirmed passenger IDs
  booking_status?: string | null; // Status of the booking: "pending", "confirmed", "rejected"
}

export async function searchRides(params: {
  departure_city?: string;
  destination_city?: string;
  departure_date?: string;
}): Promise<Ride[]> {
  const queryParams = new URLSearchParams();
  if (params.departure_city) queryParams.append('departure_city', params.departure_city);
  if (params.destination_city) queryParams.append('destination_city', params.destination_city);
  if (params.departure_date) queryParams.append('departure_date', params.departure_date);

  return fetchJson<Ride[]>(`${BASE}/rides/search?${queryParams.toString()}`);
}

export async function getRide(ride_id: number): Promise<Ride> {
  return fetchJson<Ride>(`${BASE}/rides/${ride_id}`);
}

export async function getMyRides(): Promise<Ride[]> {
  return fetchJson<Ride[]>(`${BASE}/rides/my-rides`, {
    headers: { ...authHeaders() },
  });
}

export async function getMyBookings(): Promise<Ride[]> {
  return fetchJson<Ride[]>(`${BASE}/rides/my-bookings`, {
    headers: { ...authHeaders() },
  });
}

export async function cancelRide(ride_id: number): Promise<void> {
  return fetchJson<void>(`${BASE}/rides/${ride_id}/cancel`, {
    method: "POST",
    headers: { ...authHeaders() },
  });
}

export async function cancelBooking(ride_id: number): Promise<void> {
  return fetchJson<void>(`${BASE}/rides/${ride_id}/cancel-booking`, {
    method: "POST",
    headers: { ...authHeaders() },
  });
}

export interface Passenger {
  booking_id: number;
  passenger_id: number;
  passenger_name: string;
  passenger_avatar?: string | null;
  has_rated: boolean;
  can_rate: boolean;
}

export interface RideHistoryItem extends Ride {
  role: "conductor" | "pasajero";
  status?: "cancelled" | "completed";
  booking_id?: number;
  has_rated?: boolean;
  can_rate?: boolean;
  passenger_name?: string; // For drivers: name of the passenger they can rate (deprecated - use passengers array)
  rated_user_id?: number; // ID of the user being rated
  rated_user_name?: string; // Name of the user being rated
  rated_user_avatar?: string | null; // Avatar URL of the user being rated
  // For driver rides: array of passengers with rating status
  passengers?: Passenger[];
  has_pending_ratings?: boolean; // True if there are passengers pending to rate
}

export async function getRideHistory(): Promise<RideHistoryItem[]> {
  return fetchJson<RideHistoryItem[]>(`${BASE}/rides/registro`, {
    headers: { ...authHeaders() },
  });
}

export interface CreateRatingRequest {
  booking_id: number;
  rating: number; // 1-5
  comment?: string;
}

export interface RatingResponse {
  id: number;
  booking_id: number;
  rater_id: number;
  rated_id: number;
  rating: number;
  comment?: string;
  created_at: string;
}

export async function createRating(data: CreateRatingRequest): Promise<RatingResponse> {
  return fetchJson<RatingResponse>(`${BASE}/ratings/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(data),
  });
}

// --- New Rating System (by ride_id) ---
export interface CreateRatingByRideRequest {
  ride_id: number;
  rated_id: number;
  score: number; // 1-5
  comment?: string;
}

export interface HasRatedResponse {
  hasRated: boolean;
}

export async function hasRated(rideId: number, raterId: number, ratedId: number): Promise<boolean> {
  try {
    const response = await fetchJson<HasRatedResponse>(
      `${BASE}/ratings/has-rated?ride_id=${rideId}&rater_id=${raterId}&rated_id=${ratedId}`,
      {
        headers: { ...authHeaders() },
      }
    );
    return response.hasRated;
  } catch (error) {
    console.error("Error checking if rated:", error);
    return false;
  }
}

export async function createRatingByRide(data: CreateRatingByRideRequest): Promise<{ status: string; message: string }> {
  return fetchJson<{ status: string; message: string }>(`${BASE}/ratings/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(data),
  });
}

// --- User Ratings ---
export interface UserRatingItem {
  score: number;
  comment: string | null;
  ride_id: number;
  created_at: string;
}

export interface UserRatingsResponse {
  average: number;
  count: number;
  ratings: UserRatingItem[];
}

export async function getUserRatings(userId: number): Promise<UserRatingsResponse> {
  return fetchJson<UserRatingsResponse>(`${BASE}/ratings/user/${userId}`, {
    headers: { ...authHeaders() },
  });
}

// --- Favorite Rides ---
export interface FavoriteRide {
  id: number;
  user_id: number;
  name: string;
  departure_city: string;
  destination_city: string;
  departure_lat?: number;
  departure_lng?: number;
  destination_lat?: number;
  destination_lng?: number;
  departure_time?: string;
  available_seats?: number;
  price_per_seat?: number;
  vehicle_brand?: string;
  vehicle_color?: string;
  additional_details?: string;
  from_address?: {
    placeId?: string;
    formattedAddress: string;
    lat: number;
    lng: number;
  };
  to_address?: {
    placeId?: string;
    formattedAddress: string;
    lat: number;
    lng: number;
  };
  created_at: string;
  updated_at: string;
}

export interface CreateFavoriteRideRequest {
  name: string;
  departure_city: string;
  destination_city: string;
  departure_lat?: number;
  departure_lng?: number;
  destination_lat?: number;
  destination_lng?: number;
  departure_time?: string;
  available_seats?: number;
  price_per_seat?: number;
  vehicle_brand?: string;
  vehicle_color?: string;
  additional_details?: string;
  from?: {
    placeId?: string;
    formattedAddress: string;
    lat: number;
    lng: number;
  };
  to?: {
    placeId?: string;
    formattedAddress: string;
    lat: number;
    lng: number;
  };
}

export async function createFavoriteRide(data: CreateFavoriteRideRequest): Promise<FavoriteRide> {
  return fetchJson<FavoriteRide>(`${BASE}/rides/favorites`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(data),
  });
}

export async function getFavoriteRides(): Promise<FavoriteRide[]> {
  return fetchJson<FavoriteRide[]>(`${BASE}/rides/favorites`, {
    headers: { ...authHeaders() },
  });
}

export async function getFavoriteRide(favorite_id: number): Promise<FavoriteRide> {
  return fetchJson<FavoriteRide>(`${BASE}/rides/favorites/${favorite_id}`, {
    headers: { ...authHeaders() },
  });
}

export async function deleteFavoriteRide(favorite_id: number): Promise<void> {
  return fetchJson<void>(`${BASE}/rides/favorites/${favorite_id}`, {
    method: "DELETE",
    headers: { ...authHeaders() },
  });
}

// --- Chat ---
export interface ChatMessage {
  id: number;
  trip_id: number;
  sender_id: number;
  receiver_id: number;
  sender_name: string;
  receiver_name: string;
  message: string;
  timestamp: string;
}

export interface SendMessageRequest {
  trip_id: number;
  sender_id: number;
  receiver_id: number;
  message: string;
}

export async function sendMessage(data: SendMessageRequest): Promise<ChatMessage> {
  return fetchJson<ChatMessage>(`${BASE}/chat/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(data),
  });
}

export async function getMessages(trip_id: number): Promise<ChatMessage[]> {
  return fetchJson<ChatMessage[]>(`${BASE}/chat/messages?trip_id=${trip_id}`, {
    headers: { ...authHeaders() },
  });
}

// --- Unread Messages Summary ---
export interface ChatUnreadInfo {
  chat_id: number;
  trip_id: number;
  trip_title: string;
  other_user_name: string;
  other_user_id: number;
  unread_count: number;
  last_message_id: number;
  last_message_at?: string;
  is_group_chat?: boolean;
}

export interface UnreadSummaryResponse {
  total_unread: number;
  max_message_id: number;
  chats: ChatUnreadInfo[];
}

export async function getUnreadSummary(): Promise<UnreadSummaryResponse> {
  return fetchJson<UnreadSummaryResponse>(`${BASE}/chat/unread-summary`, {
    headers: { ...authHeaders() },
  });
}

export async function markChatAsRead(chat_id: number): Promise<void> {
  return fetchJson<void>(`${BASE}/chat/${chat_id}/mark-read`, {
    method: "POST",
    headers: { ...authHeaders() },
  });
}

export async function getRidePassengers(ride_id: number): Promise<Passenger[]> {
  return fetchJson<Passenger[]>(`${BASE}/rides/${ride_id}/passengers`, {
    headers: { ...authHeaders() },
  });
}

// --- Trip Group Chat ---
export interface TripGroupMessage {
  id: number;
  trip_id: number;
  sender_id: number;
  sender_name: string;
  message: string;
  timestamp: string;
}

export interface SendTripMessageRequest {
  trip_id: number;
  message: string;
}

export async function sendTripMessage(data: SendTripMessageRequest): Promise<TripGroupMessage> {
  return fetchJson<TripGroupMessage>(`${BASE}/trip-chat/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(data),
  });
}

export async function getTripMessages(trip_id: number): Promise<TripGroupMessage[]> {
  return fetchJson<TripGroupMessage[]>(`${BASE}/trip-chat/messages?trip_id=${trip_id}`, {
    headers: { ...authHeaders() },
  });
}

// --- Unread Notifications ---
export interface UnreadNotificationMessage {
  id: number;
  sender_id: number;
  sender_name: string;
  message: string;
  timestamp: number;
  trip_id: number;
  trip_title: string;
}

export interface UnreadNotificationsResponse {
  unread: boolean;
  latest_message_timestamp: number;
  messages: UnreadNotificationMessage[];
}

export async function getUnreadNotifications(): Promise<UnreadNotificationsResponse> {
  return fetchJson<UnreadNotificationsResponse>(`${BASE}/trip-chat/unread`, {
    headers: { ...authHeaders() },
  });
}

// --- Ride Passengers Management (Driver) ---
export interface DriverPassengerInfo {
  id: number;
  full_name: string;
  rating: number;
  avatar_url: string | null;
}

// --- Ride Confirmed Users (reusing trip-chat logic) ---
export interface ConfirmedUser {
  id: number;
  full_name: string;
  rating: number | null;
  avatar_url: string | null;
  is_driver: boolean;
}

export async function getRideConfirmedUsers(rideId: number): Promise<ConfirmedUser[]> {
  // Reutilizar el mismo fetch que usa el chat grupal
  return fetchJson<ConfirmedUser[]>(`${BASE}/rides/${rideId}/confirmed-users`, {
    headers: { ...authHeaders() },
  });
}

export async function removePassengerFromRide(
  rideId: number,
  userId: number,
  token: string
): Promise<boolean> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || BASE}/api/rides/${rideId}/passengers/${userId}`,
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = await res.json();
    return data?.success === true;
  } catch (err) {
    console.error("Error removing passenger:", err);
    return false;
  }
}

export async function freeSeat(rideId: number, token: string): Promise<{ success: boolean; available_seats?: number }> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || BASE}/api/rides/${rideId}/free-seat`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!res.ok) {
      return { success: false };
    }

    const data = await res.json();
    return data;
  } catch (err) {
    console.error("Error freeing seat:", err);
    return { success: false };
  }
}

// --- Pending Bookings (Driver) ---
export interface PendingRequestInfo {
  booking_id: number;
  passenger_id: number;
  passenger_name: string;
  passenger_rating: number | null;
  passenger_avatar_url: string | null;
  seats: number;
}

export interface PendingRideInfo {
  ride_id: number;
  ride_title: string;
  date: string;
  requests: PendingRequestInfo[];
}

export interface PendingSummaryRide {
  ride_id: number;
  ride_title: string;
  pending_count: number;
}

export interface PendingSummaryResponse {
  total_pending: number;
  rides: PendingSummaryRide[];
}

export async function getPendingBookingsForDriver(): Promise<PendingRideInfo[]> {
  return fetchJson<PendingRideInfo[]>(`${BASE}/bookings/pending-for-driver`, {
    headers: { ...authHeaders() },
  });
}

export async function getPendingSummary(): Promise<PendingSummaryResponse> {
  return fetchJson<PendingSummaryResponse>(`${BASE}/bookings/pending-summary`, {
    headers: { ...authHeaders() },
  });
}

export async function acceptBooking(bookingId: number): Promise<{ success: boolean; status: string; available_seats?: number }> {
  return fetchJson<{ success: boolean; status: string; available_seats?: number }>(
    `${BASE}/bookings/${bookingId}/accept`,
    {
      method: "POST",
      headers: { ...authHeaders() },
    }
  );
}

export async function rejectBooking(bookingId: number): Promise<{ success: boolean; status: string }> {
  return fetchJson<{ success: boolean; status: string }>(
    `${BASE}/bookings/${bookingId}/reject`,
    {
      method: "POST",
      headers: { ...authHeaders() },
    }
  );
}

// --- System Notifications ---
export interface SystemNotification {
  id: number;
  type: string;
  message: string;
  ride_id: number | null;
  created_at: string;
  read_at: string | null;
}

export async function getSystemNotifications(): Promise<SystemNotification[]> {
  return fetchJson<SystemNotification[]>(`${BASE}/notifications`, {
    headers: { ...authHeaders() },
  });
}
