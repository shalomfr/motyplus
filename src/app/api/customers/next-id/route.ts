import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/customers/next-id — מספר הלקוח הבא שייווצר
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "לא מורשה" }, { status: 401 });
    }

    const result = await prisma.$queryRaw<{ last_value: bigint }[]>`
      SELECT last_value FROM "Customer_id_seq"
    `;
    const nextId = Number(result[0]?.last_value || 0) + 1;

    return NextResponse.json({ nextId });
  } catch (error) {
    console.error("Error getting next customer ID:", error);
    return NextResponse.json({ nextId: null });
  }
}
