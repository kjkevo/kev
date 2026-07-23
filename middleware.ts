import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// ── Owner-login gate (missed-call product) ────────────────────────────────
// Protects /dashboard and /admin. Uses Web Crypto (Edge runtime) and must
// produce the same HMAC as app/lib/ownerAuth.ts.

const SESSION_COOKIE = "owner_session";
const SESSION_MESSAGE = "owner-session-v1";

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function expectedToken(pw: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pw),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(SESSION_MESSAGE));
  return toHex(sig);
}

async function ownerAuthed(req: NextRequest): Promise<boolean> {
  const pw = process.env.OWNER_PASSWORD || "";
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!pw || !token) return false;
  try {
    return token === (await expectedToken(pw));
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Owner-only pages behind the owner login.
  if (
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/")
  ) {
    if (!(await ownerAuthed(req))) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // ── Existing NextAuth 2FA passthrough (dormant unless a user logs in) ──
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.next();

  const isVerifyPage = pathname === "/auth/verify-2fa";
  const isPublicPath =
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/privacy") ||
    pathname.startsWith("/gdpr") ||
    pathname.startsWith("/onboarding") ||
    pathname === "/";

  const tfDone = req.cookies.get("tf_done")?.value;

  if (token.tfPending && !tfDone && !isVerifyPage && !isPublicPath) {
    return NextResponse.redirect(new URL("/auth/verify-2fa", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
