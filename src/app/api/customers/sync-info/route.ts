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

    // תיקיית info ידועה מראש, fallback ל-ensureFolderPath
    const KNOWN_INFO_FOLDER_ID = "1pdsud6vexV4WQzGdVjdUUDfFfJUJ7SV9";
    let infoFolderId: string;
    try {
      // נסה קודם עם ה-ID הידוע
      const check = await drive.files.get({
        fileId: KNOWN_INFO_FOLDER_ID,
        fields: "id, name, trashed",
      });
      if (check.data.id && !check.data.trashed) {
        infoFolderId = KNOWN_INFO_FOLDER_ID;
      } else {
        infoFolderId = await ensureFolderPath("customers/info");
      }
    } catch {
      // אם ה-ID הידוע לא עובד — נסה לפי נתיב
      try {
        infoFolderId = await ensureFolderPath("customers/info");
      } catch {
        return NextResponse.json({ error: "לא ניתן לגשת לתיקיית אינפו בדרייב" }, { status: 500 });
      }
    }

    // סרוק את כל הקבצים בתיקייה (כולל תתי תיקיות)
    const allFiles: { name: string; id: string }[] = [];
    let pageToken: string | undefined;

    do {
      const res = await drive.files.list({
        q: `'${infoFolderId}' in parents and trashed=false`,
        fields: "nextPageToken, files(id, name, mimeType)",
        spaces: "drive",
        pageSize: 1000,
        pageToken,
      });

      if (res.data.files) {
        for (const f of res.data.files) {
          if (f.name && f.id && f.mimeType !== "application/vnd.google-apps.folder") {
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
      // תבניות אפשריות: 61452.n27, 61452V5.n27, 61452_02.n27, 61452_V5.n27
      const match = file.name.match(/^(\d+)(?:[_]?(?:02|V\d+[.\d]*))?\.n27$/i);
      if (!match) continue;

      const custId = parseInt(match[1]);
      const isAdditional = file.name.includes("_02");
      const drivePath = `customers/info/${file.name}`;

      if (isAdditional) {
        additionalInfoMap.set(custId, drivePath);
      } else {
        // אם כבר יש — תעדיף קובץ בלי version (הבסיסי)
        if (!mainInfoMap.has(custId) || !file.name.includes("V")) {
          mainInfoMap.set(custId, drivePath);
        }
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

    // דגימה של 5 שמות קבצים ראשונים לדיבוג
    const sampleFiles = allFiles.slice(0, 5).map(f => f.name);

    return NextResponse.json({
      found: allFiles.length,
      matched: customers.length,
      updated,
      mainInfoCount: mainInfoMap.size,
      additionalInfoCount: additionalInfoMap.size,
      folderId: infoFolderId,
      sampleFiles,
      message: `נסרקו ${allFiles.length} קבצים, ${customers.length} תואמים, ${updated} עודכנו`,
    });
  } catch (error) {
    console.error("Error syncing info files:", error);
    return NextResponse.json({ error: "שגיאה בסריקת קבצי אינפו" }, { status: 500 });
  }
}
