import { prisma } from "@/lib/prisma";

// ===== Types =====

export interface DashboardStats {
  totalCustomers: number;
  newCustomersThisMonth: number;
  totalRevenue: number;
  activeLeadsCount: number;
  recentActivity: ActivityEntry[];
  customersByOrgan: OrganCount[];
  customersByStatus: StatusCounts;
  expiredUpdatesCount: number;
  notUpdatedCount: number;
  totalDebt: number;
}

export interface ActivityEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  details: Record<string, unknown> | null;
  createdAt: Date;
  user: { id: string; name: string } | null;
  customer: { id: number; fullName: string } | null;
}

export interface OrganCount {
  id: string;
  name: string;
  count: number;
}

export interface StatusCounts {
  ACTIVE: number;
  BLOCKED: number;
  FROZEN: number;
  EXCEPTION: number;
}

export interface MonthlyRevenue {
  month: string;
  label: string;
  revenue: number;
}

// ===== Service functions =====

export async function getDashboardStats(): Promise<DashboardStats> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalCustomers,
    newCustomersThisMonth,
    totalRevenue,
    activeLeadsCount,
    recentActivity,
    customersByOrgan,
    customersByStatus,
    expiredUpdatesCount,
    notUpdatedCount,
    totalDebtResult,
  ] = await Promise.all([
    prisma.customer.count(),
    prisma.customer.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.payment.aggregate({ _sum: { amount: true }, where: { status: "COMPLETED" } }),
    prisma.lead.count({ where: { stage: { notIn: ["CLOSED_WON", "CLOSED_LOST"] } } }),
    fetchRecentActivity(),
    fetchCustomersByOrgan(),
    fetchCustomersByStatus(),
    countExpiredUpdates(now),
    countNotUpdated(),
    fetchTotalDebt(),
  ]);

  return {
    totalCustomers,
    newCustomersThisMonth,
    totalRevenue: Number(totalRevenue._sum.amount || 0),
    activeLeadsCount,
    recentActivity,
    customersByOrgan,
    customersByStatus,
    expiredUpdatesCount,
    notUpdatedCount,
    totalDebt: totalDebtResult,
  };
}

export async function getMonthlyRevenue(): Promise<MonthlyRevenue[]> {
  const now = new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const payments = await prisma.payment.findMany({
    where: { createdAt: { gte: sixMonthsAgo }, status: "COMPLETED" },
    select: { amount: true, createdAt: true },
  });

  const monthNames = [
    "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
    "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
  ];

  const months: MonthlyRevenue[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const revenue = payments
      .filter((p) => {
        const pd = new Date(p.createdAt);
        return pd.getFullYear() === d.getFullYear() && pd.getMonth() === d.getMonth();
      })
      .reduce((sum, p) => sum + Number(p.amount), 0);

    months.push({ month: key, label: monthNames[d.getMonth()], revenue });
  }

  return months;
}

// ===== Helpers =====

async function fetchRecentActivity(): Promise<ActivityEntry[]> {
  const logs = await prisma.activityLog.findMany({
    take: 10,
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { id: true, name: true } },
      customer: { select: { id: true, fullName: true } },
    },
  });

  return logs.map((log) => ({
    id: log.id,
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    details: log.details as Record<string, unknown> | null,
    createdAt: log.createdAt,
    user: log.user,
    customer: log.customer,
  }));
}

async function fetchCustomersByOrgan(): Promise<OrganCount[]> {
  const organs = await prisma.organ.findMany({
    where: { isActive: true },
    select: { id: true, name: true, _count: { select: { customers: true } } },
    orderBy: { sortOrder: "asc" },
  });

  return organs.map((o) => ({ id: o.id, name: o.name, count: o._count.customers }));
}

async function fetchCustomersByStatus(): Promise<StatusCounts> {
  const groups = await prisma.customer.groupBy({
    by: ["status"],
    _count: { id: true },
  });

  const map = groups.reduce(
    (acc, item) => { acc[item.status] = item._count.id; return acc; },
    {} as Record<string, number>,
  );

  return {
    ACTIVE: map.ACTIVE || 0,
    BLOCKED: map.BLOCKED || 0,
    FROZEN: map.FROZEN || 0,
    EXCEPTION: map.EXCEPTION || 0,
  };
}

async function countExpiredUpdates(now: Date): Promise<number> {
  return prisma.customer.count({
    where: {
      updateExpiryDate: { lt: now },
      status: "ACTIVE",
      setType: { includesUpdates: true },
      isCasual: false,
    },
  });
}

async function countNotUpdated(): Promise<number> {
  return prisma.customer.count({
    where: {
      currentUpdateVersion: null,
      status: { in: ["ACTIVE", "EXCEPTION"] },
      setType: { includesUpdates: true },
      isCasual: false,
    },
  });
}

async function fetchTotalDebt(): Promise<number> {
  const result = await prisma.$queryRaw<[{ total_debt: number }]>`
    SELECT COALESCE(SUM(CAST(s.price AS DECIMAL) - CAST(c."amountPaid" AS DECIMAL)), 0) as total_debt
    FROM "Customer" c
    JOIN "SetType" s ON c."setTypeId" = s.id
    WHERE CAST(s.price AS DECIMAL) > CAST(c."amountPaid" AS DECIMAL)
    AND c.status != 'BLOCKED'
  `;
  return Number(result?.[0]?.total_debt || 0);
}
