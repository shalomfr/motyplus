import { NextRequest, NextResponse } from "next/server";
import { encode } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

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
  const token = await encode({
    token: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      sub: user.id,
    },
    secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || "",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  });

  // Set the session cookie and redirect to dashboard
  const cookieStore = await cookies();
  const isSecure = req.url.startsWith("https");
  const cookieName = isSecure
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";

  cookieStore.set(cookieName, token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });

  return NextResponse.redirect(new URL("/", req.url));
}
