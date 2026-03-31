import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { updateVersionSchema } from "@/lib/validators";
import { deleteFolder } from "@/lib/file-storage";
import { logActivity } from "@/lib/activity-logger";

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

    const { emailTemplateMap, ...rest } = data;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {
      ...rest,
      price: rest.price !== undefined ? rest.price : undefined,
      releaseDate: rest.releaseDate !== undefined
        ? rest.releaseDate
          ? new Date(rest.releaseDate)
          : null
        : undefined,
    };
    if (emailTemplateMap !== undefined) {
      updateData.emailTemplateMap = emailTemplateMap;
    }
    const update = await prisma.updateVersion.update({
      where: { id },
      data: updateData,
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

// DELETE /api/updates/[id] - מחיקת גרסת עדכון
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

    const existing = await prisma.updateVersion.findUnique({
      where: { id },
      select: { id: true, version: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "העדכון לא נמצא" },
        { status: 404 }
      );
    }

    // Delete all CustomerUpdate records for this version
    await prisma.customerUpdate.deleteMany({
      where: { updateVersionId: id },
    });

    // Delete all UpdateFile records for this version
    await prisma.updateFile.deleteMany({
      where: { updateVersionId: id },
    });

    // Delete the UpdateVersion itself
    await prisma.updateVersion.delete({
      where: { id },
    });

    // עדכון לקוחות שהיו על הגרסה שנמחקה — להעביר לגרסה האחרונה שנשארה
    const newLatest = await prisma.updateVersion.findFirst({
      where: { status: { not: "DRAFT" } },
      orderBy: { sortOrder: "desc" },
      select: { version: true },
    });

    await prisma.customer.updateMany({
      where: { currentUpdateVersion: existing.version },
      data: { currentUpdateVersion: newLatest?.version || null },
    });

    // מחיקת תיקיות Google Drive — מבנה חדש: updates/beats/{organ}/{package}/{version - organ}
    try {
      const organs = await prisma.organ.findMany({
        where: { supportsUpdates: true, demoAlias: { not: null } },
        select: { demoAlias: true },
      });
      const setTypes = await prisma.setType.findMany({
        where: { isActive: true, demoAlias: { not: null } },
        select: { demoAlias: true },
      });

      for (const organ of organs) {
        for (const setType of setTypes) {
          const folderPath = `updates/beats/${organ.demoAlias}/${setType.demoAlias}/${existing.version} - ${organ.demoAlias}`;
          try {
            await deleteFolder(folderPath);
          } catch {
            // תיקייה לא קיימת — ממשיכים
          }
        }
      }

      // ניסיון למחוק גם מבנה ישן (updates/beats/{version}) למקרה שנשאר
      try {
        await deleteFolder(`updates/beats/${existing.version}`);
      } catch {
        // לא קיים — ממשיכים
      }
    } catch (err) {
      console.error("Failed to delete Drive folders:", err);
    }

    // Log activity
    await logActivity({
      userId: session.user.id,
      action: "DELETE",
      entityType: "UpdateVersion",
      entityId: id,
      details: { version: existing.version },
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting update:", error);
    return NextResponse.json(
      { error: "שגיאה במחיקת העדכון" },
      { status: 500 }
    );
  }
}
