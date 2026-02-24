import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { updateVersionSchema } from "@/lib/validators";

// GET /api/updates/[id] - קבלת עדכון עם סטטיסטיקות לקוחות
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

    const update = await prisma.updateVersion.findUnique({
      where: { id },
      include: {
        customerUpdates: {
          include: {
            customer: {
              select: {
                id: true,
                fullName: true,
                organ: true,
                status: true,
              },
            },
          },
        },
        _count: {
          select: {
            customerUpdates: true,
          },
        },
      },
    });

    if (!update) {
      return NextResponse.json(
        { error: "העדכון לא נמצא" },
        { status: 404 }
      );
    }

    // סטטיסטיקות
    const stats = {
      totalSent: update._count.customerUpdates,
      sentCount: update.customerUpdates.filter((cu) => cu.sentAt).length,
      downloadedCount: update.customerUpdates.filter((cu) => cu.downloadedAt).length,
      robotProcessedCount: update.customerUpdates.filter((cu) => cu.robotProcessed).length,
      robotErrorCount: update.customerUpdates.filter((cu) => cu.robotError).length,
    };

    return NextResponse.json({ ...update, stats });
  } catch (error) {
    console.error("Error fetching update:", error);
    return NextResponse.json(
      { error: "שגיאה בטעינת העדכון" },
      { status: 500 }
    );
  }
}

// PUT /api/updates/[id] - עדכון פרטי גרסה
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

    const existing = await prisma.updateVersion.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "העדכון לא נמצא" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validation = updateVersionSchema.partial().safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "נתונים לא תקינים", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const data = validation.data;

    const update = await prisma.updateVersion.update({
      where: { id },
      data: {
        ...data,
        price: data.price !== undefined ? data.price : undefined,
        releaseDate: data.releaseDate !== undefined
          ? data.releaseDate
            ? new Date(data.releaseDate)
            : null
          : undefined,
      },
    });

    return NextResponse.json(update);
  } catch (error) {
    console.error("Error updating version:", error);
    return NextResponse.json(
      { error: "שגיאה בעדכון הגרסה" },
      { status: 500 }
    );
  }
}
