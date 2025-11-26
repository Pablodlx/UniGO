/**
 * Validates if a user profile is complete with all required fields.
 * 
 * @param user - User profile object with fields: full_name, university, degree, course, home_address
 * @returns true if profile is complete, false otherwise
 */
export function isProfileComplete(user: {
  full_name?: string | null;
  university?: string | null;
  degree?: string | null;
  course?: number | null;
  home_address?: {
    formatted_address: string;
    place_id: string;
    lat: number;
    lng: number;
  } | null;
} | null | undefined): boolean {
  if (!user) return false;

  // Check full_name
  if (!user.full_name || !user.full_name.trim()) {
    return false;
  }

  // Check university
  if (!user.university || !user.university.trim()) {
    return false;
  }

  // Check degree
  if (!user.degree || !user.degree.trim()) {
    return false;
  }

  // Check course
  if (!user.course || user.course <= 0) {
    return false;
  }

  // Check home_address - all fields must be present
  if (
    !user.home_address ||
    !user.home_address.formatted_address ||
    !user.home_address.place_id ||
    user.home_address.lat === null ||
    user.home_address.lat === undefined ||
    user.home_address.lng === null ||
    user.home_address.lng === undefined
  ) {
    return false;
  }

  return true;
}

