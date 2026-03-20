import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { emailTemplateSchema } from "@/lib/validators";
import { DEFAULT_EMAIL_TEMPLATES } from "./seed/route";
import { blocksToHtml } from "@/components/emails/block-editor/blocks-to-html";
import type { EmailBlock } from "@/components/emails/block-editor/types";

// GET /api/emails/templates - רשימת תבניות מייל (auto-seed אם ריק)
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: "לא מורשה. יש להתחבר למערכת" },
        { status: 401 }
      );
    }

    for (const t of DEFAULT_EMAIL_TEMPLATES) {
      const existing = await prisma.emailTemplate.findFirst({
        where: { name: t.name },
      });
      const body = blocksToHtml(t.blocks);
      if (existing) {
        const needsUpdate = !existing.blocks
          || existing.body.includes("{{תאריך}}")
          || existing.body.includes("תוכן העדכון ישתנה")
          || existing.body.includes("{{downloadLink}}");
        if (needsUpdate) {
          await prisma.emailTemplate.update({
            where: { id: existing.id },
            data: {
              body, subject: t.subject, variables: t.variables,
              blocks: JSON.parse(JSON.stringify(t.blocks)),
            },
          });
        }
      } else {
        await prisma.emailTemplate.create({
          data: {
            name: t.name, subject: t.subject, body,
            category: t.category, variables: t.variables,
            blocks: JSON.parse(JSON.stringify(t.blocks)),
          },
        });
      }
    }

    const templates = await prisma.emailTemplate.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { emailLogs: true },
        },
      },
    });

    return NextResponse.json(templates);
  } catch (error) {
    console.error("Error fetching email templates:", error);
    return NextResponse.json(
      { error: "שגיאה בטעינת תבניות המייל" },
      { status: 500 }
    );
  }
}

// POST /api/emails/templates - יצירת תבנית מייל חדשה
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: "לא מורשה. יש להתחבר למערכת" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validation = emailTemplateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "נתונים לא תקינים", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const data = validation.data;

    const blocks = body.blocks as EmailBlock[] | undefined;
    const finalBody = blocks && blocks.length > 0 ? blocksToHtml(blocks) : data.body;

    const template = await prisma.emailTemplate.create({
      data: {
        name: data.name,
        subject: data.subject,
        body: finalBody,
        category: data.category,
        variables: data.variables || [],
        blocks: blocks ? JSON.parse(JSON.stringify(blocks)) : undefined,
      },
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error("Error creating email template:", error);
    return NextResponse.json(
      { error: "שגיאה ביצירת תבנית המייל" },
      { status: 500 }
    );
  }
}
