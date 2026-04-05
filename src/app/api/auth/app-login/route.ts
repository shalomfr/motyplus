import { NextRequest, NextResponse } from "next/server";
import { encode } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const userAgent = req.headers.get("user-agent") || "";

  // Only allow from the Android app
  if (!userAgent.includes("MottyBeatsCRM")) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Get the first admin user
  const user = await prisma.user.findFirst({
    where: { role: "ADMIN" },
  });

  if (!user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Create a NextAuth JWT token
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || "";
  const isSecure = req.url.startsWith("https");
  const cookieName = isSecure
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";

  const token = await encode({
    token: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      sub: user.id,
    },
    secret,
    salt: cookieName,
    maxAge: 30 * 24 * 60 * 60, // 30 days
  });

  // Set the session cookie on the redirect response
  const response = NextResponse.redirect(new URL("/", req.url));
  response.cookies.set(cookieName, token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });

  return response;
}
