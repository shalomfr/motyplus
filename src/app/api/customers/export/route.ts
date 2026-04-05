import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import * as XLSX from "xlsx";

// GET /api/customers/export - ייצוא לקוחות לאקסל
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: "לא מורשה. יש להתחבר למערכת" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const organId = searchParams.get("organId");
    const setTypeId = searchParams.get("setTypeId");
    const status = searchParams.get("status");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const missingDetails = searchParams.get("missingDetails");
    const missingField = searchParams.get("missingField");
    const maxUpdateVersion = searchParams.get("maxUpdateVersion");

    // בניית תנאי סינון (זהה לרשימת לקוחות)
    const where: Prisma.CustomerWhereInput = {};

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    if (organId) where.organId = organId;
    if (setTypeId) where.setTypeId = setTypeId;
    if (status) where.status = status as Prisma.EnumCustomerStatusFilter;

    if (dateFrom || dateTo) {
      where.purchaseDate = {};
      if (dateFrom) where.purchaseDate.gte = new Date(dateFrom);
      if (dateTo) where.purchaseDate.lte = new Date(dateTo);
    }

    // סינון לפי פרטים חסרים
    if (missingDetails === "true") {
      const fieldMap: Record<string, Prisma.CustomerWhereInput[]> = {
        email: [{ email: "" }],
        phone: [{ phone: "" }],
        address: [{ address: null }, { address: "" }],
        infoFile: [{ infoFileUrl: null }, { infoFileUrl: "" }],
        whatsapp: [{ whatsappPhone: null }, { whatsappPhone: "" }],
      };

      const missingCondition: Prisma.CustomerWhereInput = missingField && fieldMap[missingField]
        ? { OR: fieldMap[missingField] }
        : {
            OR: [
              { address: null },
              { address: "" },
              { whatsappPhone: null },
              { whatsappPhone: "" },
            ],
          };

      if (search) {
        const searchCondition = {
          OR: [
            { fullName: { contains: search, mode: "insensitive" as const } },
            { phone: { contains: search } },
            { email: { contains: search, mode: "insensitive" as const } },
          ],
        };
        where.AND = [searchCondition, missingCondition];
        delete where.OR;
      } else {
        Object.assign(where, missingCondition);
      }
    }

    // סינון לפי גרסת עדכון
    if (maxUpdateVersion === "not_updated") {
      const versionCondition: Prisma.CustomerWhereInput = {
        OR: [
          { currentUpdateVersion: null },
          { currentUpdateVersion: "" },
        ],
      };
      if (where.AND) {
        (where.AND as Prisma.CustomerWhereInput[]).push(versionCondition);
      } else {
        where.AND = [versionCondition];
      }
    } else if (maxUpdateVersion) {
      // סינון עד גרסה כולל — כל הלקוחות עם גרסה <= לגרסה שנבחרה + לא מעודכנים
      const selectedVersion = await prisma.updateVersion.findFirst({
        where: { version: maxUpdateVersion },
        select: { sortOrder: true },
      });
      if (selectedVersion) {
        const versionsUpTo = await prisma.updateVersion.findMany({
          where: { sortOrder: { lte: selectedVersion.sortOrder } },
          select: { version: true },
        });
        const versionStrings = versionsUpTo.map((v) => v.version);
        const versionCondition: Prisma.CustomerWhereInput = {
          OR: [
            { currentUpdateVersion: { in: versionStrings } },
            { currentUpdateVersion: null },
            { currentUpdateVersion: "" },
          ],
        };
        if (where.AND) {
          (where.AND as Prisma.CustomerWhereInput[]).push(versionCondition);
        } else {
          where.AND = [versionCondition];
        }
      }
    }

    const customers = await prisma.customer.findMany({
      where,
      include: {
        organ: true,
        setType: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // הכנת נתונים לאקסל
    const excelData = customers.map((customer) => ({
      "מזהה": customer.id,
      "קוד לקוח": customer.customerId || "",
      "שם מלא": customer.fullName,
      "טלפון": customer.phone,
      "וואטסאפ": customer.whatsappPhone || "",
      "כתובת": customer.address || "",
      "אימייל": customer.email,
      "אורגן": customer.organ.name,
      "סוג סט": customer.setType.name,
      "סכום ששולם": Number(customer.amountPaid),
      "תאריך רכישה": customer.purchaseDate ? new Date(customer.purchaseDate) : "",
      "תפוגת עדכונים": customer.updateExpiryDate ? new Date(customer.updateExpiryDate) : "",
      "סטטוס": customer.status,
      "סוג דגימה": customer.sampleType,
      "גרסה נוכחית": customer.currentUpdateVersion || "",
      "V3": customer.hasV3 ? "כן" : "לא",
      "הערות": customer.notes || "",
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(excelData);

    // הגדרת רוחב עמודות
    worksheet["!cols"] = [
      { wch: 8 },   // מזהה
      { wch: 12 },  // קוד לקוח
      { wch: 20 },  // שם מלא
      { wch: 15 },  // טלפון
      { wch: 15 },  // וואטסאפ
      { wch: 25 },  // כתובת
      { wch: 25 },  // אימייל
      { wch: 15 },  // אורגן
      { wch: 15 },  // סוג סט
      { wch: 12 },  // סכום
      { wch: 15 },  // תאריך רכישה
      { wch: 15 },  // תפוגה
      { wch: 10 },  // סטטוס
      { wch: 10 },  // סוג דגימה
      { wch: 12 },  // גרסה
      { wch: 5 },   // V3
      { wch: 30 },  // הערות
    ];

    // הוספת AutoFilter על כל העמודות
    const colCount = 17; // מספר העמודות
    const rowCount = excelData.length + 1; // שורות + כותרת
    worksheet["!autofilter"] = {
      ref: XLSX.utils.encode_range({
        s: { r: 0, c: 0 },
        e: { r: rowCount - 1, c: colCount - 1 },
      }),
    };

    XLSX.utils.book_append_sheet(workbook, worksheet, "לקוחות");

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="customers_${new Date().toISOString().split("T")[0]}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Error exporting customers:", error);
    return NextResponse.json(
      { error: "שגיאה בייצוא הלקוחות" },
      { status: 500 }
    );
  }
}
