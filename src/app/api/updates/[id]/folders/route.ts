import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { listFiles } from "@/lib/file-storage";

export const dynamic = "force-dynamic";

// GET /api/updates/[id]/folders — סטטוס תיקיות ב-Google Drive
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
    const folders = [];

    for (const setType of setTypes) {
      const setAlias = setType.folderAlias || setType.name;
      const organStatuses = [];

      for (const organ of organs) {
        const organAlias = organ.folderAlias || organ.name;
        const folderPath = `updates/beats/${version}/${setAlias}/${organAlias}`;

        let hasFiles = false;
        let fileCount = 0;

        try {
          const files = await listFiles(folderPath);
          fileCount = files.length;
          hasFiles = fileCount > 0;
        } catch {
          // folder doesn't exist or empty
        }

        // Also check for a zip file at the set level
        if (!hasFiles) {
          try {
            const setFiles = await listFiles(`updates/beats/${version}/${setAlias}`);
            const zipFile = setFiles.find(
              (f) => f.path.toLowerCase().endsWith(`${organAlias.toLowerCase()}.zip`)
            );
            if (zipFile) {
              hasFiles = true;
              fileCount = 1;
            }
          } catch {
            // ok
          }
        }

        organStatuses.push({
          name: organ.name,
          alias: organAlias,
          hasFiles,
          fileCount,
        });
      }

      folders.push({
        setType: setType.name,
        setTypeAlias: setAlias,
        organs: organStatuses,
      });
    }

    return NextResponse.json({ folders, version });
  } catch (error) {
    console.error("Error fetching folder status:", error);
    return NextResponse.json({ error: "שגיאה בבדיקת תיקיות" }, { status: 500 });
  }
}
