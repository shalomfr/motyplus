import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { logActivity } from "@/lib/activity-logger"
import { sendEmail, replaceTemplateVariables } from "@/lib/email"
import { sendWhatsApp } from "@/lib/whatsapp"
import { listFiles, shareFile, getShareableLink } from "@/lib/file-storage"
import { parseCpiFilename } from "@/lib/cpi-filename"
import { getBillingClient } from "@/lib/billing"
import { ORDER_FORM_URL, TERMS_URL } from "@/lib/utils"

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

    if (updateVersion.status === "DRAFT") {
      return NextResponse.json(
        { error: "לא ניתן לשלוח עדכון בסטטוס טיוטה" },
        { status: 400 }
      )
    }
    if (updateVersion.status === "COMPLETED") {
      return NextResponse.json(
        { error: "העדכון כבר הושלם — לא ניתן לשלוח שוב" },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { customerIds, force, email } = body as {
      customerIds?: number[]
      force?: boolean
      email?: string
    }

    // מצב 1: שליחה למייל ידני (ללא לקוח במערכת)
    if (email) {
      const folder = "updates/samples"
      const sampleFiles = await listFiles(folder)

      // שליחת מייל עם תבנית העדכון
      if (updateVersion.emailSubject && updateVersion.emailBody) {
        const templateVars = {
          customerName: email,
          fullName: email,
          firstName: email,
          version: updateVersion.version,
          updateVersion: updateVersion.version,
          organName: "",
          organ: "",
          additionalOrganName: "",
          additionalOrganLine: "",
          setType: "",
          samplesLink: "",
          downloadLink: "",
          downloadLink2: "",
          rhythmsLink: updateVersion.rhythmsFileUrl || "",
          releaseDate: new Date(updateVersion.releaseDate || Date.now()).toLocaleDateString("he-IL"),
          customLink: "",
          orderFormLink: `${ORDER_FORM_URL}/`,
          termsLink: TERMS_URL,
          todayDate: new Date().toLocaleDateString("he-IL"),
        }
        const html = replaceTemplateVariables(updateVersion.emailBody, templateVars)
        await sendEmail({
          to: email,
          subject: replaceTemplateVariables(updateVersion.emailSubject, templateVars),
          html,
        })
      }

      await logActivity({
        userId: session.user.id,
        action: "SEND_UPDATE",
        entityType: "CUSTOMER_UPDATE",
        entityId: id,
        details: { version: updateVersion.version, manualEmail: email },
      })

      return NextResponse.json({
        message: `העדכון נשלח בהצלחה ל-${email}`,
        sent: 1,
        skippedNoFile: 0,
        failed: 0,
        alreadyReceived: 0,
      })
    }

    // מצב 2: שליחה ללקוחות לפי מזהים
    if (!customerIds || !Array.isArray(customerIds) || customerIds.length === 0) {
      return NextResponse.json(
        { error: "יש לספק רשימת מזהי לקוחות או מייל" },
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
        organId: true,
        setTypeId: true,
        organ: { select: { name: true, supportsUpdates: true } },
        additionalOrgan: { select: { name: true } },
        setType: { select: { includesUpdates: true, name: true, price: true } },
        amountPaid: true,
        purchaseDate: true,
        currentUpdateVersion: true,
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

    const now = new Date()
    let eligible: typeof customers

    if (force) {
      // force — דילוג על בדיקת זכאות, רק סינון מי שכבר קיבל
      eligible = customers.filter((c) => !alreadyReceivedIds.has(c.id))
    } else {
      // סינון לקוחות זכאים
      eligible = customers.filter((c) => {
        if (alreadyReceivedIds.has(c.id)) return false
        if (c.status === "EXCEPTION") return true
        if (c.updateExpiryDate && c.updateExpiryDate >= now) return true
        return false
      })
    }

    // סינון אורגנים שלא תומכים בעדכונים
    eligible = eligible.filter(c => c.organ?.supportsUpdates)

    if (eligible.length === 0) {
      return NextResponse.json(
        { error: force ? "הלקוח כבר קיבל את העדכון הזה" : "אין לקוחות זכאים לשליחה — האורגן לא תומך בעדכונים" },
        { status: 400 }
      )
    }

    // טעינת קבצי CPI מתיקיית updates/samples (שטוח)
    const folder = "updates/samples"
    const sampleFiles = await listFiles(folder)

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
    const uniqueCombos = new Set(eligible.map(c => `${c.organId}_${c.setTypeId}`))

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

        // יצירת/עדכון רשומת CustomerUpdate
        await prisma.customerUpdate.upsert({
          where: {
            customerId_updateVersionId: {
              customerId: customer.id,
              updateVersionId: id,
            },
          },
          create: {
            customerId: customer.id,
            updateVersionId: id,
            sentAt: now,
            sentById: session.user.id,
          },
          update: {
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
            // חישוב יתרה ולינק תשלום
            const fullSetPrice = customer.setType?.price ? Number(customer.setType.price) : 0;
            const paid = Number(customer.amountPaid || 0);
            const remaining = Math.max(0, fullSetPrice - paid);

            // Use redirect URL — creates fresh payment link when customer clicks
            const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.AUTH_URL || "";
            const paymentLink = remaining > 0 ? `${baseUrl}/pay/${customer.id}` : "";

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
              downloadLink,
              downloadLink2,
              rhythmsLink: rhythmsLinkMap.get(`${customer.organId}_${customer.setTypeId}`) || updateVersion.rhythmsFileUrl || "",
              releaseDate: new Date(updateVersion.releaseDate || Date.now()).toLocaleDateString("he-IL"),
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
    if (results.sent > 0 && updateVersion.status === "READY") {
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
