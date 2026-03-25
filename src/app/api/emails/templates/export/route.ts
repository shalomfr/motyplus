import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/emails/templates/export?id=xxx — export single or all templates
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: "לא מורשה. יש להתחבר למערכת" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (id) {
      // Export single template
      const template = await prisma.emailTemplate.findUnique({
        where: { id },
      });

      if (!template) {
        return NextResponse.json(
          { error: "תבנית לא נמצאה" },
          { status: 404 }
        );
      }

      const exportData = {
        _exportVersion: 1,
        _exportDate: new Date().toISOString(),
        _source: "motty-beats-crm",
        template: {
          name: template.name,
          subject: template.subject,
          body: template.body,
          blocks: template.blocks,
          variables: template.variables,
          category: template.category,
          folderId: template.folderId,
          isActive: template.isActive,
          order: template.order,
        },
      };

      return NextResponse.json(exportData);
    } else {
      // Export all templates
      const templates = await prisma.emailTemplate.findMany({
        orderBy: { createdAt: "desc" },
      });

      const exportData = {
        _exportVersion: 1,
        _exportDate: new Date().toISOString(),
        _source: "motty-beats-crm",
        templates: templates.map((t) => ({
          name: t.name,
          subject: t.subject,
          body: t.body,
          blocks: t.blocks,
          variables: t.variables,
          category: t.category,
          folderId: t.folderId,
          isActive: t.isActive,
          order: t.order,
        })),
      };

      return NextResponse.json(exportData);
    }
  } catch (error) {
    console.error("Error exporting email templates:", error);
    return NextResponse.json(
      { error: "שגיאה בייצוא תבניות" },
      { status: 500 }
    );
  }
}
