import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { shareFile, getShareableLink, revokeAccess, revokeAllAccess } from "@/lib/file-storage";

// POST /api/files/share - שיתוף קובץ
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "לא מורשה" }, { status: 401 });
    }

    const { path, email, type = "link" } = await request.json();

    if (!path) {
      return NextResponse.json({ error: "חסר נתיב קובץ" }, { status: 400 });
    }

    let shareUrl: string;

    if (type === "email" && email) {
      // שיתוף לפי מייל ספציפי
      shareUrl = await shareFile(path, email, "reader");
    } else {
      // לינק פתוח לכל מי שיש לו
      shareUrl = await getShareableLink(path);
    }

    return NextResponse.json({ shareUrl });
  } catch (error) {
    console.error("Error sharing file:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "שגיאה בשיתוף הקובץ" },
      { status: 500 }
    );
  }
}

// DELETE /api/files/share - ביטול הרשאה
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "לא מורשה" }, { status: 401 });
    }

    const { path, email } = await request.json();

    if (!path) {
      return NextResponse.json({ error: "חסר נתיב קובץ" }, { status: 400 });
    }

    if (email) {
      await revokeAccess(path, email);
    } else {
      await revokeAllAccess(path);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error revoking access:", error);
    return NextResponse.json(
      { error: "שגיאה בביטול ההרשאה" },
      { status: 500 }
    );
  }
}
