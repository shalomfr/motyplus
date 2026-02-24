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
      where.OR = [
        { address: null },
        { address: "" },
        { whatsappPhone: null },
        { whatsappPhone: "" },
      ];
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

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        include: {
          organ: true,
          setType: true,
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.customer.count({ where }),
    ]);

    return NextResponse.json({
      customers,
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

    const customer = await prisma.customer.create({
      data: {
        fullName: data.fullName,
        phone: data.phone,
        whatsappPhone: data.whatsappPhone,
        address: data.address,
        email: data.email,
        organId: data.organId,
        additionalOrganId: data.additionalOrganId,
        setTypeId: data.setTypeId,
        amountPaid: data.amountPaid,
        purchaseDate,
        updateExpiryDate,
        notes: data.notes,
      },
      include: {
        organ: true,
        setType: true,
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
