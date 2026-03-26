import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadFile } from "@/lib/file-storage";

// GET /api/public/upload-info?token=xxx — אימות טוקן ושליפת שם לקוח
export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token");
    if (!token) {
      return NextResponse.json({ error: "חסר טוקן" }, { status: 400 });
    }

    const setting = await prisma.systemSetting.findUnique({
      where: { key: `upload-token:${token}` },
    });

    if (!setting) {
      return NextResponse.json({ error: "קישור לא תקין" }, { status: 404 });
    }

    const data = JSON.parse(setting.value) as { customerId: number; expiresAt: string };

    if (new Date(data.expiresAt) < new Date()) {
      return NextResponse.json({ error: "הקישור פג תוקף" }, { status: 410 });
    }

    const customer = await prisma.customer.findUnique({
      where: { id: data.customerId },
      select: { id: true, fullName: true },
    });

    if (!customer) {
      return NextResponse.json({ error: "לקוח לא נמצא" }, { status: 404 });
    }

    return NextResponse.json({ customerId: customer.id, customerName: customer.fullName });
  } catch (error) {
    console.error("Error validating upload token:", error);
    return NextResponse.json({ error: "שגיאה באימות הקישור" }, { status: 500 });
  }
}

// POST /api/public/upload-info?token=xxx — העלאת קובץ אינפו ציבורית
export async function POST(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token");
    if (!token) {
      return NextResponse.json({ error: "חסר טוקן" }, { status: 400 });
    }

    const setting = await prisma.systemSetting.findUnique({
      where: { key: `upload-token:${token}` },
    });

    if (!setting) {
      return NextResponse.json({ error: "קישור לא תקין" }, { status: 404 });
    }

    const tokenData = JSON.parse(setting.value) as { customerId: number; expiresAt: string };

    if (new Date(tokenData.expiresAt) < new Date()) {
      return NextResponse.json({ error: "הקישור פג תוקף" }, { status: 410 });
    }

    const customer = await prisma.customer.findUnique({
      where: { id: tokenData.customerId },
    });

    if (!customer) {
      return NextResponse.json({ error: "לקוח לא נמצא" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "לא סופק קובץ" }, { status: 400 });
    }

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "n27") {
      return NextResponse.json({ error: "יש להעלות קובץ .n27 בלבד" }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "הקובץ גדול מדי (מקסימום 10MB)" }, { status: 400 });
    }

    const newFileName = `${tokenData.customerId}.n27`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const url = await uploadFile(buffer, newFileName, "customers/info");

    await prisma.customer.update({
      where: { id: tokenData.customerId },
      data: { infoFileUrl: url },
    });

    // מחיקת הטוקן רק אחרי העלאה מוצלחת — אם ההעלאה נכשלת, הלקוח יכול לנסות שוב
    try {
      await prisma.systemSetting.delete({
        where: { key: `upload-token:${token}` },
      });
    } catch {
      // הטוקן כבר נמחק (race condition) — לא קריטי, ההעלאה הצליחה
      return NextResponse.json({ error: "הטוקן כבר נוצל" }, { status: 409 });
    }

    return NextResponse.json({ success: true, fileName: newFileName });
  } catch (error) {
    console.error("Error uploading info file:", error);
    return NextResponse.json({ error: "שגיאה בהעלאת הקובץ" }, { status: 500 });
  }
}
