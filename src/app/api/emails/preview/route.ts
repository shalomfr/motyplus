import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { replaceTemplateVariables } from "@/lib/email";

interface PreviewBody {
  templateId?: string;
  subject?: string;
  body?: string;
  customerId?: number;
  leadId?: string;
}

// POST /api/emails/preview - תצוגה מקדימה של מייל עם החלפת משתנים
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: "לא מורשה. יש להתחבר למערכת" },
        { status: 401 }
      );
    }

    const body: PreviewBody = await request.json();
    const { templateId, subject, body: emailBody, customerId, leadId } = body;

    let finalSubject = subject || "";
    let finalBody = emailBody || "";

    // טעינת תבנית אם צוינה
    if (templateId) {
      const template = await prisma.emailTemplate.findUnique({
        where: { id: templateId },
      });

      if (!template) {
        return NextResponse.json(
          { error: "תבנית המייל לא נמצאה" },
          { status: 404 }
        );
      }

      finalSubject = template.subject;
      finalBody = template.body;
    } else if (!subject || !emailBody) {
      return NextResponse.json(
        { error: "יש לספק תבנית מייל או נושא ותוכן" },
        { status: 400 }
      );
    }

    // בניית משתנים לפי סוג הנמען
    let variables: Record<string, string> = {};

    if (customerId) {
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        include: { organ: true, setType: true },
      });

      if (!customer) {
        return NextResponse.json(
          { error: "הלקוח לא נמצא" },
          { status: 404 }
        );
      }

      variables = {
        fullName: customer.fullName,
        firstName: customer.fullName.split(" ")[0],
        email: customer.email,
        phone: customer.phone,
        organ: customer.organ.name,
        setType: customer.setType.name,
        purchaseDate: customer.purchaseDate.toLocaleDateString("he-IL"),
        updateExpiryDate: customer.updateExpiryDate.toLocaleDateString("he-IL"),
      };
    } else if (leadId) {
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
      });

      if (!lead) {
        return NextResponse.json(
          { error: "הליד לא נמצא" },
          { status: 404 }
        );
      }

      variables = {
        fullName: lead.fullName,
        firstName: lead.fullName.split(" ")[0],
        email: lead.email || "",
        phone: lead.phone,
      };
    } else {
      // משתנים לדוגמה
      variables = {
        fullName: "ישראל ישראלי",
        firstName: "ישראל",
        email: "example@email.com",
        phone: "050-1234567",
        organ: "אורגן לדוגמה",
        setType: "סט לדוגמה",
        purchaseDate: new Date().toLocaleDateString("he-IL"),
        updateExpiryDate: new Date(
          Date.now() + 365 * 24 * 60 * 60 * 1000
        ).toLocaleDateString("he-IL"),
      };
    }

    const previewSubject = replaceTemplateVariables(finalSubject, variables);
    const previewBody = replaceTemplateVariables(finalBody, variables);

    return NextResponse.json({
      subject: previewSubject,
      body: previewBody,
      variables,
    });
  } catch (error) {
    console.error("Error previewing email:", error);
    return NextResponse.json(
      { error: "שגיאה בתצוגה המקדימה" },
      { status: 500 }
    );
  }
}
