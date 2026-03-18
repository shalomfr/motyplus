import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { syncCustomerToICount } from "@/lib/payments/receipt-service";

// POST /api/customers/[id]/sync-icount — סנכרון לקוח ל-iCount
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "לא מורשה" }, { status: 401 });
    }

    const { id } = await params;
    const customerId = parseInt(id);
    if (isNaN(customerId)) {
      return NextResponse.json({ error: "מזהה לקוח לא תקין" }, { status: 400 });
    }

    const clientId = await syncCustomerToICount(customerId);
    if (!clientId) {
      return NextResponse.json(
        { error: "לא ניתן לסנכרן — בדוק חיבור ספק חיוב" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, icountClientId: clientId });
  } catch (error) {
    console.error("Error syncing customer:", error);
    return NextResponse.json({ error: "שגיאה בסנכרון" }, { status: 500 });
  }
}
