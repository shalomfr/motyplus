import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { logActivity } from "@/lib/activity-logger";
import { sendEmail, replaceTemplateVariables } from "@/lib/email";
import { generateCPIsForCustomers } from "@/lib/cpi-converter";

// POST /api/updates/[id]/send - סימון לקוחות כמקבלי עדכון ושליחת מייל
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: "לא מורשה. יש להתחבר למערכת" },
        { status: 401 }
      );
    }

    const { id } = await params;

    // בדיקה שהעדכון קיים
    const updateVersion = await prisma.updateVersion.findUnique({
      where: { id },
    });

    if (!updateVersion) {
      return NextResponse.json(
        { error: "העדכון לא נמצא" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { customerIds } = body as { customerIds: number[] };

    if (!customerIds || !Array.isArray(customerIds) || customerIds.length === 0) {
      return NextResponse.json(
        { error: "יש לספק רשימת מזהי לקוחות" },
        { status: 400 }
      );
    }

    // בדיקה שכל הלקוחות קיימים — כולל organId ו-setTypeId להתאמת קבצים
    const customers = await prisma.customer.findMany({
      where: { id: { in: customerIds } },
      select: {
        id: true,
        fullName: true,
        email: true,
        customerId: true,
        infoFileUrl: true,
        organId: true,
        setTypeId: true,
        organ: { select: { organInfoFileUrl: true } }
      },
    });

    if (customers.length !== customerIds.length) {
      return NextResponse.json(
        { error: "חלק מהלקוחות לא נמצאו" },
        { status: 400 }
      );
    }

    // בדיקה אילו לקוחות כבר קיבלו את העדכון
    const alreadyReceived = await prisma.customerUpdate.findMany({
      where: {
        updateVersionId: id,
        customerId: { in: customerIds },
      },
      select: { customerId: true },
    });
    const alreadyReceivedIds = new Set(alreadyReceived.map((cu) => cu.customerId));

    // סינון לקוחות שלא קיבלו עדיין
    const newCustomerIds = customerIds.filter((cid) => !alreadyReceivedIds.has(cid));

    if (newCustomerIds.length === 0) {
      return NextResponse.json(
        { error: "כל הלקוחות המבוקשים כבר קיבלו את העדכון הזה" },
        { status: 400 }
      );
    }

    // שליפת קבצי עדכון (מטריצה) להתאמת לקוח-לקובץ
    const updateFiles = await prisma.updateFile.findMany({
      where: { updateVersionId: id },
    });
    const fileMap = new Map<string, typeof updateFiles[0]>();
    for (const uf of updateFiles) {
      fileMap.set(`${uf.setTypeId}_${uf.organId}`, uf);
    }

    // יצירת רשומות CustomerUpdate עם התאמת קובץ
    const now = new Date();
    const newCustomers = customers.filter((c) => newCustomerIds.includes(c.id));
    const customerUpdates = await prisma.customerUpdate.createMany({
      data: newCustomers.map((customer) => {
        const matchedFile = fileMap.get(`${customer.setTypeId}_${customer.organId}`);
        return {
          customerId: customer.id,
          updateVersionId: id,
          updateFileId: matchedFile?.id || null,
          sentAt: now,
          sentById: session.user.id,
        };
      }),
    });

    // עדכון גרסה נוכחית בלקוחות
    await prisma.customer.updateMany({
      where: { id: { in: newCustomerIds } },
      data: { currentUpdateVersion: updateVersion.version },
    });

    // יצירת CPI מותאם אישית מקובץ PPF (אם קיים)
    const cpiUrlMap = new Map<number, string>();
    if (updateVersion.ppfFileUrl) {
      const customersForCPI = newCustomers
        .filter((c) => c.infoFileUrl)
        .map((c) => ({
          id: c.id,
          customerId: c.customerId,
          infoFileUrl: c.infoFileUrl,
        }));

      if (customersForCPI.length > 0) {
        const cpiResult = await generateCPIsForCustomers(
          updateVersion.ppfFileUrl,
          updateVersion.version,
          customersForCPI,
          id,
        );

        for (const result of cpiResult.successful) {
          cpiUrlMap.set(result.customerId, result.cpiUrl);
        }

        for (const failure of cpiResult.failed) {
          console.error(`CPI generation failed for customer ${failure.customerId}: ${failure.error}`);
        }
      }
    }

    // שליחת מיילים אם יש תבנית מוגדרת
    if (updateVersion.emailSubject && updateVersion.emailBody) {
      await Promise.allSettled(
        newCustomers.map((customer) => {
          const matchedFile = fileMap.get(`${customer.setTypeId}_${customer.organId}`);
          // קישור הורדה: קודם קובץ מותאם, אחרת fallback לקישור כללי
          const downloadLink = matchedFile?.fileUrl || updateVersion.rhythmsFileUrl || "";

          // קישור לקובץ דגימות: 1) CPI שנוצר מ-PPF, 2) ZIP מותאם ישן, 3) דגימות כלליות
          const sampleFileLink = cpiUrlMap.get(customer.id)
            || (updateVersion.personalizedSamplesZipUrl
              ? `${updateVersion.personalizedSamplesZipUrl}/${String(customer.id)}.cpi`
              : updateVersion.samplesFileUrl || "");

          const html = replaceTemplateVariables(updateVersion.emailBody!, {
            customerName: customer.fullName,
            version: updateVersion.version,
            downloadLink,
            rhythmsLink: updateVersion.rhythmsFileUrl || "",
            samplesLink: sampleFileLink,
            infoLink: customer.infoFileUrl || "",
            organInfoLink: customer.organ?.organInfoFileUrl || "",
          });
          return sendEmail({
            to: customer.email,
            subject: updateVersion.emailSubject!,
            html,
          });
        })
      );
    }

    // רישום פעילות לכל לקוח
    const activityPromises = newCustomerIds.map((customerId) =>
      logActivity({
        userId: session.user.id,
        customerId,
        action: "SEND_UPDATE",
        entityType: "CUSTOMER_UPDATE",
        entityId: id,
        details: {
          version: updateVersion.version,
          customerId,
        },
      })
    );
    await Promise.all(activityPromises);

    return NextResponse.json({
      message: `העדכון נשלח בהצלחה ל-${newCustomerIds.length} לקוחות`,
      sentCount: newCustomerIds.length,
      alreadyReceivedCount: alreadyReceivedIds.size,
      totalCreated: customerUpdates.count,
      cpiGenerated: cpiUrlMap.size,
    });
  } catch (error) {
    console.error("Error sending update:", error);
    return NextResponse.json(
      { error: "שגיאה בשליחת העדכון" },
      { status: 500 }
    );
  }
}
