import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/customers/[id]/updates - קבלת כל העדכונים של לקוח
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

    // בדיקה שהלקוח קיים
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      return NextResponse.json(
        { error: "הלקוח לא נמצא" },
        { status: 404 }
      );
    }

    const updates = await prisma.customerUpdate.findMany({
      where: { customerId },
      include: {
        updateVersion: true,
        sentBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(updates);
  } catch (error) {
    console.error("Error fetching customer updates:", error);
    return NextResponse.json(
      { error: "שגיאה בטעינת עדכוני הלקוח" },
      { status: 500 }
    );
  }
}
