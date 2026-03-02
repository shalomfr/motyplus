import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/settings/info — system status overview
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "לא מורשה" }, { status: 401 });

  const [totalCustomers, totalLeads] = await Promise.all([
    prisma.customer.count(),
    prisma.lead.count(),
  ]);

  return NextResponse.json({
    emailConfigured: !!process.env.SMTP2GO_API_KEY,
    driveConnected: false,
    totalCustomers,
    totalLeads,
    version: "1.0.0",
  });
}
