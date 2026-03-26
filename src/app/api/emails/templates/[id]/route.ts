import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { emailTemplateSchema } from "@/lib/validators";
import { blocksToHtml } from "@/components/emails/block-editor/blocks-to-html";
import type { EmailBlock } from "@/components/emails/block-editor/types";
import { uploadFile, getShareableLink } from "@/lib/file-storage";

async function uploadBlockImages(blocks: EmailBlock[]): Promise<EmailBlock[]> {
  const processed: EmailBlock[] = []
  for (const block of blocks) {
    if (block.type === "image" && block.url && block.url.startsWith("data:")) {
      try {
        const match = block.url.match(/^data:(image\/\w+);base64,(.+)$/)
        if (match) {
          const ext = match[1].split("/")[1].replace("jpeg", "jpg")
          const buffer = Buffer.from(match[2], "base64")
          const filename = `email-img-${Date.now()}.${ext}`
          await uploadFile(buffer, filename, "email-assets")
          const publicUrl = await getShareableLink(`email-assets/${filename}`)
          processed.push({ ...block, url: publicUrl })
          continue
        }
      } catch (err) {
        console.error("Failed to upload image to Drive:", err)
      }
    }
    processed.push(block)
  }
  return processed
}

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

    // Partial update: only folderId (move between folders)
    if (Object.keys(body).length === 1 && body.folderId !== undefined) {
      const template = await prisma.emailTemplate.update({
        where: { id },
        data: { folderId: body.folderId || null },
      });
      return NextResponse.json(template);
    }

    const validation = emailTemplateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "נתונים לא תקינים", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const rawBlocks = body.blocks as EmailBlock[] | undefined;
    const blocks = rawBlocks && rawBlocks.length > 0 ? await uploadBlockImages(rawBlocks) : rawBlocks;
    const finalBody = blocks && blocks.length > 0 ? blocksToHtml(blocks) : validation.data.body;

    const template = await prisma.emailTemplate.update({
      where: { id },
      data: {
        name: validation.data.name,
        subject: validation.data.subject,
        body: finalBody,
        category: validation.data.category,
        folderId: body.folderId !== undefined ? (body.folderId || null) : undefined,
        variables: validation.data.variables || [],
        blocks: blocks ? JSON.parse(JSON.stringify(blocks)) : undefined,
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
    // Detach email logs before deleting template
    await prisma.emailLog.updateMany({
      where: { templateId: id },
      data: { templateId: null },
    });
    await prisma.emailTemplate.delete({ where: { id } });

    return NextResponse.json({ message: "התבנית נמחקה" });
  } catch (error) {
    console.error("Error deleting template:", error);
    return NextResponse.json({ error: "שגיאה במחיקת התבנית" }, { status: 500 });
  }
}
