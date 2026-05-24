import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const { pathname } = req.nextUrl;

  // Unauthenticated — let NextAuth handle it
  if (!token) return NextResponse.next();

  // If 2FA is pending and the user hasn't completed it yet
  const isVerifyPage = pathname === "/auth/verify-2fa";
  const isPublicPath =
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/api/auth/verify-2fa");

  const tfDone = req.cookies.get("tf_done")?.value;

  if (token.tfPending && !tfDone && !isVerifyPage && !isPublicPath) {
    return NextResponse.redirect(new URL("/auth/verify-2fa", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
