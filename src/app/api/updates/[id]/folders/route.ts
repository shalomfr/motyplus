import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getDrive, getRootFolderId } from "@/lib/google-drive";
import { ensureFolderPath } from "@/lib/file-storage";

export const dynamic = "force-dynamic";

async function findFolderId(
  drive: ReturnType<typeof getDrive>,
  parentId: string,
  name: string
): Promise<string | null> {
  const res = await drive.files.list({
    q: `name='${name}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(id,name)",
    spaces: "drive",
    pageSize: 1,
  });
  return res.data.files?.[0]?.id || null;
}

async function listSubfolders(
  drive: ReturnType<typeof getDrive>,
  parentId: string
): Promise<string[]> {
  const res = await drive.files.list({
    q: `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(name)",
    spaces: "drive",
    pageSize: 50,
  });
  return (res.data.files || []).map((f) => f.name || "").filter(Boolean);
}

async function countFolderContents(
  drive: ReturnType<typeof getDrive>,
  folderId: string
): Promise<number> {
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed=false`,
    fields: "files(id)",
    spaces: "drive",
    pageSize: 50,
  });
  return res.data.files?.length || 0;
}

async function ensureSubfolder(
  drive: ReturnType<typeof getDrive>,
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

// GET /api/updates/[id]/folders — בדיקת מצב תיקיות (מבנה אורגן-קודם)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "לא מורשה" }, { status: 401 });
    }

    const { id } = await params;

    const updateVersion = await prisma.updateVersion.findUnique({
      where: { id },
      select: { version: true, updateType: true },
    });

    if (!updateVersion) {
      return NextResponse.json({ error: "העדכון לא נמצא" }, { status: 404 });
    }

    const [organs, setTypes] = await Promise.all([
      prisma.organ.findMany({
        where: { supportsUpdates: true, demoAlias: { not: null } },
        select: { id: true, name: true, demoAlias: true },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.setType.findMany({
        where: { isActive: true, demoAlias: { not: null } },
        select: { id: true, name: true, demoAlias: true },
        orderBy: { sortOrder: "asc" },
      }),
    ]);

    const version = updateVersion.version;
    const updateType = updateVersion.updateType;
    const drive = getDrive();

    // PARTIAL → רק Full set
    const targetSetTypes =
      updateType === "PARTIAL"
        ? setTypes.filter((st) => st.demoAlias === "Full set")
        : setTypes;

    // בדוק אם תיקיית הגרסה קיימת
    const rootId = getRootFolderId();
    const updatesId = await findFolderId(drive, rootId, "updates");
    const beatsId = updatesId ? await findFolderId(drive, updatesId, "beats") : null;
    const versionFolderId = beatsId ? await findFolderId(drive, beatsId, version) : null;

    const debug: Record<string, unknown> = {
      baseFolderFound: !!versionFolderId,
      basePath: `updates/beats/${version}`,
      updateType,
      organCount: organs.length,
      packageTypeCount: targetSetTypes.length,
    };

    if (!versionFolderId) {
      if (beatsId) {
        debug.beatsChildren = await listSubfolders(drive, beatsId);
      }

      return NextResponse.json({
        folders: organs.map((organ) => ({
          organ: organ.name,
          organAlias: organ.demoAlias,
          packageTypes: targetSetTypes.map((st) => ({
            name: st.name,
            alias: st.demoAlias,
            hasFiles: false,
            fileCount: 0,
          })),
        })),
        version,
        updateType,
        debug,
      });
    }

    // מבנה: {version}/{organ}/{packageType}/{version - organ}/...
    const folderResults = await Promise.all(
      organs.map(async (organ) => {
        const organName = organ.demoAlias!;
        const organFolderId = await findFolderId(drive, versionFolderId, organName);

        const packageStatuses = await Promise.all(
          targetSetTypes.map(async (setType) => {
            const packageName = setType.demoAlias!;
            if (!organFolderId) {
              return { name: setType.name, alias: packageName, hasFiles: false, fileCount: 0 };
            }

            const packageFolderId = await findFolderId(drive, organFolderId, packageName);
            if (!packageFolderId) {
              return { name: setType.name, alias: packageName, hasFiles: false, fileCount: 0 };
            }

            // בדוק תיקיית version - organ
            const versionOrganName = `${version} - ${organName}`;
            const versionOrganId = await findFolderId(drive, packageFolderId, versionOrganName);
            if (!versionOrganId) {
              return { name: setType.name, alias: packageName, hasFiles: false, fileCount: 0 };
            }

            const fileCount = await countFolderContents(drive, versionOrganId);
            return { name: setType.name, alias: packageName, hasFiles: fileCount > 0, fileCount };
          })
        );

        return {
          organ: organ.name,
          organAlias: organName,
          packageTypes: packageStatuses,
        };
      })
    );

    return NextResponse.json({ folders: folderResults, version, updateType, debug });
  } catch (error) {
    console.error("Error fetching folder status:", error);
    return NextResponse.json({ error: "שגיאה בבדיקת תיקיות", details: String(error) }, { status: 500 });
  }
}

// POST /api/updates/[id]/folders — יצירת מבנה תיקיות (אורגן-קודם)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "לא מורשה" }, { status: 401 });
    }

    const { id } = await params;

    const updateVersion = await prisma.updateVersion.findUnique({
      where: { id },
      select: { version: true, updateType: true },
    });

    if (!updateVersion) {
      return NextResponse.json({ error: "העדכון לא נמצא" }, { status: 404 });
    }

    const version = updateVersion.version;
    const updateType = updateVersion.updateType;
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

    let created = 0;
    for (const organ of organs) {
      const organName = organ.demoAlias!;
      const isTyros5 = organName.toLowerCase().includes("tyros5");

      for (const setType of targetSetTypes) {
        const packageName = setType.demoAlias!;
        const versionFolderName = `${version} - ${organName}`;

        const folderPath = `updates/beats/${version}/${organName}/${packageName}/${versionFolderName}`;
        const parentId = await ensureFolderPath(folderPath);

        await ensureSubfolder(drive, parentId, "Folders");
        created++;

        if (isTyros5) {
          await ensureSubfolder(drive, parentId, "HD1");
          created++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `נוצרו ${created} תיקיות חדשות`,
      structure: `updates/beats/${version}/${organs.length} organs × ${targetSetTypes.length} packageTypes (${updateType})`,
    });
  } catch (error) {
    console.error("Error creating folder structure:", error);
    return NextResponse.json({ error: "שגיאה ביצירת תיקיות", details: String(error) }, { status: 500 });
  }
}
