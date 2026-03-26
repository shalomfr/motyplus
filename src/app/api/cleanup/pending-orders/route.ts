import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Clean up old PendingOrders that are stuck in PENDING status
export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "לא מורשה" }, { status: 401 });
  }

  // Delete PendingOrders older than 7 days that are still PENDING
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const result = await prisma.pendingOrder.deleteMany({
    where: {
      status: "PENDING",
      createdAt: { lt: sevenDaysAgo },
    },
  });

  return NextResponse.json({
    message: `נמחקו ${result.count} הזמנות ממתינות ישנות`,
    count: result.count,
  });
}

// GET: Show stats about pending orders
export async function GET(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "לא מורשה" }, { status: 401 });
  }

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [total, old, completed] = await Promise.all([
    prisma.pendingOrder.count({ where: { status: "PENDING" } }),
    prisma.pendingOrder.count({ where: { status: "PENDING", createdAt: { lt: sevenDaysAgo } } }),
    prisma.pendingOrder.count({ where: { status: "COMPLETED" } }),
  ]);

  return NextResponse.json({ pending: total, olderThan7Days: old, completed });
}
