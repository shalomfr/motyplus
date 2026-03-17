import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getDrive } from "@/lib/google-drive";
import { ensureFolderPath } from "@/lib/file-storage";

// POST /api/customers/sync-info — סריקת תיקיית אינפו בדרייב ועדכון לקוחות
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "לא מורשה" }, { status: 401 });
    }

    const drive = getDrive();

    // מצא את תיקיית customers/info בדרייב
    let infoFolderId: string;
    try {
      infoFolderId = await ensureFolderPath("customers/info");
    } catch {
      return NextResponse.json({ error: "לא ניתן לגשת לתיקיית אינפו בדרייב" }, { status: 500 });
    }

    // סרוק את כל הקבצים בתיקייה
    const allFiles: { name: string; id: string }[] = [];
    let pageToken: string | undefined;

    do {
      const res = await drive.files.list({
        q: `'${infoFolderId}' in parents and trashed=false`,
        fields: "nextPageToken, files(id, name)",
        spaces: "drive",
        pageSize: 1000,
        pageToken,
      });

      if (res.data.files) {
        for (const f of res.data.files) {
          if (f.name && f.id) {
            allFiles.push({ name: f.name, id: f.id });
          }
        }
      }
      pageToken = res.data.nextPageToken || undefined;
    } while (pageToken);

    // בניית מפה: מזהה לקוח → קובץ
    // שמות קבצים: 61452.n27 (ראשי), 61452_02.n27 (אורגן נוסף)
    const mainInfoMap = new Map<number, string>(); // customerId → drive path
    const additionalInfoMap = new Map<number, string>();

    for (const file of allFiles) {
      const match = file.name.match(/^(\d+)(?:_02)?\.n27$/i);
      if (!match) continue;

      const custId = parseInt(match[1]);
      const isAdditional = file.name.includes("_02");
      const drivePath = `customers/info/${file.name}`;

      if (isAdditional) {
        additionalInfoMap.set(custId, drivePath);
      } else {
        mainInfoMap.set(custId, drivePath);
      }
    }

    // עדכון כל הלקוחות שיש להם קובץ אינפו בדרייב
    const customerIds = [...new Set([...mainInfoMap.keys(), ...additionalInfoMap.keys()])];

    if (customerIds.length === 0) {
      return NextResponse.json({ updated: 0, found: 0, message: "לא נמצאו קבצי אינפו בדרייב" });
    }

    // טעינת לקוחות קיימים
    const customers = await prisma.customer.findMany({
      where: { id: { in: customerIds } },
      select: { id: true, infoFileUrl: true, additionalInfoFileUrl: true },
    });

    let updated = 0;

    for (const customer of customers) {
      const mainPath = mainInfoMap.get(customer.id);
      const additionalPath = additionalInfoMap.get(customer.id);

      const data: { infoFileUrl?: string; additionalInfoFileUrl?: string } = {};

      if (mainPath && customer.infoFileUrl !== mainPath) {
        data.infoFileUrl = mainPath;
      }
      if (additionalPath && customer.additionalInfoFileUrl !== additionalPath) {
        data.additionalInfoFileUrl = additionalPath;
      }

      if (Object.keys(data).length > 0) {
        await prisma.customer.update({
          where: { id: customer.id },
          data,
        });
        updated++;
      }
    }

    return NextResponse.json({
      found: allFiles.length,
      matched: customers.length,
      updated,
      message: `נסרקו ${allFiles.length} קבצים, ${updated} לקוחות עודכנו`,
    });
  } catch (error) {
    console.error("Error syncing info files:", error);
    return NextResponse.json({ error: "שגיאה בסריקת קבצי אינפו" }, { status: 500 });
  }
}
