import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getICountClient } from "@/lib/icount";

// GET /api/accounting/invoices/download?docId=xxx — הורדת PDF של מסמך מ-iCount
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "לא מורשה" }, { status: 401 });
    }

    const docId = request.nextUrl.searchParams.get("docId");
    if (!docId) {
      return NextResponse.json({ error: "חסר מזהה מסמך" }, { status: 400 });
    }

    const icount = await getICountClient();
    if (!icount) {
      return NextResponse.json({ error: "לא הוגדר חיבור ל-iCount" }, { status: 400 });
    }

    // Get document details from iCount (including pdf_url)
    const doc = await icount.client.getDocument(docId);

    // Try pdf_url first, fallback to doc_url
    const downloadUrl = doc.pdf_url || doc.doc_url;
    if (!downloadUrl) {
      return NextResponse.json({ error: "לא נמצא קישור למסמך" }, { status: 404 });
    }

    // Fetch the document content from iCount and proxy it
    const response = await fetch(downloadUrl);
    if (!response.ok) {
      return NextResponse.json({ error: "שגיאה בהורדת המסמך מ-iCount" }, { status: 502 });
    }

    const contentType = response.headers.get("content-type") || "application/pdf";
    const buffer = await response.arrayBuffer();
    const filename = `document-${doc.docnum || docId}.pdf`;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Error downloading invoice:", error);
    return NextResponse.json({ error: "שגיאה בהורדת מסמך" }, { status: 500 });
  }
}
