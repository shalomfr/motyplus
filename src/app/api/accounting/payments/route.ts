import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { logActivity } from "@/lib/activity-logger";
import { issueReceipt } from "@/lib/payments/receipt-service";
import { Prisma } from "@prisma/client";

// GET /api/accounting/payments — רשימת תשלומים עם סינון ודפדוף
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "לא מורשה. יש להתחבר למערכת" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status");
    const paymentMethod = searchParams.get("paymentMethod");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "25");

    const skip = (page - 1) * limit;

    // בניית תנאי סינון
    const where: Prisma.PaymentWhereInput = {};

    if (search) {
      where.customer = {
        OR: [
          { fullName: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
        ],
      };
    }

    if (status) {
      where.status = status as "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED";
    }

    if (paymentMethod) {
      where.paymentMethod = paymentMethod;
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        where.createdAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.createdAt.lte = new Date(dateTo);
      }
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          customer: { select: { id: true, fullName: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.payment.count({ where }),
    ]);

    return NextResponse.json({
      payments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching payments:", error);
    return NextResponse.json({ error: "שגיאה בטעינת תשלומים" }, { status: 500 });
  }
}

// POST /api/accounting/payments — יצירת תשלום ידני + הנפקת קבלה אוטומטית
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "לא מורשה. יש להתחבר למערכת" }, { status: 401 });
    }

    const body = await request.json();
    const { customerId, amount, description, paymentMethod } = body;

    if (!customerId || !amount) {
      return NextResponse.json({ error: "חסרים שדות חובה (לקוח וסכום)" }, { status: 400 });
    }

    if (typeof amount !== "number" || amount <= 0) {
      return NextResponse.json({ error: "סכום לא תקין" }, { status: 400 });
    }

    // בדיקה שהלקוח קיים
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      return NextResponse.json({ error: "לקוח לא נמצא" }, { status: 404 });
    }

    // יצירת תשלום
    const payment = await prisma.payment.create({
      data: {
        customerId,
        amount,
        description: description || "תשלום ידני",
        paymentMethod: paymentMethod || "cash",
        status: "COMPLETED",
      },
      include: {
        customer: { select: { id: true, fullName: true, email: true } },
      },
    });

    // הנפקת קבלה אוטומטית
    let receiptInfo = null;
    try {
      receiptInfo = await issueReceipt(payment.id, session.user.id);
    } catch (receiptError) {
      console.error("Error auto-issuing receipt:", receiptError);
      // לא נכשיל את התשלום אם הקבלה נכשלה
    }

    await logActivity({
      userId: session.user.id,
      customerId,
      action: "CREATE",
      entityType: "PAYMENT",
      entityId: payment.id,
      details: {
        amount: Number(amount),
        paymentMethod: paymentMethod || "cash",
        description: description || "תשלום ידני",
        receiptIssued: !!receiptInfo,
      },
    });

    // טעינה מחדש עם נתוני קבלה מעודכנים
    const updatedPayment = await prisma.payment.findUnique({
      where: { id: payment.id },
      include: {
        customer: { select: { id: true, fullName: true, email: true } },
      },
    });

    return NextResponse.json(updatedPayment, { status: 201 });
  } catch (error) {
    console.error("Error creating payment:", error);
    return NextResponse.json({ error: "שגיאה ביצירת תשלום" }, { status: 500 });
  }
}
