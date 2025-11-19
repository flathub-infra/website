export function getApiBaseUrl(): string {
  if (typeof window === "undefined") {
    // Server-side: use internal backend URL
    return process.env.API_BASE_URI || "http://backend:8000"
  }
  // Client-side: use public endpoint
  return process.env.NEXT_PUBLIC_API_BASE_URI || "https://flathub.org/api/v2"
}
