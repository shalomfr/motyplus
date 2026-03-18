import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/accounting/reports — דוחות כספיים
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "לא מורשה. יש להתחבר למערכת" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "monthly";
    const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));
    const month = searchParams.get("month") ? parseInt(searchParams.get("month")!) : undefined;

    switch (type) {
      case "monthly":
        return await getMonthlyReport(year);
      case "quarterly":
        return await getQuarterlyReport(year);
      case "yearly":
        return await getYearlyReport(year);
      case "by_payment_method":
        return await getByPaymentMethodReport(year, month);
      case "debts":
        return await getDebtsReport();
      default:
        return NextResponse.json({ error: "סוג דוח לא תקין" }, { status: 400 });
    }
  } catch (error) {
    console.error("Error generating report:", error);
    return NextResponse.json({ error: "שגיאה ביצירת דוח" }, { status: 500 });
  }
}

// דוח חודשי — סיכום תשלומים לפי חודש
async function getMonthlyReport(year: number) {
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year + 1, 0, 1);

  const payments = await prisma.payment.findMany({
    where: {
      status: "COMPLETED",
      createdAt: { gte: startDate, lt: endDate },
    },
    select: { amount: true, createdAt: true },
  });

  const monthNames = [
    "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
    "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
  ];

  const report = monthNames.map((label, index) => {
    const monthPayments = payments.filter(
      (p) => new Date(p.createdAt).getMonth() === index
    );
    const total = monthPayments.reduce((sum, p) => sum + Number(p.amount), 0);
    return {
      month: index + 1,
      label,
      total,
      count: monthPayments.length,
    };
  });

  const totalAmount = payments.reduce((sum, p) => sum + Number(p.amount), 0);

  return NextResponse.json({
    report,
    summary: {
      total: totalAmount,
      count: payments.length,
      average: payments.length > 0 ? totalAmount / payments.length : 0,
    },
  });
}

// דוח רבעוני — סיכום תשלומים לפי רבעון
async function getQuarterlyReport(year: number) {
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year + 1, 0, 1);

  const payments = await prisma.payment.findMany({
    where: {
      status: "COMPLETED",
      createdAt: { gte: startDate, lt: endDate },
    },
    select: { amount: true, createdAt: true },
  });

  const quarterLabels = ["Q1 (ינו׳-מרץ)", "Q2 (אפר׳-יוני)", "Q3 (יולי-ספט׳)", "Q4 (אוק׳-דצמ׳)"];

  const report = quarterLabels.map((label, index) => {
    const quarterStart = index * 3;
    const quarterPayments = payments.filter((p) => {
      const m = new Date(p.createdAt).getMonth();
      return m >= quarterStart && m < quarterStart + 3;
    });
    const total = quarterPayments.reduce((sum, p) => sum + Number(p.amount), 0);
    return {
      quarter: index + 1,
      label,
      total,
      count: quarterPayments.length,
    };
  });

  const totalAmount = payments.reduce((sum, p) => sum + Number(p.amount), 0);

  return NextResponse.json({
    report,
    summary: {
      total: totalAmount,
      count: payments.length,
      average: payments.length > 0 ? totalAmount / payments.length : 0,
    },
  });
}

// דוח שנתי — סיכום כללי לשנה
async function getYearlyReport(year: number) {
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year + 1, 0, 1);

  const payments = await prisma.payment.findMany({
    where: {
      status: "COMPLETED",
      createdAt: { gte: startDate, lt: endDate },
    },
    select: { amount: true, createdAt: true },
  });

  const totalAmount = payments.reduce((sum, p) => sum + Number(p.amount), 0);

  const report = [
    {
      year,
      total: totalAmount,
      count: payments.length,
    },
  ];

  return NextResponse.json({
    report,
    summary: {
      total: totalAmount,
      count: payments.length,
      average: payments.length > 0 ? totalAmount / payments.length : 0,
    },
  });
}

// דוח לפי אמצעי תשלום
async function getByPaymentMethodReport(year: number, month?: number) {
  const startDate = month
    ? new Date(year, month - 1, 1)
    : new Date(year, 0, 1);
  const endDate = month
    ? new Date(year, month, 1)
    : new Date(year + 1, 0, 1);

  const payments = await prisma.payment.findMany({
    where: {
      status: "COMPLETED",
      createdAt: { gte: startDate, lt: endDate },
    },
    select: { amount: true, paymentMethod: true },
  });

  const methodLabels: Record<string, string> = {
    cash: "מזומן",
    check: "צ׳ק",
    bank_transfer: "העברה בנקאית",
    credit_card: "כרטיס אשראי",
    bit: "ביט",
  };

  const grouped: Record<string, { total: number; count: number }> = {};

  for (const p of payments) {
    const method = p.paymentMethod || "other";
    if (!grouped[method]) {
      grouped[method] = { total: 0, count: 0 };
    }
    grouped[method].total += Number(p.amount);
    grouped[method].count += 1;
  }

  const report = Object.entries(grouped).map(([method, data]) => ({
    paymentMethod: method,
    label: methodLabels[method] || method,
    total: data.total,
    count: data.count,
  }));

  const totalAmount = payments.reduce((sum, p) => sum + Number(p.amount), 0);

  return NextResponse.json({
    report,
    summary: {
      total: totalAmount,
      count: payments.length,
      average: payments.length > 0 ? totalAmount / payments.length : 0,
    },
  });
}

// דוח חובות — לקוחות שלא שילמו מלא
async function getDebtsReport() {
  const customers = await prisma.customer.findMany({
    include: {
      setType: { select: { id: true, name: true, price: true } },
    },
  });

  const report = customers
    .filter((c) => {
      if (!c.setType?.price) return false;
      return Number(c.amountPaid) < Number(c.setType.price);
    })
    .map((c) => ({
      customerId: c.id,
      fullName: c.fullName,
      email: c.email,
      phone: c.phone,
      setType: c.setType?.name,
      price: Number(c.setType?.price || 0),
      amountPaid: Number(c.amountPaid),
      debt: Number(c.setType?.price || 0) - Number(c.amountPaid),
    }))
    .sort((a, b) => b.debt - a.debt);

  const totalDebt = report.reduce((sum, r) => sum + r.debt, 0);

  return NextResponse.json({
    report,
    summary: {
      total: totalDebt,
      count: report.length,
      average: report.length > 0 ? totalDebt / report.length : 0,
    },
  });
}
