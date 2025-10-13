import createMiddleware from "next-intl/middleware"
import { NextRequest, NextResponse } from "next/server"
import { routing } from "src/i18n/routing"

// Routes that require authentication - updated to match the protected route group
const protectedRoutes = [
  "/settings",
  "/developer-portal",
  "/wallet",
  "/my-flathub",
  "/donate",
  "/admin",
  "/apps/new/register",
]

// Check if route is protected
function isProtectedRoute(pathname: string): boolean {
  return protectedRoutes.some(
    (route) => pathname.includes(route) || pathname.endsWith(route),
  )
}

// Check if user is authenticated by checking session cookies
async function isAuthenticated(request: NextRequest): Promise<boolean> {
  try {
    const cookieHeader = request.headers.get("cookie")

    if (!cookieHeader) {
      return false
    }

    // Make a request to the backend to verify the session
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_BASE_URI}/auth/userinfo`,
      {
        method: "GET",
        headers: {
          Cookie: cookieHeader,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(5000), // Shorter timeout for auth checks
      },
    )

    // 204 status indicates the user is not logged in
    return response.ok && response.status !== 204
  } catch (error) {
    console.error("Auth check failed:", error)
    return false
  }
}

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Handle internationalization first

  // Then check authentication for protected routes
  if (isProtectedRoute(pathname)) {
    const authenticated = await isAuthenticated(request)

    if (!authenticated) {
      const locale = pathname.split("/")[1] || "en"
      const loginUrl = new URL(`/${locale}/login`, request.url)
      loginUrl.searchParams.set(
        "returnTo",
        pathname.replace(`/${locale}`, "") || "/",
      )

      return NextResponse.redirect(loginUrl)
    }
  }

  return createMiddleware(routing)(request) || NextResponse.next()
}

export const config = {
  // Match all pathnames except for
  // - … if they start with `/api`, `/trpc`, `/_next` or `/_vercel`
  // - … the ones containing a dot (e.g. `favicon.ico`)
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
}
