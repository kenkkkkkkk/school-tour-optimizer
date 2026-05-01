import { type NextRequest, NextResponse } from "next/server";

const COOKIE = "lms_admin_auth";

/**
 * Beskytter /admin og /api/admin/* med en delt adgangskode fra env-variablen
 * ADMIN_PASSWORD. Sæt denne i .env.local.
 *
 * Uden ADMIN_PASSWORD i miljøet er admin-siderne åbne (for at undgå lockout
 * under lokal udvikling uden .env.local).
 */
export function middleware(request: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD;

  // Ingen adgangskode konfigureret → beskyttelse slået fra
  if (!adminPassword) return NextResponse.next();

  const { pathname } = request.nextUrl;

  // Login-siden og auth-endepunktet er altid tilgængelige
  if (pathname === "/admin/login" || pathname.startsWith("/api/admin/auth")) {
    return NextResponse.next();
  }

  const cookie = request.cookies.get(COOKIE);
  if (cookie?.value === adminPassword) return NextResponse.next();

  // API-kald returnerer 401, UI-kald omdirigeres til login
  if (pathname.startsWith("/api/admin")) {
    return NextResponse.json({ error: "Ikke autoriseret" }, { status: 401 });
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/admin/login";
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
