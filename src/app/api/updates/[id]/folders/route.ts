import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { ensureFolderPath } from "@/lib/file-storage";
import { getDrive } from "@/lib/google-drive";

export const dynamic = "force-dynamic";

interface OrganStatus {
  name: string;
  alias: string;
  hasFiles: boolean;
  fileCount: number;
}

async function countFolderContents(folderPath: string): Promise<{ hasFiles: boolean; fileCount: number }> {
  try {
    const drive = getDrive();
    const folderId = await ensureFolderPath(folderPath).catch(() => null);
    if (!folderId) return { hasFiles: false, fileCount: 0 };

    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: "files(id)",
      spaces: "drive",
      pageSize: 5,
    });

    const count = res.data.files?.length || 0;
    return { hasFiles: count > 0, fileCount: count };
  } catch {
    return { hasFiles: false, fileCount: 0 };
  }
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

    const folderResults = await Promise.all(
      setTypes.map(async (setType) => {
        const setAlias = setType.folderAlias || setType.name;

        const organStatuses: OrganStatus[] = await Promise.all(
          organs.map(async (organ) => {
            const organAlias = organ.folderAlias || organ.name;
            const organPath = `updates/beats/${version}/${setAlias}/${organAlias}`;
            const { hasFiles, fileCount } = await countFolderContents(organPath);
            return { name: organ.name, alias: organAlias, hasFiles, fileCount };
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
