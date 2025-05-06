import fetch from 'node-fetch';

interface GeocodingResult {
  lat: number;
  lon: number;
}

interface NominatimResponse {
  lat: string;
  lon: string;
  display_name: string;
}

export async function geocodeAddress(address: string, city: string, postalCode: string): Promise<GeocodingResult> {
  try {
    // Format address components and ensure proper encoding
    const formattedAddress = `${address}, ${postalCode} ${city}, Morocco`
      .split(' ')
      .filter(Boolean)
      .join(' ');
    
    const encodedAddress = encodeURIComponent(formattedAddress);
    
    // Construct the Nominatim URL with proper parameters for Morocco
    const url = `https://nominatim.openstreetmap.org/search` +
      `?format=json` +
      `&q=${encodedAddress}` +
      // `&countrycodes=ma` + // Restrict to Morocco (MA is the ISO country code)
      `&limit=1` +
      `&addressdetails=1`;
    
    // Add delay to respect Nominatim's usage policy (1 request per second)
    await new Promise(resolve => setTimeout(resolve, 1000));

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'FoodSaver/1.0 (contact@foodsaver.com)',
        'Accept': 'application/json',
        'Accept-Language': 'ar,fr' // Prefer Arabic and French results for Morocco
      },
      timeout: 5000 // 5 second timeout
    });

    if (!response.ok) {
      console.error('Nominatim API response:', await response.text());
      throw new Error(`Geocoding service failed with status: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json() as NominatimResponse[];
    
    if (!data || data.length === 0) {
      throw new Error('Address not found. Please verify your address information.');
    }

    const lat = parseFloat(data[0].lat);
    const lon = parseFloat(data[0].lon);

    // Validate coordinates are within Morocco's bounding box
    // Morocco's approximate bounding box: lat(27.6666, 35.9166), lon(-13.1683, -0.9983)
    if (lat < 27.6666 || lat > 35.9166 || lon < -13.1683 || lon > -0.9983) {
      throw new Error('Address appears to be outside of Morocco');
    }

    return {
      lat,
      lon
    };
  } catch (error) {
    console.error('Geocoding error details:', {
      address,
      city,
      postalCode,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    if (error instanceof Error) {
      throw new Error(`Failed to geocode address: ${error.message}`);
    }
    throw new Error('Failed to geocode address: Unknown error occurred');
  }
}