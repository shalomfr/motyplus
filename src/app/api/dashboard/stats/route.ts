import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/dashboard/stats - סטטיסטיקות לוח בקרה
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: "לא מורשה. יש להתחבר למערכת" },
        { status: 401 }
      );
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // הרצת כל השאילתות במקביל
    const [
      totalCustomers,
      newCustomersThisMonth,
      totalRevenue,
      activeLeadsCount,
      recentActivity,
      customersByOrgan,
      customersByStatus,
    ] = await Promise.all([
      // סך כל הלקוחות
      prisma.customer.count(),

      // לקוחות חדשים החודש
      prisma.customer.count({
        where: {
          createdAt: { gte: startOfMonth },
        },
      }),

      // סך הכנסות (סכום כל התשלומים שהושלמו)
      prisma.payment.aggregate({
        _sum: {
          amount: true,
        },
        where: {
          status: "COMPLETED",
        },
      }),

      // כמות לידים פעילים (לא סגורים)
      prisma.lead.count({
        where: {
          stage: {
            notIn: ["CLOSED_WON", "CLOSED_LOST"],
          },
        },
      }),

      // פעילות אחרונה (10 אחרונות)
      prisma.activityLog.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
          customer: {
            select: {
              id: true,
              fullName: true,
            },
          },
        },
      }),

      // לקוחות לפי סוג אורגן
      prisma.organ.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          _count: {
            select: { customers: true },
          },
        },
        orderBy: { sortOrder: "asc" },
      }),

      // לקוחות לפי סטטוס
      prisma.customer.groupBy({
        by: ["status"],
        _count: {
          id: true,
        },
      }),
    ]);

    // עיבוד התוצאות
    const customersByStatusMap = customersByStatus.reduce(
      (acc, item) => {
        acc[item.status] = item._count.id;
        return acc;
      },
      {} as Record<string, number>
    );

    const customersByOrganFormatted = customersByOrgan.map((organ) => ({
      id: organ.id,
      name: organ.name,
      count: organ._count.customers,
    }));

    return NextResponse.json({
      totalCustomers,
      newCustomersThisMonth,
      totalRevenue: Number(totalRevenue._sum.amount || 0),
      activeLeadsCount,
      recentActivity,
      customersByOrgan: customersByOrganFormatted,
      customersByStatus: {
        ACTIVE: customersByStatusMap.ACTIVE || 0,
        BLOCKED: customersByStatusMap.BLOCKED || 0,
        FROZEN: customersByStatusMap.FROZEN || 0,
        EXCEPTION: customersByStatusMap.EXCEPTION || 0,
      },
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return NextResponse.json(
      { error: "שגיאה בטעינת נתוני לוח הבקרה" },
      { status: 500 }
    );
  }
}
