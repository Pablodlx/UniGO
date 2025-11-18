# Google Maps Places Autocomplete Setup

## Environment Variable

Add the following environment variable to your `.env.local` file:

```bash
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_api_key_here
```

### Getting a Google Maps API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Places API** and **Maps JavaScript API**
4. Go to "Credentials" and create an API key
5. (Recommended) Restrict the API key to only the APIs you need and to your domain

## Country Restriction

By default, the address autocomplete is restricted to Spain (`["ES"]`). This can be customized when using the `AddressAutocomplete` component:

```tsx
<AddressAutocomplete
  id="address-input"
  restrictions={{ country: ["ES", "PT"] }} // Allow Spain and Portugal
  // ... other props
/>
```

To allow all countries, pass an empty array or omit the `restrictions` prop:

```tsx
<AddressAutocomplete
  id="address-input"
  restrictions={{ country: [] }} // No country restriction
  // ... other props
/>
```

## Usage

The `AddressAutocomplete` component is used in:

- **Home page search form** (`/src/app/page.tsx`)
- **Post ride form** (`/src/app/post-ride/page.tsx`)

Both forms now require users to select a valid address from Google Places suggestions, ensuring data consistency and accuracy.

## Data Structure

When an address is selected, the component returns an `AddressValue` object:

```typescript
{
  formattedAddress: string;  // Human-readable address
  placeId: string;            // Google Places place_id (canonical identifier)
  lat: number;               // Latitude
  lng: number;               // Longitude
  addressComponents?: google.maps.GeocoderAddressComponent[]; // Optional detailed components
}
```

This data is sent to the backend when submitting forms, allowing the backend to use either the `placeId` or coordinates as needed.








