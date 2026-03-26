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

// GET /api/emails/templates - רשימת תבניות מייל
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: "לא מורשה. יש להתחבר למערכת" },
        { status: 401 }
      );
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

    const rawBlocks = body.blocks as EmailBlock[] | undefined;
    const blocks = rawBlocks && rawBlocks.length > 0 ? await uploadBlockImages(rawBlocks) : rawBlocks;
    const finalBody = blocks && blocks.length > 0 ? blocksToHtml(blocks) : data.body;

    const template = await prisma.emailTemplate.create({
      data: {
        name: data.name,
        subject: data.subject,
        body: finalBody,
        category: data.category,
        folderId: body.folderId || undefined,
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
