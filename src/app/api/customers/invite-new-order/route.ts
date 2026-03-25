import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { sendEmail, replaceTemplateVariables } from "@/lib/email"
import { logActivity } from "@/lib/activity-logger"

const ORDER_FORM_URL = process.env.ORDER_FORM_URL || "https://motyplus-order.onrender.com"

// POST /api/customers/invite-new-order — שליחת הזמנה ללקוח חדש (לפני רכישה)
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "לא מורשה" }, { status: 401 })
    }

    const body = await request.json()
    const { name, email, templateId } = body as {
      name: string
      email: string
      templateId: string
    }

    if (!name?.trim() || !email?.includes("@")) {
      return NextResponse.json({ error: "שם ומייל תקין הם שדות חובה" }, { status: 400 })
    }

    if (!templateId) {
      return NextResponse.json({ error: "יש לבחור תבנית" }, { status: 400 })
    }

    const template = await prisma.emailTemplate.findUnique({
      where: { id: templateId },
      select: { id: true, name: true, subject: true, body: true },
    })

    if (!template) {
      return NextResponse.json({ error: "תבנית לא נמצאה" }, { status: 404 })
    }

    const vars: Record<string, string> = {
      fullName: name.trim(),
      firstName: name.trim().split(" ")[0],
      email,
      orderFormUrl: ORDER_FORM_URL,
      paymentLink: ORDER_FORM_URL,
      newCustomerName: name.trim(),
      todayDate: new Date().toLocaleDateString("he-IL"),
    }

    const html = replaceTemplateVariables(template.body, vars)
    const subject = replaceTemplateVariables(template.subject, vars)

    const result = await sendEmail({ to: email, subject, html })

    if (!result.success) {
      return NextResponse.json({ error: "שגיאה בשליחת המייל" }, { status: 500 })
    }

    // Log the email
    await prisma.emailLog.create({
      data: {
        toEmail: email,
        templateId: template.id,
        subject,
        body: html,
        status: "SENT",
        sentAt: new Date(),
        userId: session.user.id,
      },
    })

    await logActivity({
      userId: session.user.id,
      action: "INVITE_NEW_CUSTOMER",
      entityType: "EMAIL",
      entityId: template.id,
      details: { name, email, templateName: template.name },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error inviting new customer:", error)
    return NextResponse.json({ error: "שגיאה בשליחת ההזמנה" }, { status: 500 })
  }
}
