import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { logActivity } from "@/lib/activity-logger";

// POST /api/leads/[id]/convert - המרת ליד ללקוח
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: "לא מורשה. יש להתחבר למערכת" },
        { status: 401 }
      );
    }

    const { id } = await params;

    const lead = await prisma.lead.findUnique({
      where: { id },
      include: { organ: true },
    });

    if (!lead) {
      return NextResponse.json(
        { error: "הליד לא נמצא" },
        { status: 404 }
      );
    }

    if (lead.stage === "CLOSED_WON" && lead.convertedCustomerId) {
      return NextResponse.json(
        { error: "הליד כבר הומר ללקוח" },
        { status: 400 }
      );
    }

    if (lead.stage === "CLOSED_LOST") {
      return NextResponse.json(
        { error: "לא ניתן להמיר ליד שנסגר כהפסד" },
        { status: 400 }
      );
    }

    // קבלת נתונים נוספים מהבקשה (סוג סט, סכום, וכו')
    const body = await request.json();
    const {
      setTypeId,
      amountPaid,
      organId,
      address,
      whatsappPhone,
      notes,
    } = body as {
      setTypeId: string;
      amountPaid: number;
      organId?: string;
      address?: string;
      whatsappPhone?: string;
      notes?: string;
    };

    if (!setTypeId || amountPaid === undefined) {
      return NextResponse.json(
        { error: "יש לספק סוג סט וסכום ששולם" },
        { status: 400 }
      );
    }

    // חישוב תאריכי רכישה ותפוגת עדכונים
    const purchaseDate = new Date();
    const updateExpiryDate = new Date();
    updateExpiryDate.setFullYear(updateExpiryDate.getFullYear() + 1);

    // יצירת לקוח חדש מנתוני הליד
    const customer = await prisma.customer.create({
      data: {
        fullName: lead.fullName,
        phone: lead.phone,
        email: lead.email || "",
        whatsappPhone: whatsappPhone || null,
        address: address || null,
        organId: organId || lead.organId || "",
        setTypeId,
        amountPaid,
        purchaseDate,
        updateExpiryDate,
        notes: notes || null,
      },
      include: {
        organ: true,
        setType: true,
      },
    });

    // עדכון הליד - סימון כהומר
    await prisma.lead.update({
      where: { id },
      data: {
        stage: "CLOSED_WON",
        convertedCustomerId: customer.id,
      },
    });

    // רישום פעילות
    await logActivity({
      userId: session.user.id,
      customerId: customer.id,
      action: "CONVERT_LEAD",
      entityType: "LEAD",
      entityId: id,
      details: {
        leadName: lead.fullName,
        customerId: customer.id,
      },
    });

    return NextResponse.json({
      message: "הליד הומר ללקוח בהצלחה",
      customer,
      lead: { id, stage: "CLOSED_WON", convertedCustomerId: customer.id },
    });
  } catch (error) {
    console.error("Error converting lead:", error);
    return NextResponse.json(
      { error: "שגיאה בהמרת הליד ללקוח" },
      { status: 500 }
    );
  }
}
