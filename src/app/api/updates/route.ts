import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { updateVersionSchema } from "@/lib/validators";
import { ensureFolderPath } from "@/lib/file-storage";

// GET /api/updates - רשימת גרסאות עדכון
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: "לא מורשה. יש להתחבר למערכת" },
        { status: 401 }
      );
    }

    const updates = await prisma.updateVersion.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        _count: {
          select: {
            customerUpdates: true,
          },
        },
      },
    });

    return NextResponse.json(updates);
  } catch (error) {
    console.error("Error fetching updates:", error);
    return NextResponse.json(
      { error: "שגיאה בטעינת העדכונים" },
      { status: 500 }
    );
  }
}

// POST /api/updates - יצירת גרסת עדכון חדשה
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: "לא מורשה. יש להתחבר למערכת" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validation = updateVersionSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "נתונים לא תקינים", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const data = validation.data;

    // בדיקה שהגרסה לא קיימת
    const existing = await prisma.updateVersion.findUnique({
      where: { version: data.version },
    });

    if (existing) {
      return NextResponse.json(
        { error: "גרסה זו כבר קיימת במערכת" },
        { status: 409 }
      );
    }

    // חישוב sortOrder אוטומטי
    const lastUpdate = await prisma.updateVersion.findFirst({
      orderBy: { sortOrder: "desc" },
    });
    const nextSortOrder = (lastUpdate?.sortOrder ?? 0) + 1;

    const update = await prisma.updateVersion.create({
      data: {
        version: data.version,
        price: data.price,
        releaseDate: data.releaseDate ? new Date(data.releaseDate) : null,
        description: data.description,
        rhythmsFileUrl: data.rhythmsFileUrl,
        samplesFileUrl: data.samplesFileUrl,
        ppfFileUrl: data.ppfFileUrl,
        emailSubject: data.emailSubject,
        emailBody: data.emailBody,
        sortOrder: nextSortOrder,
      },
    });

    // #26/#27: יצירת תיקיות אוטומטית ב-Google Drive
    // async/best-effort — לא מכשיל את הבקשה
    createUpdateFolders(data.version).catch((err) =>
      console.error("Error creating update folders in Drive:", err)
    );

    return NextResponse.json(update, { status: 201 });
  } catch (error) {
    console.error("Error creating update:", error);
    return NextResponse.json(
      { error: "שגיאה ביצירת העדכון" },
      { status: 500 }
    );
  }
}

// === Helper: יצירת מבנה תיקיות Google Drive לגרסת עדכון ===

async function createUpdateFolders(version: string): Promise<void> {
  // שליפת סוגי סטים פעילים
  const setTypes = await prisma.setType.findMany({
    where: { isActive: true },
    select: { name: true, folderAlias: true },
  });

  // מבנה: updates/beats/{version}/{setType}
  const versionFolder = `updates/beats/${version}`;
  await ensureFolderPath(versionFolder);

  for (const setType of setTypes) {
    const setTypeName = setType.folderAlias || setType.name;
    await ensureFolderPath(`${versionFolder}/${setTypeName}`);
  }

  // וידוא שתיקיית הדגימות קיימת (שטוחה, בלי גרסה)
  await ensureFolderPath("updates/samples");

  console.log(
    `Drive folders created for version ${version}: ${setTypes.length} setTypes + samples`
  );
}
