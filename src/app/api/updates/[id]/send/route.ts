import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { logActivity } from "@/lib/activity-logger"
import { sendEmail, replaceTemplateVariables } from "@/lib/email"
import { sendWhatsApp } from "@/lib/whatsapp"
import { listFiles, shareFile } from "@/lib/file-storage"

// POST /api/updates/[id]/send — שיתוף קבצי CPI ושליחת מייל + WhatsApp ללקוחות זכאים
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

    const body = await request.json()
    const { customerIds } = body as { customerIds: number[] }

    if (!customerIds || !Array.isArray(customerIds) || customerIds.length === 0) {
      return NextResponse.json(
        { error: "יש לספק רשימת מזהי לקוחות" },
        { status: 400 }
      )
    }

    // שליפת לקוחות עם setType לבדיקת זכאות
    const customers = await prisma.customer.findMany({
      where: { id: { in: customerIds } },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        whatsappPhone: true,
        customerId: true,
        status: true,
        updateExpiryDate: true,
        organ: { select: { name: true } },
        additionalOrgan: { select: { name: true } },
        setType: { select: { includesUpdates: true, name: true } },
      },
    })

    if (customers.length !== customerIds.length) {
      return NextResponse.json(
        { error: "חלק מהלקוחות לא נמצאו" },
        { status: 400 }
      )
    }

    // בדיקה אילו לקוחות כבר קיבלו את העדכון
    const alreadyReceived = await prisma.customerUpdate.findMany({
      where: {
        updateVersionId: id,
        customerId: { in: customerIds },
      },
      select: { customerId: true },
    })
    const alreadyReceivedIds = new Set(alreadyReceived.map((cu) => cu.customerId))

    // סינון לקוחות זכאים
    const now = new Date()
    const eligible = customers.filter((c) => {
      if (alreadyReceivedIds.has(c.id)) return false
      if (!c.setType?.includesUpdates) return false // חצי סט — לא זכאי
      if (c.status === "EXCEPTION") return true
      if (c.updateExpiryDate && c.updateExpiryDate >= now) return true
      return false
    })

    if (eligible.length === 0) {
      return NextResponse.json(
        { error: "אין לקוחות זכאים לשליחה" },
        { status: 400 }
      )
    }

    // טעינת קבצי CPI מתיקיית samples/{version}
    const folder = `samples/${updateVersion.version}`
    const sampleFiles = await listFiles(folder)

    // בניית מפה: customerId → { main?: path, additional?: path }
    const cpiMap = new Map<number, { main?: string; additional?: string }>()
    for (const f of sampleFiles) {
      const name = f.path.split("/").pop() || ""
      const baseName = name.replace(/\.cpi$/i, "")
      const isAdditional = baseName.includes("_")
      const custId = parseInt(isAdditional ? baseName.split("_")[0] : baseName)
      if (isNaN(custId)) continue

      if (!cpiMap.has(custId)) cpiMap.set(custId, {})
      const entry = cpiMap.get(custId)!
      if (isAdditional) {
        entry.additional = f.path
      } else {
        entry.main = f.path
      }
    }

    // שליחת עדכון לכל לקוח זכאי
    const results = {
      sent: 0,
      skippedNoFile: 0,
      failed: 0,
    }

    for (const customer of eligible) {
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

        // שליחת מייל
        if (updateVersion.emailSubject && updateVersion.emailBody) {
          try {
            const additionalOrganName = customer.additionalOrgan?.name || ""
            const additionalOrganLine = additionalOrganName && downloadLink2
              ? `<p>בנוסף, העדכון כולל גם קבצים עבור ה-${additionalOrganName} שלך.</p>`
              : ""
            const templateVars = {
              customerName: customer.fullName,
              version: updateVersion.version,
              updateVersion: updateVersion.version,
              organName: customer.organ?.name || "",
              additionalOrganName,
              additionalOrganLine,
              setType: customer.setType?.name || "",
              downloadLink,
              downloadLink2,
              rhythmsLink: updateVersion.rhythmsFileUrl || "",
            }
            const html = replaceTemplateVariables(updateVersion.emailBody, templateVars)
            await sendEmail({
              to: customer.email,
              subject: replaceTemplateVariables(updateVersion.emailSubject, templateVars),
              html,
            })
          } catch (err) {
            console.error(`Failed to send email to customer ${customer.id}:`, err)
          }
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
          },
        })

        results.sent++
      } catch (err) {
        console.error(`Failed to process customer ${customer.id}:`, err)
        results.failed++
      }
    }

    // עדכון סטטוס העדכון
    if (results.sent > 0 && updateVersion.status === "DRAFT") {
      await prisma.updateVersion.update({
        where: { id },
        data: { status: "SENDING" },
      })
    }

    return NextResponse.json({
      message: `העדכון נשלח בהצלחה ל-${results.sent} לקוחות`,
      sent: results.sent,
      skippedNoFile: results.skippedNoFile,
      failed: results.failed,
      alreadyReceived: alreadyReceivedIds.size,
    })
  } catch (error) {
    console.error("Error sending update:", error)
    return NextResponse.json(
      { error: "שגיאה בשליחת העדכון" },
      { status: 500 }
    )
  }
}
