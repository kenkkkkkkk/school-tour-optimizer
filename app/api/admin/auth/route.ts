import { NextResponse } from "next/server";

const COOKIE = "lms_admin_auth";
const ONE_YEAR = 60 * 60 * 24 * 365;

/** POST /api/admin/auth  — body: { password: string, next?: string } */
export async function POST(request: Request) {
  const { password, next } = await request.json() as { password?: string; next?: string };
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword || password !== adminPassword) {
    return NextResponse.json({ error: "Forkert adgangskode" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true, next: next ?? "/admin" });
  response.cookies.set(COOKIE, adminPassword, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ONE_YEAR,
    path: "/",
  });
  return response;
}

/** DELETE /api/admin/auth  — log ud */
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(COOKIE);
  return response;
}
