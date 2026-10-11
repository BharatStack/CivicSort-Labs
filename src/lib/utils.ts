import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Google Maps directions from the viewer's current location to a point (free Maps URL, no API key)
export function googleMapsDirectionsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
}

export const REPORT_TOKEN_PATTERN = /^CSL-\d{4}-\d{6}$/i;
