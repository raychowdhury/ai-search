import { NextResponse, type NextRequest } from "next/server";

// Optimistic check only: the presence of a session cookie. Real verification
// happens in requireUser() on every protected page and action.
const SESSION_COOKIE = "aivc_session";

export function proxy(request: NextRequest) {
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  if (!hasSession) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/onboarding/:path*",
    "/questions/:path*",
    "/dashboard/:path*",
    "/report/:path*",
    "/actions/:path*",
    "/history/:path*",
    "/settings/:path*",
    "/run/:path*",
  ],
};
