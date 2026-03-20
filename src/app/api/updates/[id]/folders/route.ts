import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getDrive, getRootFolderId } from "@/lib/google-drive";
import { ensureFolderPath } from "@/lib/file-storage";

export const dynamic = "force-dynamic";

interface OrganStatus {
  name: string;
  alias: string;
  hasFiles: boolean;
  fileCount: number;
}

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

async function resolveFolderPathDebug(
  drive: ReturnType<typeof getDrive>,
  pathParts: string[]
): Promise<{ folderId: string | null; failedAt: string | null; resolvedParts: string[] }> {
  let currentId = getRootFolderId();
  const resolvedParts: string[] = [];
  for (const part of pathParts) {
    const nextId = await findFolderId(drive, currentId, part);
    if (!nextId) return { folderId: null, failedAt: part, resolvedParts };
    resolvedParts.push(part);
    currentId = nextId;
  }
  return { folderId: currentId, failedAt: null, resolvedParts };
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

// GET /api/updates/[id]/folders
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
      select: { version: true },
    });

    if (!updateVersion) {
      return NextResponse.json({ error: "העדכון לא נמצא" }, { status: 404 });
    }

    const [setTypes, organs] = await Promise.all([
      prisma.setType.findMany({
        where: { isActive: true },
        select: { id: true, name: true, folderAlias: true },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.organ.findMany({
        where: { supportsUpdates: true },
        select: { id: true, name: true, folderAlias: true },
        orderBy: { sortOrder: "asc" },
      }),
    ]);

    const version = updateVersion.version;
    const drive = getDrive();

    const baseResult = await resolveFolderPathDebug(drive, ["updates", "beats", version]);
    const baseFolderId = baseResult.folderId;

    // Build debug info
    const debug: Record<string, unknown> = {
      baseFolderFound: !!baseFolderId,
      basePath: `updates/beats/${version}`,
      failedAt: baseResult.failedAt,
      resolvedParts: baseResult.resolvedParts,
      organCount: organs.length,
      setTypeCount: setTypes.length,
    };

    // If base folder not found, list what's actually there to help debug
    if (!baseFolderId) {
      const rootId = getRootFolderId();
      const rootChildren = await listSubfolders(drive, rootId);
      debug.rootFolderChildren = rootChildren;

      const updatesId = await findFolderId(drive, rootId, "updates");
      if (updatesId) {
        const updatesChildren = await listSubfolders(drive, updatesId);
        debug.updatesChildren = updatesChildren;

        const beatsId = await findFolderId(drive, updatesId, "beats");
        if (beatsId) {
          const beatsChildren = await listSubfolders(drive, beatsId);
          debug.beatsChildren = beatsChildren;
        }
      }

      return NextResponse.json({
        folders: setTypes.map((st) => ({
          setType: st.name,
          setTypeAlias: st.folderAlias || st.name,
          organs: organs.map((o) => ({
            name: o.name,
            alias: o.folderAlias || o.name,
            hasFiles: false,
            fileCount: 0,
          })),
        })),
        version,
        debug,
      });
    }

    // List actual subfolders in base for debug
    const baseChildren = await listSubfolders(drive, baseFolderId);
    debug.versionFolderChildren = baseChildren;

    const setDebug: Array<{ name: string; alias: string; found: boolean }> = [];

    const folderResults = await Promise.all(
      setTypes.map(async (setType) => {
        const setAlias = setType.folderAlias || setType.name;
        const setFolderId = await findFolderId(drive, baseFolderId, setAlias);
        let setChildren: string[] = [];
        if (setFolderId) {
          setChildren = await listSubfolders(drive, setFolderId);
        }
        setDebug.push({ name: setType.name, alias: setAlias, found: !!setFolderId, children: setChildren } as unknown as { name: string; alias: string; found: boolean });

        const organStatuses: OrganStatus[] = await Promise.all(
          organs.map(async (organ) => {
            const organAlias = organ.folderAlias || organ.name;
            if (!setFolderId) {
              return { name: organ.name, alias: organAlias, hasFiles: false, fileCount: 0 };
            }

            const organFolderId = await findFolderId(drive, setFolderId, organAlias);
            if (!organFolderId) {
              console.log(`[folders] organ "${organAlias}" NOT FOUND under setType "${setAlias}" (${setFolderId})`);
              return { name: organ.name, alias: organAlias, hasFiles: false, fileCount: 0 };
            }

            const fileCount = await countFolderContents(drive, organFolderId);
            console.log(`[folders] organ "${organAlias}" found (${organFolderId}), contents: ${fileCount}`);
            return { name: organ.name, alias: organAlias, hasFiles: fileCount > 0, fileCount };
          })
        );

        return {
          setType: setType.name,
          setTypeAlias: setAlias,
          organs: organStatuses,
        };
      })
    );

    debug.setTypes = setDebug;

    return NextResponse.json({ folders: folderResults, version, debug });
  } catch (error) {
    console.error("Error fetching folder status:", error);
    return NextResponse.json({ error: "שגיאה בבדיקת תיקיות", details: String(error) }, { status: 500 });
  }
}

// POST /api/updates/[id]/folders — create folder structure in Drive
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
      select: { version: true },
    });

    if (!updateVersion) {
      return NextResponse.json({ error: "העדכון לא נמצא" }, { status: 404 });
    }

    const version = updateVersion.version;
    const drive = getDrive();

    const [setTypes, organs] = await Promise.all([
      prisma.setType.findMany({
        where: { isActive: true },
        select: { name: true, folderAlias: true },
      }),
      prisma.organ.findMany({
        where: { supportsUpdates: true },
        select: { name: true, folderAlias: true },
      }),
    ]);

    // Create base folder path
    const versionFolderId = await ensureFolderPath(`updates/beats/${version}`);

    let created = 0;
    for (const setType of setTypes) {
      const setAlias = setType.folderAlias || setType.name;

      // Find or create set type folder
      let setFolderId: string;
      const existing = await drive.files.list({
        q: `name='${setAlias}' and '${versionFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: "files(id)",
        spaces: "drive",
      });

      if (existing.data.files && existing.data.files.length > 0) {
        setFolderId = existing.data.files[0].id!;
      } else {
        const res = await drive.files.create({
          requestBody: {
            name: setAlias,
            mimeType: "application/vnd.google-apps.folder",
            parents: [versionFolderId],
          },
          fields: "id",
        });
        setFolderId = res.data.id!;
        created++;
      }

      // Create organ folders
      for (const organ of organs) {
        const organAlias = organ.folderAlias || organ.name;
        const existingOrgan = await drive.files.list({
          q: `name='${organAlias}' and '${setFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
          fields: "files(id)",
          spaces: "drive",
        });

        if (!existingOrgan.data.files || existingOrgan.data.files.length === 0) {
          await drive.files.create({
            requestBody: {
              name: organAlias,
              mimeType: "application/vnd.google-apps.folder",
              parents: [setFolderId],
            },
            fields: "id",
          });
          created++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `נוצרו ${created} תיקיות חדשות`,
      structure: `updates/beats/${version}/${setTypes.length} sets × ${organs.length} organs`,
    });
  } catch (error) {
    console.error("Error creating folder structure:", error);
    return NextResponse.json({ error: "שגיאה ביצירת תיקיות", details: String(error) }, { status: 500 });
  }
}
