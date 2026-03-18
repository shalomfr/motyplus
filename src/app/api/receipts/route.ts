import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { issueReceipt } from "@/lib/payments/receipt-service";

// GET /api/receipts — רשימת כל הקבלות
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "לא מורשה" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "25");
    const search = searchParams.get("search") || "";

    const where = {
      hasReceipt: true,
      ...(search
        ? {
            customer: {
              OR: [
                { fullName: { contains: search, mode: "insensitive" as const } },
                { email: { contains: search, mode: "insensitive" as const } },
              ],
            },
          }
        : {}),
    };

    const [receipts, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          customer: { select: { id: true, fullName: true, email: true, phone: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.payment.count({ where }),
    ]);

    return NextResponse.json({
      receipts,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Error fetching receipts:", error);
    return NextResponse.json({ error: "שגיאה בטעינת קבלות" }, { status: 500 });
  }
}

// POST /api/receipts — הנפקת קבלה ידנית
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "לא מורשה" }, { status: 401 });
    }

    const { paymentId } = await request.json();
    if (!paymentId) {
      return NextResponse.json({ error: "חסר מזהה תשלום" }, { status: 400 });
    }

    const result = await issueReceipt(paymentId, session.user.id);
    if (!result) {
      return NextResponse.json(
        { error: "לא ניתן להנפיק קבלה — בדוק חיבור iCount" },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error issuing receipt:", error);
    return NextResponse.json({ error: "שגיאה בהנפקת קבלה" }, { status: 500 });
  }
}
