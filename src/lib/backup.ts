import { Prisma } from "@prisma/client"
import { prisma } from "./prisma"

// Dependency order for restore (tables with no FK deps first)
const TABLE_ORDER = [
  "verificationTokens",
  "systemSettings",
  "emailTemplates",
  "promotions",
  "organs",
  "setTypes",
  "users",
  "updateVersions",
  "accounts",
  "sessions",
  "updateFiles",
  "customers",       // inserted without linkedCustomerId first
  "leads",
  "payments",
  "emailLogs",
  "customerUpdates",
  "activityLogs",
  "leadNotes",
  "fileStorage",
] as const

type TableKey = (typeof TABLE_ORDER)[number]

// Reverse order for deletion (most dependent first)
const DELETE_ORDER = [...TABLE_ORDER].reverse()

interface BackupMetadata {
  version: string
  exportedAt: string
  totalRecords: number
}

export interface BackupData {
  metadata: BackupMetadata
  data: Record<TableKey, unknown[]>
}

// Convert Decimal fields to string for JSON serialization
function serializeRecord(record: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(record)) {
    if (value !== null && typeof value === "object" && "toFixed" in (value as object)) {
      // Prisma Decimal
      result[key] = (value as { toString(): string }).toString()
    } else if (value instanceof Buffer) {
      result[key] = value.toString("base64")
    } else {
      result[key] = value
    }
  }
  return result
}

export async function exportAllData(): Promise<BackupData> {
  const [
    verificationTokens,
    systemSettings,
    emailTemplates,
    promotions,
    organs,
    setTypes,
    users,
    updateVersions,
    accounts,
    sessions,
    updateFiles,
    customers,
    leads,
    payments,
    emailLogs,
    customerUpdates,
    activityLogs,
    leadNotes,
    fileStorage,
  ] = await Promise.all([
    prisma.verificationToken.findMany(),
    prisma.systemSetting.findMany(),
    prisma.emailTemplate.findMany(),
    prisma.promotion.findMany(),
    prisma.organ.findMany(),
    prisma.setType.findMany(),
    prisma.user.findMany(),
    prisma.updateVersion.findMany(),
    prisma.account.findMany(),
    prisma.session.findMany(),
    prisma.updateFile.findMany(),
    prisma.customer.findMany(),
    prisma.lead.findMany(),
    prisma.payment.findMany(),
    prisma.emailLog.findMany(),
    prisma.customerUpdate.findMany(),
    prisma.activityLog.findMany(),
    prisma.leadNote.findMany(),
    prisma.fileStorage.findMany(),
  ])

  const data = {
    verificationTokens: verificationTokens.map((r) => serializeRecord(r as unknown as Record<string, unknown>)),
    systemSettings: systemSettings.map((r) => serializeRecord(r as unknown as Record<string, unknown>)),
    emailTemplates: emailTemplates.map((r) => serializeRecord(r as unknown as Record<string, unknown>)),
    promotions: promotions.map((r) => serializeRecord(r as unknown as Record<string, unknown>)),
    organs: organs.map((r) => serializeRecord(r as unknown as Record<string, unknown>)),
    setTypes: setTypes.map((r) => serializeRecord(r as unknown as Record<string, unknown>)),
    users: users.map((r) => serializeRecord(r as unknown as Record<string, unknown>)),
    updateVersions: updateVersions.map((r) => serializeRecord(r as unknown as Record<string, unknown>)),
    accounts: accounts.map((r) => serializeRecord(r as unknown as Record<string, unknown>)),
    sessions: sessions.map((r) => serializeRecord(r as unknown as Record<string, unknown>)),
    updateFiles: updateFiles.map((r) => serializeRecord(r as unknown as Record<string, unknown>)),
    customers: customers.map((r) => serializeRecord(r as unknown as Record<string, unknown>)),
    leads: leads.map((r) => serializeRecord(r as unknown as Record<string, unknown>)),
    payments: payments.map((r) => serializeRecord(r as unknown as Record<string, unknown>)),
    emailLogs: emailLogs.map((r) => serializeRecord(r as unknown as Record<string, unknown>)),
    customerUpdates: customerUpdates.map((r) => serializeRecord(r as unknown as Record<string, unknown>)),
    activityLogs: activityLogs.map((r) => serializeRecord(r as unknown as Record<string, unknown>)),
    leadNotes: leadNotes.map((r) => serializeRecord(r as unknown as Record<string, unknown>)),
    fileStorage: fileStorage.map((r) => serializeRecord(r as unknown as Record<string, unknown>)),
  }

  let totalRecords = 0
  for (const key of TABLE_ORDER) {
    totalRecords += data[key].length
  }

  return {
    metadata: {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      totalRecords,
    },
    data,
  }
}

export async function importAllData(backup: BackupData): Promise<{ tablesRestored: number; totalRecords: number }> {
  // Validate
  if (!backup.metadata?.version || !backup.data) {
    throw new Error("קובץ גיבוי לא תקין — חסר metadata או data")
  }

  const SUPPORTED_VERSIONS = ["1.0"];
  if (!SUPPORTED_VERSIONS.includes(backup.metadata.version)) {
    throw new Error(`גרסת גיבוי ${backup.metadata.version} לא נתמכת. גרסאות נתמכות: ${SUPPORTED_VERSIONS.join(", ")}`)
  }

  for (const key of TABLE_ORDER) {
    if (!Array.isArray(backup.data[key])) {
      // Allow missing tables (treat as empty)
      backup.data[key] = []
    }
  }

  let totalRecords = 0
  let tablesRestored = 0

  await prisma.$transaction(async (tx) => {
    // 1. Delete all data in reverse dependency order
    for (const key of DELETE_ORDER) {
      const tableName = TABLE_NAME_MAP[key]
      await tx.$executeRawUnsafe(`DELETE FROM "${tableName}"`)
    }

    // 2. Insert in dependency order
    // --- Tables with string IDs (cuid) ---
    for (const vt of backup.data.verificationTokens as Record<string, unknown>[]) {
      await tx.verificationToken.create({ data: { identifier: vt.identifier as string, token: vt.token as string, expires: new Date(vt.expires as string) } })
    }
    for (const r of backup.data.systemSettings as Record<string, unknown>[]) {
      await tx.systemSetting.create({ data: { id: r.id as string, key: r.key as string, value: r.value as string, updatedAt: new Date(r.updatedAt as string) } })
    }
    for (const r of backup.data.emailTemplates as Record<string, unknown>[]) {
      await tx.emailTemplate.create({
        data: {
          id: r.id as string, name: r.name as string, subject: r.subject as string,
          body: r.body as string, category: r.category as string | null,
          variables: r.variables as string[], isActive: r.isActive as boolean,
          createdAt: new Date(r.createdAt as string), updatedAt: new Date(r.updatedAt as string),
        },
      })
    }
    for (const r of backup.data.promotions as Record<string, unknown>[]) {
      await tx.promotion.create({
        data: {
          id: r.id as string, name: r.name as string, discountPercent: r.discountPercent as number,
          couponCode: r.couponCode as string, validFrom: new Date(r.validFrom as string),
          validUntil: new Date(r.validUntil as string), isActive: r.isActive as boolean,
          maxUses: r.maxUses as number | null, currentUses: r.currentUses as number,
          createdAt: new Date(r.createdAt as string), updatedAt: new Date(r.updatedAt as string),
        },
      })
    }
    for (const r of backup.data.organs as Record<string, unknown>[]) {
      await tx.organ.create({
        data: {
          id: r.id as string, name: r.name as string, folderAlias: r.folderAlias as string | null,
          organInfoFileUrl: r.organInfoFileUrl as string | null, organInfoNumber: r.organInfoNumber as string | null,
          supportsUpdates: r.supportsUpdates as boolean, sortOrder: r.sortOrder as number,
          isActive: r.isActive as boolean,
        },
      })
    }
    for (const r of backup.data.setTypes as Record<string, unknown>[]) {
      await tx.setType.create({
        data: {
          id: r.id as string, name: r.name as string, folderAlias: r.folderAlias as string | null,
          price: r.price as string, includesUpdates: r.includesUpdates as boolean,
          sortOrder: r.sortOrder as number, isActive: r.isActive as boolean,
        },
      })
    }
    for (const r of backup.data.users as Record<string, unknown>[]) {
      await tx.user.create({
        data: {
          id: r.id as string, email: r.email as string, name: r.name as string,
          passwordHash: r.passwordHash as string, role: r.role as "ADMIN" | "AGENT",
          isActive: r.isActive as boolean,
          createdAt: new Date(r.createdAt as string), updatedAt: new Date(r.updatedAt as string),
        },
      })
    }
    for (const r of backup.data.updateVersions as Record<string, unknown>[]) {
      await tx.updateVersion.create({
        data: {
          id: r.id as string, version: r.version as string, price: r.price as string,
          releaseDate: r.releaseDate ? new Date(r.releaseDate as string) : null,
          description: r.description as string | null, status: r.status as "DRAFT" | "PREPARING" | "READY" | "SENDING" | "COMPLETED",
          rhythmsFileUrl: r.rhythmsFileUrl as string | null, samplesFileUrl: r.samplesFileUrl as string | null,
          personalizedSamplesZipUrl: r.personalizedSamplesZipUrl as string | null,
          ppfFileUrl: r.ppfFileUrl as string | null, masterZipUrl: r.masterZipUrl as string | null,
          emailSubject: r.emailSubject as string | null, emailBody: r.emailBody as string | null,
          sortOrder: r.sortOrder as number,
          createdAt: new Date(r.createdAt as string), updatedAt: new Date(r.updatedAt as string),
        },
      })
    }
    for (const r of backup.data.accounts as Record<string, unknown>[]) {
      await tx.account.create({
        data: {
          id: r.id as string, userId: r.userId as string, type: r.type as string,
          provider: r.provider as string, providerAccountId: r.providerAccountId as string,
          refresh_token: r.refresh_token as string | null, access_token: r.access_token as string | null,
          expires_at: r.expires_at as number | null, token_type: r.token_type as string | null,
          scope: r.scope as string | null, id_token: r.id_token as string | null,
          session_state: r.session_state as string | null,
        },
      })
    }
    for (const r of backup.data.sessions as Record<string, unknown>[]) {
      await tx.session.create({
        data: {
          id: r.id as string, sessionToken: r.sessionToken as string,
          userId: r.userId as string, expires: new Date(r.expires as string),
        },
      })
    }
    for (const r of backup.data.updateFiles as Record<string, unknown>[]) {
      await tx.updateFile.create({
        data: {
          id: r.id as string, updateVersionId: r.updateVersionId as string,
          setTypeId: r.setTypeId as string, organId: r.organId as string,
          fileUrl: r.fileUrl as string, fileSize: r.fileSize as number | null,
          originalPath: r.originalPath as string | null,
          createdAt: new Date(r.createdAt as string), updatedAt: new Date(r.updatedAt as string),
        },
      })
    }

    // Customers — first pass without linkedCustomerId
    for (const r of backup.data.customers as Record<string, unknown>[]) {
      await tx.customer.create({
        data: {
          id: r.id as number, fullName: r.fullName as string, phone: r.phone as string,
          whatsappPhone: r.whatsappPhone as string | null, address: r.address as string | null,
          email: r.email as string, purchaseDate: new Date(r.purchaseDate as string),
          updateExpiryDate: new Date(r.updateExpiryDate as string),
          organId: r.organId as string, additionalOrganId: r.additionalOrganId as string | null,
          setTypeId: r.setTypeId as string, customerId: r.customerId as string | null,
          amountPaid: r.amountPaid as string, status: r.status as "ACTIVE" | "BLOCKED" | "FROZEN" | "EXCEPTION",
          sampleType: r.sampleType as "CPI" | "CPF",
          currentUpdateVersion: r.currentUpdateVersion as string | null,
          hasV3: r.hasV3 as boolean,
          infoFileUrl: r.infoFileUrl as string | null,
          additionalInfoFileUrl: r.additionalInfoFileUrl as string | null,
          notes: r.notes as string | null,
          isCasual: (r.isCasual as boolean) || false,
          linkedCustomerId: null, // set in second pass
          createdAt: new Date(r.createdAt as string), updatedAt: new Date(r.updatedAt as string),
        },
      })
    }

    // Customers — second pass: update linkedCustomerId
    const customersWithLinks = (backup.data.customers as Record<string, unknown>[]).filter((r) => r.linkedCustomerId != null)
    for (const r of customersWithLinks) {
      await tx.customer.update({
        where: { id: r.id as number },
        data: { linkedCustomerId: r.linkedCustomerId as number },
      })
    }

    for (const r of backup.data.leads as Record<string, unknown>[]) {
      await tx.lead.create({
        data: {
          id: r.id as string, fullName: r.fullName as string, phone: r.phone as string,
          email: r.email as string | null, organInterest: r.organInterest as string | null,
          organId: r.organId as string | null, source: r.source as string | null,
          stage: r.stage as "NEW" | "CONTACTED" | "PROPOSAL" | "CLOSED_WON" | "CLOSED_LOST",
          assignedAgentId: r.assignedAgentId as string | null,
          convertedCustomerId: r.convertedCustomerId as number | null,
          createdAt: new Date(r.createdAt as string), updatedAt: new Date(r.updatedAt as string),
        },
      })
    }
    for (const r of backup.data.payments as Record<string, unknown>[]) {
      await tx.payment.create({
        data: {
          id: r.id as string, customerId: r.customerId as number,
          amount: r.amount as string, description: r.description as string | null,
          status: r.status as "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED",
          paymentMethod: r.paymentMethod as string | null,
          externalPaymentId: r.externalPaymentId as string | null,
          promotionId: r.promotionId as string | null,
          createdAt: new Date(r.createdAt as string), updatedAt: new Date(r.updatedAt as string),
        },
      })
    }
    for (const r of backup.data.emailLogs as Record<string, unknown>[]) {
      await tx.emailLog.create({
        data: {
          id: r.id as string, customerId: r.customerId as number | null,
          leadId: r.leadId as string | null, templateId: r.templateId as string | null,
          toEmail: r.toEmail as string, subject: r.subject as string, body: r.body as string,
          status: r.status as "DRAFT" | "SENT" | "FAILED",
          sentAt: r.sentAt ? new Date(r.sentAt as string) : null,
          userId: r.userId as string | null,
        },
      })
    }
    for (const r of backup.data.customerUpdates as Record<string, unknown>[]) {
      await tx.customerUpdate.create({
        data: {
          id: r.id as string, customerId: r.customerId as number,
          updateVersionId: r.updateVersionId as string,
          updateFileId: r.updateFileId as string | null,
          sentAt: r.sentAt ? new Date(r.sentAt as string) : null,
          downloadedAt: r.downloadedAt ? new Date(r.downloadedAt as string) : null,
          sentById: r.sentById as string | null,
          robotProcessed: r.robotProcessed as boolean,
          robotError: r.robotError as string | null,
          createdAt: new Date(r.createdAt as string),
        },
      })
    }
    for (const r of backup.data.activityLogs as Record<string, unknown>[]) {
      await tx.activityLog.create({
        data: {
          id: r.id as string, userId: r.userId as string | null,
          customerId: r.customerId as number | null,
          action: r.action as string, entityType: r.entityType as string,
          entityId: r.entityId as string, details: r.details === null ? Prisma.JsonNull : (r.details as Prisma.InputJsonValue),
          createdAt: new Date(r.createdAt as string),
        },
      })
    }
    for (const r of backup.data.leadNotes as Record<string, unknown>[]) {
      await tx.leadNote.create({
        data: {
          id: r.id as string, leadId: r.leadId as string,
          userId: r.userId as string, content: r.content as string,
          createdAt: new Date(r.createdAt as string),
        },
      })
    }
    for (const r of backup.data.fileStorage as Record<string, unknown>[]) {
      await tx.fileStorage.create({
        data: {
          id: r.id as string, path: r.path as string,
          data: Buffer.from(r.data as string, "base64"),
          size: r.size as number, mimeType: r.mimeType as string | null,
          createdAt: new Date(r.createdAt as string), updatedAt: new Date(r.updatedAt as string),
        },
      })
    }

    // 3. Fix auto-increment sequence for Customer.id
    await tx.$executeRawUnsafe(`SELECT setval('"Customer_id_seq"', COALESCE((SELECT MAX(id) FROM "Customer"), 1))`)
  }, { timeout: 120000 }) // 2 min timeout for large datasets

  for (const key of TABLE_ORDER) {
    if (backup.data[key].length > 0) tablesRestored++
    totalRecords += backup.data[key].length
  }

  return { tablesRestored, totalRecords }
}

// Map backup key -> actual PostgreSQL table name
const TABLE_NAME_MAP: Record<TableKey, string> = {
  verificationTokens: "VerificationToken",
  systemSettings: "SystemSetting",
  emailTemplates: "EmailTemplate",
  promotions: "Promotion",
  organs: "Organ",
  setTypes: "SetType",
  users: "User",
  updateVersions: "UpdateVersion",
  accounts: "Account",
  sessions: "Session",
  updateFiles: "UpdateFile",
  customers: "Customer",
  leads: "Lead",
  payments: "Payment",
  emailLogs: "EmailLog",
  customerUpdates: "CustomerUpdate",
  activityLogs: "ActivityLog",
  leadNotes: "LeadNote",
  fileStorage: "FileStorage",
}
