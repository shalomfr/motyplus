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
        additionalOrgan: true,
        setType: true,
        promotion: { select: { id: true, name: true, discountPercent: true, couponCode: true } },
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

    // If setTypeId changed, recalculate currentUpdateVersion
    const extraUpdateData: Record<string, unknown> = {};
    if (data.setTypeId && data.setTypeId !== existing.setTypeId) {
      const newSetType = await prisma.setType.findUnique({ where: { id: data.setTypeId } });
      if (newSetType?.includesUpdates) {
        const latestVersion = await prisma.updateVersion.findFirst({
          where: { status: { not: "DRAFT" } },
          orderBy: { createdAt: "desc" },
        });
        if (latestVersion) {
          extraUpdateData.currentUpdateVersion = latestVersion.version;
        }
      }
    }

    const customer = await prisma.customer.update({
      where: { id: customerId },
      data: {
        ...data,
        organId: data.organId || undefined,
        additionalOrganId: data.additionalOrganId || null,
        whatsappPhone: data.whatsappPhone || null,
        address: data.address || null,
        notes: data.notes || null,
        infoFileUrl: data.infoFileUrl || null,
        amountPaid: data.amountPaid !== undefined ? data.amountPaid : undefined,
        purchaseDate: data.purchaseDate
          ? new Date(data.purchaseDate)
          : undefined,
        updateExpiryDate,
        ...extraUpdateData,
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

// PATCH /api/customers/[id] - שדרוג לקוח לסט מלא
export async function PATCH(
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
      include: { setType: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "הלקוח לא נמצא" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { action, setTypeId } = body as { action: string; setTypeId?: string };

    if (action === "upgrade") {
      if (!setTypeId) {
        return NextResponse.json(
          { error: "יש לבחור סוג סט" },
          { status: 400 }
        );
      }

      // וידוא שסוג הסט החדש כולל עדכונים
      const newSetType = await prisma.setType.findUnique({
        where: { id: setTypeId },
      });

      if (!newSetType || !newSetType.includesUpdates) {
        return NextResponse.json(
          { error: "סוג הסט שנבחר לא כולל עדכונים" },
          { status: 400 }
        );
      }

      // שדרוג — updateExpiryDate = שנה מהיום
      const updateExpiryDate = new Date();
      updateExpiryDate.setFullYear(updateExpiryDate.getFullYear() + 1);

      const customer = await prisma.customer.update({
        where: { id: customerId },
        data: {
          setTypeId,
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
        details: {
          action: "upgrade_to_full_set",
          previousSetType: existing.setType?.name,
          newSetType: newSetType.name,
          updateExpiryDate: updateExpiryDate.toISOString(),
        },
      });

      return NextResponse.json(customer);
    }

    if (action === "approve" || body.status === "ACTIVE") {
      const updateExpiryDate = new Date();
      updateExpiryDate.setFullYear(updateExpiryDate.getFullYear() + 1);

      const customer = await prisma.customer.update({
        where: { id: customerId },
        data: { status: "ACTIVE", updateExpiryDate },
        include: { organ: true, setType: true },
      });

      await logActivity({
        userId: session.user.id,
        customerId: customer.id,
        action: "UPDATE",
        entityType: "CUSTOMER",
        entityId: String(customer.id),
        details: { action: "approve", previousStatus: existing.status },
      });

      return NextResponse.json(customer);
    }

    return NextResponse.json(
      { error: "פעולה לא מוכרת" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error patching customer:", error);
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

    // Unlink any customers that point to this customer
    await prisma.customer.updateMany({
      where: { linkedCustomerId: parseInt(id) },
      data: { linkedCustomerId: null },
    });
    // Clean up Lead.convertedCustomerId
    await prisma.lead.updateMany({
      where: { convertedCustomerId: parseInt(id) },
      data: { convertedCustomerId: null },
    });

    // Delete related records first to avoid FK constraint errors
    await prisma.payment.deleteMany({ where: { customerId } });
    await prisma.emailLog.deleteMany({ where: { customerId } });
    await prisma.activityLog.deleteMany({ where: { customerId } });
    await prisma.customerUpdate.deleteMany({ where: { customerId } });

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
