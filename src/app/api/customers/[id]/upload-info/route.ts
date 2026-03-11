import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadFile } from "@/lib/azure-storage";

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_EXTENSIONS = ["n27"];

// POST /api/customers/[id]/upload-info - העלאת קובץ אינפו עם שינוי שם אוטומטי
// ?type=additional להעלאת קובץ אינפו של אורגן נוסף
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
    const customerId = parseInt(id);
    const isAdditional = request.nextUrl.searchParams.get("type") === "additional";

    // בדיקה שהלקוח קיים
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      return NextResponse.json({ error: "לקוח לא נמצא" }, { status: 404 });
    }

    if (isAdditional && !customer.additionalOrganId) {
      return NextResponse.json({ error: "ללקוח אין אורגן נוסף" }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "לא סופק קובץ" }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "הקובץ גדול מדי (מקסימום 10MB)" },
        { status: 400 }
      );
    }

    // בדיקת סיומת
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: `סוג קובץ לא מורשה. מותר: ${ALLOWED_EXTENSIONS.join(", ")}` },
        { status: 400 }
      );
    }

    // שינוי שם: ראשי = {id}.n27, נוסף = {id}_01.n27
    const newFileName = isAdditional
      ? `${customerId}_02.${ext}`
      : `${customerId}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // העלאה לAzure עם השם החדש
    const url = await uploadFile(buffer, newFileName, "customers/info");

    // עדכון הלקוח
    await prisma.customer.update({
      where: { id: customerId },
      data: isAdditional
        ? { additionalInfoFileUrl: url }
        : { infoFileUrl: url },
    });

    return NextResponse.json({
      url,
      fileName: newFileName,
      originalName: file.name,
    });
  } catch (error) {
    console.error("Error uploading info file:", error);
    return NextResponse.json(
      { error: "שגיאה בהעלאת קובץ האינפו" },
      { status: 500 }
    );
  }
}
