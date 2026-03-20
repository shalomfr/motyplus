import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { emailTemplateSchema } from "@/lib/validators";
import { blocksToHtml } from "@/components/emails/block-editor/blocks-to-html";
import type { EmailBlock } from "@/components/emails/block-editor/types";

// GET /api/emails/templates/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "לא מורשה" }, { status: 401 });
    }

    const { id } = await params;
    const template = await prisma.emailTemplate.findUnique({ where: { id } });

    if (!template) {
      return NextResponse.json({ error: "תבנית לא נמצאה" }, { status: 404 });
    }

    return NextResponse.json(template);
  } catch (error) {
    console.error("Error fetching template:", error);
    return NextResponse.json({ error: "שגיאה בטעינת התבנית" }, { status: 500 });
  }
}

// PATCH /api/emails/templates/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "לא מורשה" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const validation = emailTemplateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "נתונים לא תקינים", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const blocks = body.blocks as EmailBlock[] | undefined;
    const finalBody = blocks && blocks.length > 0 ? blocksToHtml(blocks) : validation.data.body;

    const template = await prisma.emailTemplate.update({
      where: { id },
      data: {
        name: validation.data.name,
        subject: validation.data.subject,
        body: finalBody,
        category: validation.data.category,
        variables: validation.data.variables || [],
        blocks: blocks ? (blocks as unknown as Record<string, unknown>[]) : undefined,
      },
    });

    return NextResponse.json(template);
  } catch (error) {
    console.error("Error updating template:", error);
    return NextResponse.json({ error: "שגיאה בעדכון התבנית" }, { status: 500 });
  }
}

// DELETE /api/emails/templates/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "לא מורשה" }, { status: 401 });
    }

    const { id } = await params;
    await prisma.emailTemplate.delete({ where: { id } });

    return NextResponse.json({ message: "התבנית נמחקה" });
  } catch (error) {
    console.error("Error deleting template:", error);
    return NextResponse.json({ error: "שגיאה במחיקת התבנית" }, { status: 500 });
  }
}
