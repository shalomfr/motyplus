import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { issueReceipt } from "@/lib/payments/receipt-service";

// POST /api/customers/[id]/receipt — הנפקת קבלה ידנית ללקוח
export async function POST(
  request: NextRequest,
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

    const { amount, description } = await request.json();
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "סכום לא תקין" }, { status: 400 });
    }

    // יצירת תשלום חדש
    const payment = await prisma.payment.create({
      data: {
        customerId,
        amount,
        description: description || "תשלום",
        status: "COMPLETED",
        paymentMethod: "MANUAL",
      },
    });

    // הנפקת קבלה
    const result = await issueReceipt(payment.id, session.user.id);
    if (!result) {
      return NextResponse.json(
        { error: "התשלום נשמר אך לא ניתן להנפיק קבלה — בדוק חיבור iCount" },
        { status: 207 }
      );
    }

    return NextResponse.json({ paymentId: payment.id, ...result });
  } catch (error) {
    console.error("Error issuing receipt for customer:", error);
    return NextResponse.json({ error: "שגיאה בהנפקת קבלה" }, { status: 500 });
  }
}
