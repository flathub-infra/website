export function getApiBaseUrl(): string {
  if (typeof window === "undefined") {
    // During build, backend isn't available, so use public API
    const isBuildTime = process.env.NEXT_PHASE === "phase-production-build"
    if (isBuildTime) {
      return (
        process.env.NEXT_PUBLIC_API_BASE_URI || "https://flathub.org/api/v2"
      )
    }

    // Server-side runtime: use internal backend URL
    return process.env.API_BASE_URI || "http://backend:8000"
  }
  // Client-side: use public endpoint
  return process.env.NEXT_PUBLIC_API_BASE_URI || "https://flathub.org/api/v2"
}
