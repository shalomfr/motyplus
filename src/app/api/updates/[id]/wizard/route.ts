import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { listFiles } from "@/lib/file-storage";
import { replaceTemplateVariables } from "@/lib/email";

export const dynamic = "force-dynamic";

interface SegmentCustomer {
  id: number;
  fullName: string;
  email: string;
  organ: string;
  setType: string;
}

interface WizardSegment {
  key: string;
  label: string;
  count: number;
  templateName: string | null;
  previewSubject: string;
  previewBody: string;
  sampleCustomers: SegmentCustomer[];
  canSend: boolean;
  color: string;
}

const SAMPLE_VARIABLES: Record<string, string> = {
  fullName: "ישראל ישראלי",
  firstName: "ישראל",
  customerName: "ישראל ישראלי",
  email: "israel@example.com",
  phone: "050-1234567",
  organ: "Genos 2",
  organName: "Genos 2",
  setType: "סט שלם",
  currentVersion: "V5.0",
  updateVersion: "V6.0",
  version: "V6.0",
  downloadLink: "https://drive.google.com/example",
  downloadLink2: "",
  rhythmsLink: "https://drive.google.com/rhythms",
  remainingAmount: "350",
  remainingForFullSet: "₪350",
  purchaseDate: "01/01/2025",
  updateExpiryDate: "01/01/2026",
  additionalOrganName: "",
  additionalOrganLine: "",
  customerId: "12345",
};

function formatCustomer(c: {
  id: number;
  fullName: string;
  email: string;
  organ: { name: string } | null;
  setType: { name: string } | null;
}): SegmentCustomer {
  return {
    id: c.id,
    fullName: c.fullName,
    email: c.email,
    organ: c.organ?.name || "",
    setType: c.setType?.name || "",
  };
}

async function buildPreview(
  templateName: string,
  versionName: string
): Promise<{ subject: string; body: string }> {
  const template = await prisma.emailTemplate.findFirst({
    where: { name: templateName },
  });

  if (!template) {
    return { subject: `(תבנית "${templateName}" לא נמצאה)`, body: "" };
  }

  const vars = { ...SAMPLE_VARIABLES, version: versionName, updateVersion: versionName };
  return {
    subject: replaceTemplateVariables(template.subject, vars),
    body: replaceTemplateVariables(template.body, vars),
  };
}

async function countCpiFiles(): Promise<Set<number>> {
  const customerIdsWithCpi = new Set<number>();
  try {
    const sampleFiles = await listFiles("updates/samples");
    for (const f of sampleFiles) {
      const name = f.path.split("/").pop() || "";
      const baseName = name.replace(/\.cpi$/i, "");
      const isAdditional = baseName.includes("_");
      const custId = parseInt(isAdditional ? baseName.split("_")[0] : baseName);
      if (!isNaN(custId)) customerIdsWithCpi.add(custId);
    }
  } catch {
    // folder may not exist
  }
  return customerIdsWithCpi;
}

const SAMPLE_LIMIT = 5;

// GET /api/updates/[id]/wizard
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "לא מורשה" }, { status: 401 });
    }

    const { id } = await params;

    const updateVersion = await prisma.updateVersion.findUnique({ where: { id } });
    if (!updateVersion) {
      return NextResponse.json({ error: "העדכון לא נמצא" }, { status: 404 });
    }

    const now = new Date();
    const version = updateVersion.version;

    const alreadyReceived = await prisma.customerUpdate.findMany({
      where: { updateVersionId: id },
      select: { customerId: true },
    });
    const alreadyReceivedIds = new Set(alreadyReceived.map((cu) => cu.customerId));

    const customerSelect = {
      id: true,
      fullName: true,
      email: true,
      status: true,
      isCasual: true,
      updateExpiryDate: true,
      currentUpdateVersion: true,
      organ: { select: { name: true, supportsUpdates: true } },
      setType: { select: { name: true, includesUpdates: true } },
    } as const;

    const [allActive, allBlocked, allCasual, cpiSet, latestVersion] = await Promise.all([
      prisma.customer.findMany({
        where: { status: { in: ["ACTIVE", "EXCEPTION"] }, isCasual: false },
        select: customerSelect,
      }),
      prisma.customer.findMany({
        where: { status: { in: ["BLOCKED", "FROZEN"] } },
        select: customerSelect,
      }),
      prisma.customer.findMany({
        where: { isCasual: true },
        select: customerSelect,
      }),
      countCpiFiles(),
      prisma.updateVersion.findFirst({
        where: { status: { not: "DRAFT" } },
        orderBy: { sortOrder: "desc" },
        select: { version: true },
      }),
    ]);

    const eligible: typeof allActive = [];
    const missingCpi: typeof allActive = [];
    const notUpdated: typeof allActive = [];
    const halfSet: typeof allActive = [];
    const expired: typeof allActive = [];

    for (const c of allActive) {
      if (alreadyReceivedIds.has(c.id)) continue;

      if (!c.organ?.supportsUpdates) continue;

      const hasFullSet = c.setType?.includesUpdates === true;
      const inDate = c.updateExpiryDate >= now || c.status === "EXCEPTION";

      if (hasFullSet && inDate) {
        if (cpiSet.has(c.id)) {
          eligible.push(c);
        } else {
          missingCpi.push(c);
        }
      } else if (hasFullSet && !inDate) {
        expired.push(c);
      } else if (!hasFullSet) {
        halfSet.push(c);
      }
    }

    const currentVersion = latestVersion?.version;
    const notUpdatedFiltered = notUpdated.length === 0
      ? allActive.filter((c) => {
          if (alreadyReceivedIds.has(c.id)) return false;
          if (!c.setType?.includesUpdates) return false;
          if (!currentVersion) return c.currentUpdateVersion === null;
          return c.currentUpdateVersion !== currentVersion;
        })
      : notUpdated;

    const [eligiblePreview, notUpdatedPreview, halfSetPreview, expiredPreview] =
      await Promise.all([
        buildPreview("עדכון חדש — ללקוח מעודכן", version),
        buildPreview("הצעת מחיר — למי שלא מעודכן", version),
        buildPreview("הצעה לחצאי סטים", version),
        buildPreview("הצעת מחיר — למי שלא מעודכן", version),
      ]);

    const segments: WizardSegment[] = [
      {
        key: "eligible",
        label: "זכאי לעדכון",
        count: eligible.length,
        templateName: "עדכון חדש — ללקוח מעודכן",
        previewSubject: eligiblePreview.subject,
        previewBody: eligiblePreview.body,
        sampleCustomers: eligible.slice(0, SAMPLE_LIMIT).map(formatCustomer),
        canSend: true,
        color: "green",
      },
      {
        key: "missing_cpi",
        label: "חסר CPI",
        count: missingCpi.length,
        templateName: null,
        previewSubject: "",
        previewBody: "",
        sampleCustomers: missingCpi.slice(0, SAMPLE_LIMIT).map(formatCustomer),
        canSend: false,
        color: "yellow",
      },
      {
        key: "not_updated",
        label: "לא מעודכן (סט שלם)",
        count: notUpdatedFiltered.length,
        templateName: "הצעת מחיר — למי שלא מעודכן",
        previewSubject: notUpdatedPreview.subject,
        previewBody: notUpdatedPreview.body,
        sampleCustomers: notUpdatedFiltered.slice(0, SAMPLE_LIMIT).map(formatCustomer),
        canSend: true,
        color: "orange",
      },
      {
        key: "half_set",
        label: "חצי סט",
        count: halfSet.length,
        templateName: "הצעה לחצאי סטים",
        previewSubject: halfSetPreview.subject,
        previewBody: halfSetPreview.body,
        sampleCustomers: halfSet.slice(0, SAMPLE_LIMIT).map(formatCustomer),
        canSend: true,
        color: "blue",
      },
      {
        key: "expired",
        label: "תפוגה עברה",
        count: expired.length,
        templateName: "הצעת מחיר — למי שלא מעודכן",
        previewSubject: expiredPreview.subject,
        previewBody: expiredPreview.body,
        sampleCustomers: expired.slice(0, SAMPLE_LIMIT).map(formatCustomer),
        canSend: true,
        color: "red",
      },
      {
        key: "excluded",
        label: "מוחרגים",
        count: allBlocked.length + allCasual.length,
        templateName: null,
        previewSubject: "",
        previewBody: "",
        sampleCustomers: [],
        canSend: false,
        color: "gray",
      },
    ];

    const totalEligibleForCpi = eligible.length + missingCpi.length;

    return NextResponse.json({
      updateVersion: {
        id: updateVersion.id,
        version: updateVersion.version,
        status: updateVersion.status,
        price: updateVersion.price,
        description: updateVersion.description,
      },
      segments,
      cpiStatus: {
        ready: eligible.length,
        total: totalEligibleForCpi,
      },
      alreadySent: alreadyReceivedIds.size,
    });
  } catch (error) {
    console.error("Error in wizard GET:", error);
    return NextResponse.json({ error: "שגיאה בטעינת נתוני האשף" }, { status: 500 });
  }
}
