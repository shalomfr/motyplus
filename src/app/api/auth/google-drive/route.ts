import { NextResponse } from "next/server";
import { getAuthUrl } from "@/lib/google-drive";

// GET /api/auth/google-drive - redirect to Google consent screen
export async function GET() {
  const url = getAuthUrl();
  return NextResponse.redirect(url);
}
