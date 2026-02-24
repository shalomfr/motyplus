import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { logActivity } from "@/lib/activity-logger";

// POST /api/updates/[id]/send - סימון לקוחות כמקבלי עדכון
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

    const body = await request.json();
    const { customerIds } = body as { customerIds: number[] };

    if (!customerIds || !Array.isArray(customerIds) || customerIds.length === 0) {
      return NextResponse.json(
        { error: "יש לספק רשימת מזהי לקוחות" },
        { status: 400 }
      );
    }

    // בדיקה שכל הלקוחות קיימים
    const customers = await prisma.customer.findMany({
      where: { id: { in: customerIds } },
      select: { id: true, fullName: true },
    });

    if (customers.length !== customerIds.length) {
      return NextResponse.json(
        { error: "חלק מהלקוחות לא נמצאו" },
        { status: 400 }
      );
    }

    // בדיקה אילו לקוחות כבר קיבלו את העדכון
    const alreadyReceived = await prisma.customerUpdate.findMany({
      where: {
        updateVersionId: id,
        customerId: { in: customerIds },
      },
      select: { customerId: true },
    });
    const alreadyReceivedIds = new Set(alreadyReceived.map((cu) => cu.customerId));

    // סינון לקוחות שלא קיבלו עדיין
    const newCustomerIds = customerIds.filter((cid) => !alreadyReceivedIds.has(cid));

    if (newCustomerIds.length === 0) {
      return NextResponse.json(
        { error: "כל הלקוחות המבוקשים כבר קיבלו את העדכון הזה" },
        { status: 400 }
      );
    }

    // יצירת רשומות CustomerUpdate
    const now = new Date();
    const customerUpdates = await prisma.customerUpdate.createMany({
      data: newCustomerIds.map((customerId) => ({
        customerId,
        updateVersionId: id,
        sentAt: now,
        sentById: session.user.id,
      })),
    });

    // עדכון גרסה נוכחית בלקוחות
    await prisma.customer.updateMany({
      where: { id: { in: newCustomerIds } },
      data: { currentUpdateVersion: updateVersion.version },
    });

    // רישום פעילות לכל לקוח
    const activityPromises = newCustomerIds.map((customerId) =>
      logActivity({
        userId: session.user.id,
        customerId,
        action: "SEND_UPDATE",
        entityType: "CUSTOMER_UPDATE",
        entityId: id,
        details: {
          version: updateVersion.version,
          customerId,
        },
      })
    );
    await Promise.all(activityPromises);

    return NextResponse.json({
      message: `העדכון נשלח בהצלחה ל-${newCustomerIds.length} לקוחות`,
      sentCount: newCustomerIds.length,
      alreadyReceivedCount: alreadyReceivedIds.size,
      totalCreated: customerUpdates.count,
    });
  } catch (error) {
    console.error("Error sending update:", error);
    return NextResponse.json(
      { error: "שגיאה בשליחת העדכון" },
      { status: 500 }
    );
  }
}
