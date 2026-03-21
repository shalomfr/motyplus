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
        updateType: data.updateType,
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

    // יצירת תיקיות אוטומטית ב-Google Drive (מבנה אורגן-קודם)
    // async/best-effort — לא מכשיל את הבקשה
    createUpdateFolders(data.version, data.updateType).catch((err) =>
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
// מבנה: updates/beats/{version}/{organ}/{packageType}/{version} - {organ}/Folders [+HD1]

async function createUpdateFolders(
  version: string,
  updateType: "FULL" | "PARTIAL" = "FULL"
): Promise<void> {
  const { getDrive } = await import("@/lib/google-drive");
  const drive = getDrive();

  const [organs, setTypes] = await Promise.all([
    prisma.organ.findMany({
      where: { supportsUpdates: true, demoAlias: { not: null } },
      select: { name: true, demoAlias: true },
    }),
    prisma.setType.findMany({
      where: { isActive: true, demoAlias: { not: null } },
      select: { name: true, demoAlias: true },
    }),
  ]);

  // PARTIAL → רק Full set
  const targetSetTypes =
    updateType === "PARTIAL"
      ? setTypes.filter((st) => st.demoAlias === "Full set")
      : setTypes;

  for (const organ of organs) {
    const organName = organ.demoAlias!;
    const isTyros5 = organName.toLowerCase().includes("tyros5");

    for (const setType of targetSetTypes) {
      const packageName = setType.demoAlias!;
      const versionFolderName = `${version} - ${organName}`;

      // נתיב: updates/beats/{version}/{organ}/{packageType}/{version - organ}
      const folderPath = `updates/beats/${version}/${organName}/${packageName}/${versionFolderName}`;
      const parentId = await ensureFolderPath(folderPath);

      // יצירת Folders/
      await ensureSubfolder(drive, parentId, "Folders");

      // Tyros5 → גם HD1/
      if (isTyros5) {
        await ensureSubfolder(drive, parentId, "HD1");
      }
    }
  }

  // גם תיקיית samples
  await ensureFolderPath("updates/samples");

  console.log(
    `Drive folders created for ${version} (${updateType}): ${organs.length} organs × ${targetSetTypes.length} packageTypes`
  );
}

async function ensureSubfolder(
  drive: ReturnType<typeof import("@/lib/google-drive").getDrive>,
  parentId: string,
  name: string
): Promise<string> {
  const existing = await drive.files.list({
    q: `name='${name}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(id)",
    spaces: "drive",
  });
  if (existing.data.files?.length) return existing.data.files[0].id!;

  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    },
    fields: "id",
  });
  return created.data.id!;
}
