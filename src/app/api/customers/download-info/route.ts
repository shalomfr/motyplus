import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { downloadFile } from "@/lib/file-storage";
import JSZip from "jszip";

// GET /api/customers/download-info - הורדת כל קבצי האינפו של הלקוחות כ-ZIP
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "לא מורשה" }, { status: 401 });
    }

    // מצא את כל הלקוחות שיש להם קבצי אינפו
    const customers = await prisma.customer.findMany({
      where: {
        OR: [
          { infoFileUrl: { not: null } },
          { additionalInfoFileUrl: { not: null } },
        ],
      },
      select: {
        id: true,
        infoFileUrl: true,
        additionalInfoFileUrl: true,
      },
    });

    if (customers.length === 0) {
      return NextResponse.json({ error: "אין קבצי אינפו להורדה" }, { status: 404 });
    }

    // אסוף את כל הנתיבים
    const paths: string[] = [];
    for (const c of customers) {
      if (c.infoFileUrl) paths.push(c.infoFileUrl);
      if (c.additionalInfoFileUrl) paths.push(c.additionalInfoFileUrl);
    }

    // צור ZIP מקבצי Google Drive
    const zip = new JSZip();
    let fileCount = 0;

    for (const path of paths) {
      try {
        const buffer = await downloadFile(path);
        const fileName = path.split("/").pop() || path;
        zip.file(fileName, buffer);
        fileCount++;
      } catch (err) {
        console.warn(`Failed to download ${path}:`, err);
      }
    }

    if (fileCount === 0) {
      return NextResponse.json({ error: "לא נמצאו קבצים באחסון" }, { status: 404 });
    }

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

    return new NextResponse(new Uint8Array(zipBuffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="info-files.zip"`,
      },
    });
  } catch (error) {
    console.error("Error downloading info files:", error);
    return NextResponse.json(
      { error: "שגיאה בהורדת קבצי האינפו" },
      { status: 500 }
    );
  }
}
