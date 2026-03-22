import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";

const ORDER_FORM_URL = "https://motyplus-order.onrender.com";

export async function POST(request: NextRequest) {
  try {
    const { name, email } = await request.json();

    if (!name || !email || !email.includes("@")) {
      return NextResponse.json({ error: "שם ומייל הם שדות חובה" }, { status: 400 });
    }

    const html = `
      <div dir="rtl" style="font-family: Arial, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; padding: 30px 20px; background: linear-gradient(135deg, #0A3D6E 0%, #1A6AB5 100%); border-radius: 16px 16px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">Motty Beats</h1>
          <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0; font-size: 14px;">סטים, ריתמוסים ועדכוני תוכנה לקלידים</p>
        </div>

        <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
          <h2 style="color: #1a1a1a; margin: 0 0 16px; font-size: 20px;">שלום ${name},</h2>

          <p style="color: #4a4a4a; line-height: 1.8; font-size: 15px;">
            הוזמנת להזמין סטים, ריתמוסים ועדכוני תוכנה לאורגן שלך.
          </p>

          <p style="color: #4a4a4a; line-height: 1.8; font-size: 15px;">
            לחץ על הכפתור למעבר לטופס ההזמנה:
          </p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${ORDER_FORM_URL}"
               style="display: inline-block; background: linear-gradient(135deg, #2563eb, #1d4ed8); color: white; text-decoration: none; padding: 14px 40px; border-radius: 10px; font-size: 16px; font-weight: bold;">
              לטופס ההזמנה
            </a>
          </div>

          <p style="color: #9a9a9a; font-size: 13px; text-align: center;">
            התשלום מתבצע באופן מאובטח
          </p>
        </div>

        <div style="text-align: center; padding: 16px; color: #9a9a9a; font-size: 12px;">
          Motty Beats &copy; ${new Date().getFullYear()}
        </div>
      </div>
    `;

    const result = await sendEmail({
      to: email,
      subject: "הזמנה ל-Motty Beats — סטים וריתמוסים לאורגן",
      html,
    });

    if (!result.success) {
      return NextResponse.json({ error: "שגיאה בשליחת המייל" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Invite customer error:", error);
    return NextResponse.json({ error: "שגיאה בשליחת ההזמנה" }, { status: 500 });
  }
}
