import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { listFiles } from "@/lib/file-storage";

export const dynamic = "force-dynamic";

interface OrganStatus {
  name: string;
  alias: string;
  hasFiles: boolean;
  fileCount: number;
}

async function checkSetTypeFolder(
  version: string,
  setAlias: string,
  organs: Array<{ name: string; folderAlias: string | null }>
): Promise<OrganStatus[]> {
  const basePath = `updates/beats/${version}/${setAlias}`;

  let allFiles: { path: string }[] = [];
  try {
    allFiles = await listFiles(basePath);
  } catch {
    // folder doesn't exist
  }

  const fileNames = new Set(allFiles.map((f) => {
    const name = f.path.split("/").pop()?.toLowerCase() || "";
    return name;
  }));

  const filePaths = new Set(allFiles.map((f) => f.path.toLowerCase()));

  return organs.map((organ) => {
    const organAlias = organ.folderAlias || organ.name;
    const aliasLower = organAlias.toLowerCase();

    const hasZip = fileNames.has(`${aliasLower}.zip`);
    const subfolderFiles = allFiles.filter((f) =>
      f.path.toLowerCase().includes(`/${aliasLower}/`)
    );
    const hasSubfolderFiles = subfolderFiles.length > 0;

    return {
      name: organ.name,
      alias: organAlias,
      hasFiles: hasZip || hasSubfolderFiles,
      fileCount: hasZip ? 1 : subfolderFiles.length,
    };
  });
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
        const organStatuses = await checkSetTypeFolder(version, setAlias, organs);
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
