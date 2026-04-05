import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

interface SampleCustomerResult {
  id: number
  fullName: string
  email: string
  phone: string
  customerId: string | null
  organName: string
  currentUpdateVersion: string | null
  markedDoneAt: Date | null
  driveFileExists: boolean
}

async function getApprovalCustomers() {
  return prisma.customer.findMany({
    where: { status: "PENDING_APPROVAL" },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      organId: true,
      createdAt: true,
      amountPaid: true,
      organ: { select: { name: true } },
      setType: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  })
}

async function getSetCustomers() {
  return prisma.customer.findMany({
    where: {
      orderSentAt: null,
      status: "ACTIVE",
      OR: [
        { amountPaid: { gt: 0 } },
        { payments: { some: { status: "COMPLETED" } } },
      ],
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      customerId: true,
      createdAt: true,
      amountPaid: true,
      organ: { select: { name: true } },
      setType: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  })
}

async function getSampleData() {
  const activeUpdate = await prisma.updateVersion.findFirst({
    where: {
      updateType: "FULL",
      status: { in: ["PREPARING", "READY", "SENDING"] },
    },
    orderBy: { createdAt: "desc" },
  })

  if (!activeUpdate) {
    return { customers: [] as SampleCustomerResult[], activeUpdate: null }
  }

  const now = new Date()
  const eligible = await prisma.customer.findMany({
    where: {
      status: { in: ["ACTIVE", "EXCEPTION"] },
      isCasual: false,
      setType: { includesUpdates: true },
      OR: [
        { updateExpiryDate: { gte: now } },
        { status: "EXCEPTION" },
      ],
      NOT: {
        customerUpdates: {
          some: { updateVersionId: activeUpdate.id, sentAt: { not: null } },
        },
      },
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      customerId: true,
      currentUpdateVersion: true,
      organ: { select: { name: true } },
      samplePrepStatuses: {
        where: { updateVersionId: activeUpdate.id },
        select: { markedDoneAt: true, driveFileExists: true },
      },
    },
    orderBy: { fullName: "asc" },
  })

  const customers: SampleCustomerResult[] = eligible.map((c) => {
    const prep = c.samplePrepStatuses[0]
    return {
      id: c.id,
      fullName: c.fullName,
      email: c.email,
      phone: c.phone,
      customerId: c.customerId,
      organName: c.organ.name,
      currentUpdateVersion: c.currentUpdateVersion,
      markedDoneAt: prep?.markedDoneAt ?? null,
      driveFileExists: prep?.driveFileExists ?? false,
    }
  })

  return {
    customers,
    activeUpdate: { id: activeUpdate.id, version: activeUpdate.version },
  }
}

// GET /api/work-orders — רשימת עבודה: קוביות משימות
// ?cube=samples|sets|approval|all (default: all = counts only)
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "לא מורשה" }, { status: 401 })
    }

    const cube = request.nextUrl.searchParams.get("cube") || "all"

    if (cube === "all") {
      const [approvalCustomers, setCustomers, sampleData] = await Promise.all([
        getApprovalCustomers(),
        getSetCustomers(),
        getSampleData(),
      ])

      const pendingSamples = sampleData.customers.filter((c) => !c.driveFileExists).length

      return NextResponse.json({
        counts: {
          samples: { total: sampleData.customers.length, pending: pendingSamples },
          sets: { total: setCustomers.length },
          approval: { total: approvalCustomers.length },
        },
        activeUpdate: sampleData.activeUpdate,
      })
    }

    if (cube === "samples") {
      const sampleData = await getSampleData()
      return NextResponse.json({
        customers: sampleData.customers,
        activeUpdate: sampleData.activeUpdate,
      })
    }

    if (cube === "sets") {
      const setCustomers = await getSetCustomers()
      return NextResponse.json({
        customers: setCustomers.map((c) => ({
          ...c,
          amountPaid: Number(c.amountPaid),
          organName: c.organ.name,
          setTypeName: c.setType.name,
        })),
      })
    }

    if (cube === "approval") {
      const approvalCustomers = await getApprovalCustomers()
      return NextResponse.json({
        customers: approvalCustomers.map((c) => ({
          ...c,
          amountPaid: Number(c.amountPaid),
          organName: c.organ.name,
          setTypeName: c.setType.name,
        })),
      })
    }

    return NextResponse.json({ error: "cube לא תקין" }, { status: 400 })
  } catch (error) {
    console.error("Error fetching work orders:", error)
    return NextResponse.json({ error: "שגיאה בטעינת רשימת עבודה" }, { status: 500 })
  }
}
