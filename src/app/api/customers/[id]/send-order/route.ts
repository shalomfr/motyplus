import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { sendEmail, replaceTemplateVariables } from "@/lib/email"
import { logActivity } from "@/lib/activity-logger"

// POST /api/customers/[id]/send-order — שליחת הזמנה סופית ללקוח (אחרי תשלום)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "לא מורשה" }, { status: 401 })
    }

    const { id } = await params
    const customerId = parseInt(id, 10)
    if (isNaN(customerId)) {
      return NextResponse.json({ error: "מזהה לקוח לא תקין" }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const { templateId } = body as { templateId?: string }

    if (!templateId) {
      return NextResponse.json({ error: "יש לבחור תבנית" }, { status: 400 })
    }

    const [customer, template] = await Promise.all([
      prisma.customer.findUnique({
        where: { id: customerId },
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          customerId: true,
          currentUpdateVersion: true,
          purchaseDate: true,
          updateExpiryDate: true,
          organ: { select: { name: true } },
          setType: { select: { name: true } },
        },
      }),
      prisma.emailTemplate.findUnique({
        where: { id: templateId },
        select: { id: true, name: true, subject: true, body: true },
      }),
    ])

    if (!customer) {
      return NextResponse.json({ error: "לקוח לא נמצא" }, { status: 404 })
    }
    if (!template) {
      return NextResponse.json({ error: "תבנית לא נמצאה" }, { status: 404 })
    }

    const vars: Record<string, string> = {
      fullName: customer.fullName,
      firstName: customer.fullName.split(" ")[0],
      email: customer.email,
      phone: customer.phone,
      organ: customer.organ.name,
      setType: customer.setType.name,
      customerId: customer.customerId || String(customer.id),
      currentVersion: customer.currentUpdateVersion || "—",
      purchaseDate: customer.purchaseDate.toLocaleDateString("he-IL"),
      updateExpiryDate: customer.updateExpiryDate.toLocaleDateString("he-IL"),
    }

    const html = replaceTemplateVariables(template.body, vars)
    const subject = replaceTemplateVariables(template.subject, vars)

    const result = await sendEmail({ to: customer.email, subject, html })

    if (!result.success) {
      return NextResponse.json({ error: "שגיאה בשליחת המייל" }, { status: 500 })
    }

    // Mark order as sent
    await prisma.customer.update({
      where: { id: customerId },
      data: { orderSentAt: new Date() },
    })

    // Log the email
    await prisma.emailLog.create({
      data: {
        customerId,
        templateId: template.id,
        toEmail: customer.email,
        subject,
        body: html,
        status: "SENT",
        sentAt: new Date(),
        userId: session.user.id,
      },
    })

    await logActivity({
      userId: session.user.id,
      customerId,
      action: "SEND_ORDER",
      entityType: "CUSTOMER",
      entityId: String(customerId),
      details: { templateName: template.name },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error sending order:", error)
    return NextResponse.json({ error: "שגיאה בשליחת ההזמנה" }, { status: 500 })
  }
}
