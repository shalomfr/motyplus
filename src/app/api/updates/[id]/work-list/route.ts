import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/updates/[id]/work-list - רשימת לקוחות זכאים לעדכון זה
export async function GET(
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

    // בדיקה שהעדכון קיים
    const updateVersion = await prisma.updateVersion.findUnique({
      where: { id },
    });

    if (!updateVersion) {
      return NextResponse.json(
        { error: "העדכון לא נמצא" },
        { status: 404 }
      );
    }

    // קבלת רשימת לקוחות שכבר קיבלו את העדכון הזה
    const alreadyReceived = await prisma.customerUpdate.findMany({
      where: { updateVersionId: id },
      select: { customerId: true },
    });
    const alreadyReceivedIds = alreadyReceived.map((cu) => cu.customerId);

    // לקוחות זכאים:
    // - סטטוס לא חסום/מוקפא
    // - בתוך תקופת עדכונים או בסטטוס EXCEPTION
    // - לא קיבלו את העדכון הזה כבר
    const now = new Date();

    const eligibleCustomers = await prisma.customer.findMany({
      where: {
        id: { notIn: alreadyReceivedIds.length > 0 ? alreadyReceivedIds : [-1] },
        status: { notIn: ["BLOCKED", "FROZEN"] },
        OR: [
          { updateExpiryDate: { gte: now } },
          { status: "EXCEPTION" },
        ],
      },
      include: {
        organ: true,
        setType: true,
      },
      orderBy: [
        { organ: { name: "asc" } },
        { fullName: "asc" },
      ],
    });

    // קיבוץ לפי סוג אורגן
    const groupedByOrgan: Record<string, {
      organId: string;
      organName: string;
      customers: typeof eligibleCustomers;
    }> = {};

    for (const customer of eligibleCustomers) {
      const key = customer.organId;
      if (!groupedByOrgan[key]) {
        groupedByOrgan[key] = {
          organId: customer.organId,
          organName: customer.organ.name,
          customers: [],
        };
      }
      groupedByOrgan[key].customers.push(customer);
    }

    return NextResponse.json({
      updateVersion,
      totalEligible: eligibleCustomers.length,
      alreadySentCount: alreadyReceivedIds.length,
      groups: Object.values(groupedByOrgan),
    });
  } catch (error) {
    console.error("Error fetching work list:", error);
    return NextResponse.json(
      { error: "שגיאה בטעינת רשימת העבודה" },
      { status: 500 }
    );
  }
}
