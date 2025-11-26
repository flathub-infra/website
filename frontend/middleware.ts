import { NextRequest, NextResponse } from "next/server"
import { detectLocale } from "src/i18n/locale-detector"

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
  const { locale, localeInPath } = detectLocale(request)

  const localizedPathname = localeInPath
    ? pathname
    : `/${locale}${pathname === "/" ? "/" : pathname}`

  const response = localeInPath
    ? NextResponse.next()
    : NextResponse.rewrite(new URL(localizedPathname, request.url))

  if (isProtectedRoute(localizedPathname)) {
    const authenticated = await isAuthenticated(request)

    if (!authenticated) {
      const loginUrl = new URL(`/${locale}/login`, request.url)
      loginUrl.searchParams.set(
        "returnTo",
        localeInPath
          ? pathname.replace(`/${locale}`, "") || "/"
          : pathname || "/",
      )

      return withVaryHeaders(
        persistDetectedLocale(
          NextResponse.redirect(loginUrl),
          localeInPath,
          locale,
        ),
      )
    }
  }

  // If no redirect needed, let request continue
  return withVaryHeaders(
    persistDetectedLocale(response, localeInPath, locale),
  )
}

const persistDetectedLocale = (
  response: NextResponse,
  localeInPath: boolean,
  locale: string,
) => {
  if (localeInPath) {
    return response
  }

  response.cookies.set("NEXT_LOCALE", locale, {
    sameSite: "strict",
    maxAge: 31536000,
    path: "/",
  })
  response.headers.set("x-detected-locale", locale)

  return response
}

const withVaryHeaders = (response: NextResponse) => {
  const vary = response.headers.get("Vary")
  const values = new Set(
    (vary ? vary.split(",") : [])
      .map((value) => value.trim())
      .filter(Boolean),
  )

  values.add("Cookie")
  values.add("Accept-Language")

  response.headers.set("Vary", Array.from(values).join(", "))

  return response
}

export const config = {
  // Match all pathnames except for
  // - … if they start with `/api`, `/trpc`, `/_next` or `/_vercel`
  // - … the ones containing a dot (e.g. `favicon.ico`)
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
}
