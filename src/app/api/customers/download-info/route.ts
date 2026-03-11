import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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

    // הורד את כל הקבצים מה-DB
    const files = await prisma.fileStorage.findMany({
      where: { path: { in: paths } },
      select: { path: true, data: true },
    });

    if (files.length === 0) {
      return NextResponse.json({ error: "לא נמצאו קבצים באחסון" }, { status: 404 });
    }

    // צור ZIP
    const zip = new JSZip();
    for (const file of files) {
      // שם הקובץ = החלק האחרון של הנתיב (e.g. "1234.n27")
      const fileName = file.path.split("/").pop() || file.path;
      zip.file(fileName, Buffer.from(file.data));
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
