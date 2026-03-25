import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { blocksToHtml } from "@/components/emails/block-editor/blocks-to-html";
import type { EmailBlock } from "@/components/emails/block-editor/types";

interface TemplateImportData {
  name: string;
  subject: string;
  body: string;
  blocks?: unknown;
  variables?: string[];
  category?: string | null;
  folderId?: string | null;
  isActive?: boolean;
  order?: number;
}

function validateTemplate(t: unknown): t is TemplateImportData {
  if (!t || typeof t !== "object") return false;
  const obj = t as Record<string, unknown>;
  return (
    typeof obj.name === "string" &&
    obj.name.length > 0 &&
    typeof obj.subject === "string" &&
    typeof obj.body === "string"
  );
}

// POST /api/emails/templates/import — import one or more templates from JSON
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

    // Support multiple formats:
    // 1. { template: {...} }        — single export format
    // 2. { templates: [{...}] }     — all-export format
    // 3. [{...}]                    — raw array
    // 4. {...}                      — raw single template object
    let templatesToImport: TemplateImportData[] = [];

    if (body.template && typeof body.template === "object") {
      templatesToImport = [body.template];
    } else if (Array.isArray(body.templates)) {
      templatesToImport = body.templates;
    } else if (Array.isArray(body)) {
      templatesToImport = body;
    } else if (body.name && body.subject) {
      templatesToImport = [body];
    }

    if (templatesToImport.length === 0) {
      return NextResponse.json(
        { error: "לא נמצאו תבניות בקובץ" },
        { status: 400 }
      );
    }

    // Validate all templates before creating
    for (let i = 0; i < templatesToImport.length; i++) {
      if (!validateTemplate(templatesToImport[i])) {
        return NextResponse.json(
          { error: `תבנית מספר ${i + 1} לא תקינה — חייבת לכלול name, subject, body` },
          { status: 400 }
        );
      }
    }

    // Check which folderIds actually exist
    const uniqueFolderIds = [
      ...new Set(
        templatesToImport
          .map((t) => t.folderId)
          .filter((id): id is string => typeof id === "string" && id.length > 0)
      ),
    ];
    const existingFolders = uniqueFolderIds.length > 0
      ? await prisma.emailFolder.findMany({
          where: { id: { in: uniqueFolderIds } },
          select: { id: true },
        })
      : [];
    const existingFolderIds = new Set(existingFolders.map((f) => f.id));

    const created = [];

    for (const t of templatesToImport) {
      const blocks = t.blocks as EmailBlock[] | undefined;
      const finalBody =
        blocks && Array.isArray(blocks) && blocks.length > 0
          ? blocksToHtml(blocks)
          : t.body;

      const folderId =
        t.folderId && existingFolderIds.has(t.folderId) ? t.folderId : undefined;

      const template = await prisma.emailTemplate.create({
        data: {
          name: t.name,
          subject: t.subject,
          body: finalBody,
          blocks: blocks ? JSON.parse(JSON.stringify(blocks)) : undefined,
          variables: t.variables || [],
          category: t.category || undefined,
          folderId,
          isActive: t.isActive !== undefined ? t.isActive : true,
          order: t.order || 0,
        },
      });
      created.push(template);
    }

    return NextResponse.json(
      {
        message: `${created.length} תבניות יובאו בהצלחה`,
        count: created.length,
        templates: created,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error importing email templates:", error);
    return NextResponse.json(
      { error: "שגיאה בייבוא תבניות" },
      { status: 500 }
    );
  }
}
