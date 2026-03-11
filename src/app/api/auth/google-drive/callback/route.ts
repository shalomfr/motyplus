import { NextRequest, NextResponse } from "next/server";
import { getTokenFromCode } from "@/lib/google-drive";

// GET /api/auth/google-drive/callback - exchange code for refresh token
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  if (!code) {
    return new NextResponse(
      "<h1>שגיאה: לא התקבל קוד מ-Google</h1>",
      { headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  try {
    const tokens = await getTokenFromCode(code);

    return new NextResponse(
      `<!DOCTYPE html>
<html dir="rtl">
<head><meta charset="utf-8"><title>Google Drive Connected</title></head>
<body style="font-family: sans-serif; max-width: 600px; margin: 40px auto; padding: 20px;">
  <h1 style="color: green;">✅ Google Drive מחובר בהצלחה!</h1>
  <p>העתק את ה-Refresh Token הבא והוסף אותו כ-<code>GOOGLE_DRIVE_REFRESH_TOKEN</code> ב-Render:</p>
  <textarea style="width: 100%; height: 100px; direction: ltr; font-family: monospace; font-size: 12px;" readonly onclick="this.select()">${tokens.refresh_token}</textarea>
  <br><br>
  <p><strong>Access Token</strong> (לבדיקה, לא צריך לשמור):</p>
  <textarea style="width: 100%; height: 60px; direction: ltr; font-family: monospace; font-size: 10px;" readonly>${tokens.access_token}</textarea>
  <br><br>
  <p style="color: gray;">אחרי שהוספת את ה-token ב-Render, עשה redeploy והכל יעבוד.</p>
</body>
</html>`,
      { headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  } catch (error) {
    console.error("Google Drive auth error:", error);
    return new NextResponse(
      `<h1>שגיאה בחיבור Google Drive</h1><pre>${error instanceof Error ? error.message : "Unknown error"}</pre>`,
      { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 500 }
    );
  }
}
