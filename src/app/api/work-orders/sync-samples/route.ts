import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { listFiles } from "@/lib/file-storage"
import { parseCpiFilename } from "@/lib/cpi-filename"

// Cache: last sync timestamp + result
let lastSyncAt = 0
const CACHE_TTL_MS = 60_000 // 60 seconds

// POST /api/work-orders/sync-samples — סנכרון דגימות מ-Google Drive
export async function POST() {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "לא מורשה" }, { status: 401 })
    }

    // Find active FULL update
    const activeUpdate = await prisma.updateVersion.findFirst({
      where: {
        updateType: "FULL",
        status: { in: ["PREPARING", "READY", "SENDING"] },
      },
      orderBy: { createdAt: "desc" },
    })

    if (!activeUpdate) {
      return NextResponse.json({
        success: true,
        message: "אין עדכון FULL פעיל",
        synced: 0,
      })
    }

    // Check cache
    const now = Date.now()
    if (now - lastSyncAt < CACHE_TTL_MS) {
      return NextResponse.json({
        success: true,
        message: "סנכרון אחרון עדיין תקף",
        cached: true,
      })
    }

    // List all CPI files from Drive
    const files = await listFiles("updates/samples")

    // Parse filenames and build set of customer IDs with CPI files
    const customerIdsWithCpi = new Set<number>()
    for (const file of files) {
      const filename = file.path.split("/").pop() || ""
      if (!filename.toLowerCase().endsWith(".cpi")) continue
      const parsed = parseCpiFilename(filename)
      if (parsed.customerId !== null) {
        customerIdsWithCpi.add(parsed.customerId)
      }
    }

    // Get all eligible customers for this update
    const nowDate = new Date()
    const eligibleCustomers = await prisma.customer.findMany({
      where: {
        status: { in: ["ACTIVE", "EXCEPTION"] },
        isCasual: false,
        setType: { includesUpdates: true },
        OR: [
          { updateExpiryDate: { gte: nowDate } },
          { status: "EXCEPTION" },
        ],
        NOT: {
          customerUpdates: {
            some: { updateVersionId: activeUpdate.id, sentAt: { not: null } },
          },
        },
      },
      select: { id: true },
    })

    // Batch upsert SamplePrepStatus for each eligible customer
    const syncTime = new Date()
    const operations = eligibleCustomers.map((c) => {
      const hasFile = customerIdsWithCpi.has(c.id)
      return prisma.samplePrepStatus.upsert({
        where: {
          customerId_updateVersionId: {
            customerId: c.id,
            updateVersionId: activeUpdate.id,
          },
        },
        create: {
          customerId: c.id,
          updateVersionId: activeUpdate.id,
          driveFileExists: hasFile,
          lastSyncedAt: syncTime,
        },
        update: {
          driveFileExists: hasFile,
          lastSyncedAt: syncTime,
        },
      })
    })

    await prisma.$transaction(operations)

    lastSyncAt = now

    return NextResponse.json({
      success: true,
      synced: eligibleCustomers.length,
      withCpi: customerIdsWithCpi.size,
      updateVersion: activeUpdate.version,
    })
  } catch (error) {
    console.error("Error syncing samples:", error)
    return NextResponse.json(
      { error: "שגיאה בסנכרון דגימות" },
      { status: 500 }
    )
  }
}
