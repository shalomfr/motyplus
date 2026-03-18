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
    let downloadUrl = "";
    let docnum = docId;

    try {
      const doc = await icount.client.getDocument(docId);
      downloadUrl = doc.pdf_url || doc.doc_url;
      docnum = doc.docnum || docId;
    } catch (err) {
      console.error("Error fetching doc from iCount:", err);
      // If doc/get fails, try constructing URL from iCount pattern
    }

    if (!downloadUrl) {
      return NextResponse.json(
        { error: "לא נמצא קישור להורדה. נסה ללחוץ על כפתור הצפייה במקום" },
        { status: 404 }
      );
    }

    // Fetch the document content from iCount and proxy it
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(downloadUrl, { signal: controller.signal });

      if (!response.ok) {
        // If fetch fails, redirect to the URL directly
        return NextResponse.redirect(downloadUrl);
      }

      const contentType = response.headers.get("content-type") || "application/pdf";
      const buffer = await response.arrayBuffer();

      // Determine filename based on content type
      const ext = contentType.includes("pdf") ? "pdf" : "html";
      const filename = `document-${docnum}.${ext}`;

      return new NextResponse(buffer, {
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "private, max-age=3600",
        },
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    console.error("Error downloading invoice:", error);
    return NextResponse.json({ error: "שגיאה בהורדת מסמך" }, { status: 500 });
  }
}
