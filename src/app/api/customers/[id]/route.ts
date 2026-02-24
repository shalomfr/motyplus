import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { customerUpdateSchema } from "@/lib/validators";
import { logActivity } from "@/lib/activity-logger";

// GET /api/customers/[id] - קבלת לקוח בודד עם כל הקשרים
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
    const customerId = parseInt(id);

    if (isNaN(customerId)) {
      return NextResponse.json(
        { error: "מזהה לקוח לא תקין" },
        { status: 400 }
      );
    }

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        organ: true,
        setType: true,
        customerUpdates: {
          include: {
            updateVersion: true,
          },
          orderBy: { createdAt: "desc" },
        },
        payments: {
          orderBy: { createdAt: "desc" },
        },
        linkedCustomer: {
          include: {
            organ: true,
          },
        },
        linkedFrom: {
          include: {
            organ: true,
          },
        },
      },
    });

    if (!customer) {
      return NextResponse.json(
        { error: "הלקוח לא נמצא" },
        { status: 404 }
      );
    }

    return NextResponse.json(customer);
  } catch (error) {
    console.error("Error fetching customer:", error);
    return NextResponse.json(
      { error: "שגיאה בטעינת הלקוח" },
      { status: 500 }
    );
  }
}

// PUT /api/customers/[id] - עדכון לקוח
export async function PUT(
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
    const customerId = parseInt(id);

    if (isNaN(customerId)) {
      return NextResponse.json(
        { error: "מזהה לקוח לא תקין" },
        { status: 400 }
      );
    }

    const existing = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "הלקוח לא נמצא" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validation = customerUpdateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "נתונים לא תקינים", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const data = validation.data;

    // אם תאריך רכישה עודכן, יש לעדכן גם תאריך תפוגה
    let updateExpiryDate: Date | undefined;
    if (data.purchaseDate) {
      const purchaseDate = new Date(data.purchaseDate);
      updateExpiryDate = new Date(purchaseDate);
      updateExpiryDate.setFullYear(updateExpiryDate.getFullYear() + 1);
    }

    const customer = await prisma.customer.update({
      where: { id: customerId },
      data: {
        ...data,
        amountPaid: data.amountPaid !== undefined ? data.amountPaid : undefined,
        purchaseDate: data.purchaseDate
          ? new Date(data.purchaseDate)
          : undefined,
        updateExpiryDate,
      },
      include: {
        organ: true,
        setType: true,
      },
    });

    await logActivity({
      userId: session.user.id,
      customerId: customer.id,
      action: "UPDATE",
      entityType: "CUSTOMER",
      entityId: String(customer.id),
      details: { updatedFields: Object.keys(data) },
    });

    return NextResponse.json(customer);
  } catch (error) {
    console.error("Error updating customer:", error);
    return NextResponse.json(
      { error: "שגיאה בעדכון הלקוח" },
      { status: 500 }
    );
  }
}

// DELETE /api/customers/[id] - מחיקת לקוח
export async function DELETE(
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
    const customerId = parseInt(id);

    if (isNaN(customerId)) {
      return NextResponse.json(
        { error: "מזהה לקוח לא תקין" },
        { status: 400 }
      );
    }

    const existing = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "הלקוח לא נמצא" },
        { status: 404 }
      );
    }

    await prisma.customer.delete({
      where: { id: customerId },
    });

    await logActivity({
      userId: session.user.id,
      action: "DELETE",
      entityType: "CUSTOMER",
      entityId: String(customerId),
      details: { fullName: existing.fullName },
    });

    return NextResponse.json({ message: "הלקוח נמחק בהצלחה" });
  } catch (error) {
    console.error("Error deleting customer:", error);
    return NextResponse.json(
      { error: "שגיאה במחיקת הלקוח" },
      { status: 500 }
    );
  }
}
