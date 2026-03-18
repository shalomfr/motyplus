import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getICountClientById } from "@/lib/icount";

// POST /api/integrations/billing/test — בדיקת חיבור
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "לא מורשה" }, { status: 401 });
    }

    const { providerId } = await request.json();
    if (!providerId) {
      return NextResponse.json({ error: "חסר מזהה ספק" }, { status: 400 });
    }

    const icount = await getICountClientById(providerId);

    if (!icount) {
      return NextResponse.json({ error: "ספק לא נמצא" }, { status: 404 });
    }

    const result = await icount.client.testConnection();

    if (result.success) {
      await prisma.billingProvider.update({
        where: { id: icount.provider.id },
        data: { lastSyncAt: new Date(), lastError: null },
      });
      return NextResponse.json({ success: true, message: "החיבור תקין" });
    } else {
      const errorMsg = result.error || "התחברות נכשלה — בדוק פרטי גישה";
      console.error("iCount connection test failed:", errorMsg);
      await prisma.billingProvider.update({
        where: { id: icount.provider.id },
        data: { lastError: errorMsg },
      });
      return NextResponse.json({ success: false, message: errorMsg }, { status: 400 });
    }
  } catch (error) {
    console.error("Error testing billing connection:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "שגיאה בבדיקת חיבור" },
      { status: 500 }
    );
  }
}
