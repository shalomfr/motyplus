import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/updates/pending - עדכונים שמוכנים לשליחה (סטטוס READY) ולא נשלחו לכל הלקוחות
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: "לא מורשה. יש להתחבר למערכת" },
        { status: 401 }
      );
    }

    const pendingUpdates = await prisma.updateVersion.findMany({
      where: {
        status: { in: ["READY", "SENDING"] },
      },
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            customerUpdates: true,
          },
        },
        customerUpdates: {
          select: {
            sentAt: true,
          },
        },
      },
    });

    const result = pendingUpdates.map((update) => {
      const totalCustomerUpdates = update.customerUpdates.length;
      const sentCount = update.customerUpdates.filter((cu) => cu.sentAt !== null).length;
      const pendingCount = totalCustomerUpdates - sentCount;

      return {
        id: update.id,
        version: update.version,
        status: update.status,
        updateType: update.updateType,
        price: update.price,
        description: update.description,
        releaseDate: update.releaseDate,
        createdAt: update.createdAt,
        totalCustomers: totalCustomerUpdates,
        sentCount,
        pendingCount,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching pending updates:", error);
    return NextResponse.json(
      { error: "שגיאה בטעינת עדכונים ממתינים" },
      { status: 500 }
    );
  }
}
