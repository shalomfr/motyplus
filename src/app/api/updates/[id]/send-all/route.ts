import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { logActivity } from "@/lib/activity-logger"
import { sendEmail, replaceTemplateVariables } from "@/lib/email"
import { sendWhatsApp } from "@/lib/whatsapp"
import { listFiles, shareFile, getShareableLink } from "@/lib/file-storage"
import { parseCpiFilename } from "@/lib/cpi-filename"
import { getBillingClient } from "@/lib/billing"
import { ORDER_FORM_URL, TERMS_URL, extractFilename } from "@/lib/utils"

// POST /api/updates/[id]/send-all — שליחת העדכון לכל הלקוחות הזכאים
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { error: "לא מורשה. יש להתחבר למערכת" },
        { status: 401 }
      )
    }

    const { id } = await params

    const updateVersion = await prisma.updateVersion.findUnique({
      where: { id },
    })

    if (!updateVersion) {
      return NextResponse.json(
        { error: "העדכון לא נמצא" },
        { status: 404 }
      )
    }

    // טעינת תבניות לפי אורגן, עם fallback לתבנית ברירת מחדל מ-DB
    const tMap = updateVersion.emailTemplateMap as Record<string, Record<string, { subject?: string; body?: string }>> | null
    let fallbackTemplate: { subject: string; body: string } | null = null
    if (!updateVersion.emailSubject || !updateVersion.emailBody) {
      const dbTemplate = await prisma.emailTemplate.findFirst({
        where: {
          OR: [
            { category: "after_purchase" },
            { name: { contains: "עדכון" } },
            { name: { contains: "שליחת" } },
          ],
          isActive: true,
        },
        orderBy: { updatedAt: "desc" },
        select: { subject: true, body: true },
      })
      if (dbTemplate) fallbackTemplate = dbTemplate
    }

    // קבלת רשימת לקוחות שכבר קיבלו את העדכון הזה
    const alreadyReceived = await prisma.customerUpdate.findMany({
      where: { updateVersionId: id },
      select: { customerId: true },
    })
    const alreadyReceivedIds = alreadyReceived.map((cu) => cu.customerId)

    // שליפת כל הלקוחות הזכאים:
    // - סט כולל עדכונים (includesUpdates = true)
    // - סטטוס ACTIVE (בתוקף) או EXCEPTION
    // - לא קיבלו כבר
    const now = new Date()

    const eligibleCustomers = await prisma.customer.findMany({
      where: {
        id: { notIn: alreadyReceivedIds.length > 0 ? alreadyReceivedIds : [-1] },
        status: { in: ["ACTIVE", "EXCEPTION"] },
        isCasual: false,
        organ: { supportsUpdates: true },
        OR: [
          { updateExpiryDate: { gte: now } },
          { status: "EXCEPTION" },
        ],
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        whatsappPhone: true,
        customerId: true,
        status: true,
        updateExpiryDate: true,
        organId: true,
        setTypeId: true,
        organ: { select: { name: true, installFileName: true } },
        additionalOrgan: { select: { name: true } },
        setType: { select: { includesUpdates: true, name: true, price: true } },
        amountPaid: true,
        purchaseDate: true,
        currentUpdateVersion: true,
      },
    })

    if (eligibleCustomers.length === 0) {
      return NextResponse.json(
        { error: "אין לקוחות זכאים לשליחה" },
        { status: 400 }
      )
    }

    // טעינת קבצי CPI מתיקיית updates/samples (שטוח)
    const folder = "updates/samples"
    let sampleFiles: { path: string }[] = []
    try {
      sampleFiles = await listFiles(folder)
    } catch {
      // folder may not exist
    }

    // בניית מפה: customerId → { main?: path, additional?: path }
    const cpiMap = new Map<number, { main?: string; additional?: string }>()
    for (const f of sampleFiles) {
      const name = f.path.split("/").pop() || ""
      const parsed = parseCpiFilename(name)
      if (parsed.customerId === null) continue

      if (!cpiMap.has(parsed.customerId)) cpiMap.set(parsed.customerId, {})
      const entry = cpiMap.get(parsed.customerId)!
      if (parsed.isAdditional) {
        entry.additional = f.path
      } else {
        entry.main = f.path
      }
    }

    // בניית מפה: organId_setTypeId → קישור מקצבים (אוטומטי מתיקיות דרייב)
    const [allOrgans, allSetTypes] = await Promise.all([
      prisma.organ.findMany({ select: { id: true, demoAlias: true } }),
      prisma.setType.findMany({ select: { id: true, demoAlias: true } }),
    ])
    const organAliasMap = new Map(allOrgans.map(o => [o.id, o.demoAlias]))
    const setTypeAliasMap = new Map(allSetTypes.map(st => [st.id, st.demoAlias]))

    const rhythmsLinkMap = new Map<string, string>()
    const uniqueCombos = new Set(eligibleCustomers.map(c => `${c.organId}_${c.setTypeId}`))

    for (const combo of uniqueCombos) {
      const [organId, setTypeId] = combo.split("_")
      const organAlias = organAliasMap.get(organId)
      const setTypeAlias = setTypeAliasMap.get(setTypeId)
      if (!organAlias || !setTypeAlias) continue

      const folderPath = `updates/beats/${organAlias}/${setTypeAlias}/${updateVersion.version} - ${organAlias}`
      try {
        rhythmsLinkMap.set(combo, await getShareableLink(folderPath))
      } catch (err) {
        console.error(`Rhythms folder not found: ${folderPath}`, err)
      }
    }

    // בדיקה שיש תבנית מייל זמינה
    const hasAnyTemplate = updateVersion.emailSubject || updateVersion.emailBody || tMap || fallbackTemplate
    if (!hasAnyTemplate) {
      return NextResponse.json(
        { error: "לא הוגדרה תבנית מייל לעדכון הזה. יש להגדיר תבנית באשף ההכנות או ליצור תבנית מייל במערכת." },
        { status: 400 }
      )
    }

    // שליחת עדכון לכל לקוח זכאי
    const results = {
      sent: 0,
      emailSent: 0,
      emailSkipped: 0,
      skippedNoFile: 0,
      failed: 0,
      total: eligibleCustomers.length,
    }

    for (const customer of eligibleCustomers) {
      const cpiFiles = cpiMap.get(customer.id)
      if (!cpiFiles?.main) {
        results.skippedNoFile++
        continue
      }

      try {
        // שיתוף קבצי CPI עם הלקוח
        let downloadLink = ""
        let downloadLink2 = ""

        try {
          downloadLink = await shareFile(cpiFiles.main, customer.email, "reader")
        } catch (err) {
          console.error(`Failed to share main CPI for customer ${customer.id}:`, err)
          results.failed++
          continue
        }

        if (cpiFiles.additional) {
          try {
            downloadLink2 = await shareFile(cpiFiles.additional, customer.email, "reader")
          } catch (err) {
            console.error(`Failed to share additional CPI for customer ${customer.id}:`, err)
          }
        }

        // יצירת רשומת CustomerUpdate
        await prisma.customerUpdate.create({
          data: {
            customerId: customer.id,
            updateVersionId: id,
            sentAt: now,
            sentById: session.user.id,
          },
        })

        // עדכון גרסה נוכחית
        await prisma.customer.update({
          where: { id: customer.id },
          data: { currentUpdateVersion: updateVersion.version },
        })

        // שליחת מייל — תבנית לפי אורגן → שדות ישירים → תבנית ברירת מחדל מ-DB
        const organTemplate = tMap?.eligible?.[customer.organId]
        const emailSubject = organTemplate?.subject || updateVersion.emailSubject || fallbackTemplate?.subject
        const emailBody = organTemplate?.body || updateVersion.emailBody || fallbackTemplate?.body

        if (emailSubject && emailBody) {
          try {
            const additionalOrganName = customer.additionalOrgan?.name || ""
            const additionalOrganLine = additionalOrganName && downloadLink2
              ? `<p>בנוסף, העדכון כולל גם קבצים עבור ה-${additionalOrganName} שלך.</p>`
              : ""
            // חישוב יתרה ולינק תשלום
            const fullSetPrice = customer.setType?.price ? Number(customer.setType.price) : 0;
            const paid = Number(customer.amountPaid || 0);
            const remaining = Math.max(0, fullSetPrice - paid);

            // Use redirect URL — creates fresh payment link when customer clicks
            const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.AUTH_URL || "";
            const paymentLink = remaining > 0 ? `${ORDER_FORM_URL}/pay/${customer.id}` : "";

            const templateVars = {
              customerName: customer.fullName,
              fullName: customer.fullName,
              firstName: customer.fullName.split(" ")[0],
              version: updateVersion.version,
              updateVersion: updateVersion.version,
              organName: customer.organ?.name || "",
              organ: customer.organ?.name || "",
              additionalOrganName,
              additionalOrganLine,
              setType: customer.setType?.name || "",
              samplesLink: downloadLink,
              rhythmsLink: rhythmsLinkMap.get(`${customer.organId}_${customer.setTypeId}`) || updateVersion.rhythmsFileUrl || "",
              rhythmsFileName: customer.organ?.installFileName || (updateVersion.rhythmsFileUrl ? extractFilename(updateVersion.rhythmsFileUrl) : ""),
              samplesFileName: updateVersion.samplesFileUrl ? extractFilename(updateVersion.samplesFileUrl) : "",
              releaseDate: new Date(updateVersion.releaseDate || Date.now()).toLocaleDateString("he-IL"),
              downloadLink,
              downloadLink2,
              customLink: "",
              orderFormLink: `${ORDER_FORM_URL}/`,
              termsLink: TERMS_URL,
              updateExpiryDate: customer.updateExpiryDate ? new Date(customer.updateExpiryDate).toLocaleDateString("he-IL") : "",
              currentVersion: customer.currentUpdateVersion || "—",
              amountPaid: String(paid),
              purchaseDate: customer.purchaseDate ? new Date(customer.purchaseDate).toLocaleDateString("he-IL") : "",
              remainingAmount: String(remaining),
              remainingForFullSet: remaining > 0 ? `₪${remaining}` : "₪0",
              paymentLink,
              todayDate: new Date().toLocaleDateString("he-IL"),
            }
            const html = replaceTemplateVariables(emailBody, templateVars)
            const emailResult = await sendEmail({
              to: customer.email,
              subject: replaceTemplateVariables(emailSubject, templateVars),
              html,
            })
            if (emailResult.success) {
              results.emailSent++
            } else {
              console.error(`Email failed for customer ${customer.id}:`, emailResult.error)
            }
          } catch (err) {
            console.error(`Failed to send email to customer ${customer.id}:`, err)
          }
        } else {
          results.emailSkipped++
          console.warn(`No email template for customer ${customer.id} (organ: ${customer.organId}). emailSubject: ${!!emailSubject}, emailBody: ${!!emailBody}`)
        }

        // שליחת WhatsApp
        const phone = customer.whatsappPhone || customer.phone
        if (phone) {
          try {
            let waMsg = `שלום ${customer.fullName}!\nעדכון *${updateVersion.version}* מוכן עבורך`
            if (downloadLink) waMsg += `\n\nלינק להורדה:\n${downloadLink}`
            if (downloadLink2) waMsg += `\n\nלינק נוסף (אורגן נוסף):\n${downloadLink2}`
            await sendWhatsApp({ phone, message: waMsg })
          } catch (err) {
            console.error(`Failed to send WhatsApp to customer ${customer.id}:`, err)
          }
        }

        // רישום פעילות
        await logActivity({
          userId: session.user.id,
          customerId: customer.id,
          action: "SEND_UPDATE",
          entityType: "CUSTOMER_UPDATE",
          entityId: id,
          details: {
            version: updateVersion.version,
            customerId: customer.id,
            downloadLink,
            bulkSend: true,
          },
        })

        results.sent++
      } catch (err) {
        console.error(`Failed to process customer ${customer.id}:`, err)
        results.failed++
      }
    }

    // עדכון סטטוס העדכון
    if (results.sent > 0) {
      const newStatus = results.sent === results.total - results.skippedNoFile
        ? "COMPLETED"
        : updateVersion.status === "DRAFT"
          ? "SENDING"
          : updateVersion.status
      await prisma.updateVersion.update({
        where: { id },
        data: { status: newStatus },
      })
    }

    return NextResponse.json({
      message: `העדכון נשלח בהצלחה ל-${results.sent} לקוחות (${results.emailSent} מיילים נשלחו${results.emailSkipped > 0 ? `, ${results.emailSkipped} ללא תבנית מייל` : ""})`,
      sent: results.sent,
      emailSent: results.emailSent,
      emailSkipped: results.emailSkipped,
      skippedNoFile: results.skippedNoFile,
      failed: results.failed,
      total: results.total,
    })
  } catch (error) {
    console.error("Error in send-all:", error)
    return NextResponse.json(
      { error: "שגיאה בשליחת העדכון לכולם" },
      { status: 500 }
    )
  }
}
