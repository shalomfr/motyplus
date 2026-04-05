import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { customerSchema } from "@/lib/validators";
import { logActivity } from "@/lib/activity-logger";
import { Prisma } from "@prisma/client";

// GET /api/customers - רשימת לקוחות עם סינון ודפדוף
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
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "25");
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") || "desc";

    const skip = (page - 1) * limit;

    // בניית תנאי סינון
    const where: Prisma.CustomerWhereInput = {};

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    if (organId) {
      where.organId = organId;
    }

    if (setTypeId) {
      where.setTypeId = setTypeId;
    }

    if (status) {
      where.status = status as Prisma.EnumCustomerStatusFilter;
    }

    if (dateFrom || dateTo) {
      where.purchaseDate = {};
      if (dateFrom) {
        where.purchaseDate.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.purchaseDate.lte = new Date(dateTo);
      }
    }

    if (missingDetails === "true") {
      // Specific field or any missing
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
      // לא זכאים לעדכון — לקוחות בלי עדכון בכלל
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

    // בניית מיון
    const orderBy: Prisma.CustomerOrderByWithRelationInput = {};
    if (sortBy === "organ") {
      orderBy.organ = { name: sortOrder as Prisma.SortOrder };
    } else if (sortBy === "setType") {
      orderBy.setType = { name: sortOrder as Prisma.SortOrder };
    } else {
      (orderBy as Record<string, string>)[sortBy] = sortOrder;
    }

    const [customers, total, latestUpdate, fullSet] = await Promise.all([
      prisma.customer.findMany({
        where,
        include: {
          organ: { select: { id: true, name: true, supportsUpdates: true } },
          setType: { select: { id: true, name: true, price: true, includesUpdates: true } },
          promotion: { select: { discountPercent: true, couponCode: true } },
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.customer.count({ where }),
      prisma.updateVersion.findFirst({
        orderBy: { sortOrder: "desc" },
        select: { version: true },
      }),
      prisma.setType.findFirst({
        where: { includesUpdates: true },
        select: { price: true },
      }),
    ]);

    return NextResponse.json({
      customers,
      fullSetPrice: Number(fullSet?.price || 0),
      latestVersion: latestUpdate?.version || null,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching customers:", error);
    return NextResponse.json(
      { error: "שגיאה בטעינת הלקוחות" },
      { status: 500 }
    );
  }
}

// POST /api/customers - יצירת לקוח חדש
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: "לא מורשה. יש להתחבר למערכת" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validation = customerSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "נתונים לא תקינים", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const data = validation.data;

    // חישוב תאריך תפוגת עדכונים - שנה מתאריך רכישה
    const purchaseDate = data.purchaseDate
      ? new Date(data.purchaseDate)
      : new Date();
    const updateExpiryDate = new Date(purchaseDate);
    updateExpiryDate.setFullYear(updateExpiryDate.getFullYear() + 1);

    // #8: גרסת עדכון אוטומטית — ללקוח חדש עם סט שכולל עדכונים
    const setType = await prisma.setType.findUnique({ where: { id: data.setTypeId } });
    let currentUpdateVersion: string | null = null;
    if (setType?.includesUpdates) {
      const latestVersion = await prisma.updateVersion.findFirst({
        where: { status: { not: "DRAFT" } },
        orderBy: { sortOrder: "desc" },
        select: { version: true },
      });
      currentUpdateVersion = latestVersion?.version || null;
    }

    const customer = await prisma.customer.create({
      data: {
        fullName: data.fullName,
        phone: data.phone,
        whatsappPhone: data.whatsappPhone || null,
        address: data.address || null,
        email: data.email,
        organId: data.organId || "",
        additionalOrganId: data.additionalOrganId || null,
        setTypeId: data.setTypeId,
        amountPaid: data.amountPaid,
        discountReason: data.discountReason || null,
        purchaseDate,
        updateExpiryDate,
        notes: data.notes || null,
        infoFileUrl: data.infoFileUrl || null,
        hasV3: true, // #19: V3 אוטומטי לכל לקוח חדש
        currentUpdateVersion, // #8: גרסה אחרונה אם סט שלם
      },
      include: {
        organ: true,
        additionalOrgan: true,
        setType: true,
        promotion: { select: { id: true, name: true, discountPercent: true, couponCode: true } },
      },
    });

    await logActivity({
      userId: session.user.id,
      customerId: customer.id,
      action: "CREATE",
      entityType: "CUSTOMER",
      entityId: String(customer.id),
      details: { fullName: customer.fullName },
    });

    return NextResponse.json(customer, { status: 201 });
  } catch (error) {
    console.error("Error creating customer:", error);
    return NextResponse.json(
      { error: "שגיאה ביצירת הלקוח" },
      { status: 500 }
    );
  }
}
