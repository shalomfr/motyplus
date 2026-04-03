import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

const ALLOWED_ORIGINS = [
  "https://motty-beats-order.onrender.com",
  "http://localhost:3001",
];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const origin = req.headers.get("origin") || "";

  // Handle CORS preflight for public API routes
  if (req.method === "OPTIONS" && pathname.startsWith("/api/public")) {
    const res = new NextResponse(null, { status: 204 });
    if (ALLOWED_ORIGINS.includes(origin)) {
      res.headers.set("Access-Control-Allow-Origin", origin);
      res.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.headers.set("Access-Control-Allow-Headers", "Content-Type");
      res.headers.set("Access-Control-Max-Age", "86400");
    }
    return res;
  }

  // Allow public routes
  const publicPaths = ["/login", "/api/auth", "/order", "/upload-info", "/api/public", "/api/webhooks", "/pay"];
  const isPublicPath = publicPaths.some((path) => pathname.startsWith(path));

  if (isPublicPath) {
    const res = NextResponse.next();
    // Add CORS headers for public API responses
    if (pathname.startsWith("/api/public") && ALLOWED_ORIGINS.includes(origin)) {
      res.headers.set("Access-Control-Allow-Origin", origin);
    }
    return res;
  }

  // Redirect unauthenticated users to login
  if (!req.auth) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
