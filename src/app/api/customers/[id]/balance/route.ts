import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getCustomerBalanceDetails } from "@/lib/services/customer-balance.service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "לא מורשה" }, { status: 401 });
    }

    const { id } = await params;
    const customerId = parseInt(id, 10);
    if (isNaN(customerId)) {
      return NextResponse.json({ error: "מזהה לקוח לא תקין" }, { status: 400 });
    }

    const details = await getCustomerBalanceDetails(customerId);
    if (!details) {
      return NextResponse.json({ error: "לקוח לא נמצא" }, { status: 404 });
    }

    return NextResponse.json(details);
  } catch (error) {
    console.error("Error fetching customer balance:", error);
    return NextResponse.json({ error: "שגיאה בטעינת מצב חוב" }, { status: 500 });
  }
}
