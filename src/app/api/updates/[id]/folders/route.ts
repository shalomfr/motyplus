import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getDrive, getRootFolderId } from "@/lib/google-drive";

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
    fields: "files(id)",
    spaces: "drive",
    pageSize: 1,
  });
  return res.data.files?.[0]?.id || null;
}

async function resolveFolderPath(
  drive: ReturnType<typeof getDrive>,
  pathParts: string[]
): Promise<string | null> {
  let currentId = getRootFolderId();
  for (const part of pathParts) {
    const nextId = await findFolderId(drive, currentId, part);
    if (!nextId) return null;
    currentId = nextId;
  }
  return currentId;
}

async function countFolderContents(
  drive: ReturnType<typeof getDrive>,
  folderId: string
): Promise<number> {
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed=false`,
    fields: "files(id)",
    spaces: "drive",
    pageSize: 10,
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
        orderBy: { name: "asc" },
      }),
      prisma.organ.findMany({
        where: { supportsUpdates: true },
        select: { id: true, name: true, folderAlias: true },
        orderBy: { name: "asc" },
      }),
    ]);

    const version = updateVersion.version;
    const drive = getDrive();

    const baseFolderId = await resolveFolderPath(drive, ["updates", "beats", version]);
    if (!baseFolderId) {
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
      });
    }

    const folderResults = await Promise.all(
      setTypes.map(async (setType) => {
        const setAlias = setType.folderAlias || setType.name;
        const setFolderId = await findFolderId(drive, baseFolderId, setAlias);

        const organStatuses: OrganStatus[] = await Promise.all(
          organs.map(async (organ) => {
            const organAlias = organ.folderAlias || organ.name;
            if (!setFolderId) {
              return { name: organ.name, alias: organAlias, hasFiles: false, fileCount: 0 };
            }

            const organFolderId = await findFolderId(drive, setFolderId, organAlias);
            if (!organFolderId) {
              return { name: organ.name, alias: organAlias, hasFiles: false, fileCount: 0 };
            }

            const fileCount = await countFolderContents(drive, organFolderId);
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

    return NextResponse.json({ folders: folderResults, version });
  } catch (error) {
    console.error("Error fetching folder status:", error);
    return NextResponse.json({ error: "שגיאה בבדיקת תיקיות" }, { status: 500 });
  }
}
