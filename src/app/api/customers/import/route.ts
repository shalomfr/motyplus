import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { logActivity } from "@/lib/activity-logger";

// ===== CSV Parser =====
// Handles: BOM, quoted fields with commas/newlines, Hebrew text

function parseCSV(text: string): string[][] {
  // Remove BOM if present
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        field += ch;
        i++;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (ch === ",") {
        row.push(field.trim());
        field = "";
        i++;
      } else if (ch === "\r") {
        // skip \r
        i++;
      } else if (ch === "\n") {
        row.push(field.trim());
        field = "";
        if (row.some((cell) => cell !== "")) {
          rows.push(row);
        }
        row = [];
        i++;
      } else {
        field += ch;
        i++;
      }
    }
  }

  // Last field/row
  row.push(field.trim());
  if (row.some((cell) => cell !== "")) {
    rows.push(row);
  }

  return rows;
}

// ===== Helpers =====

function parseDateDDMMYYYY(dateStr: string): Date | null {
  if (!dateStr) return null;
  const parts = dateStr.split("/");
  if (parts.length !== 3) return null;
  const [day, month, year] = parts.map(Number);
  if (!day || !month || !year) return null;
  // Month is 0-indexed in JS
  const d = new Date(year, month - 1, day);
  if (isNaN(d.getTime())) return null;
  return d;
}

function parseAmount(amountStr: string): number {
  if (!amountStr) return 0;
  // Remove ₪, commas, spaces, dashes
  const cleaned = amountStr
    .replace(/₪/g, "")
    .replace(/,/g, "")
    .replace(/\s/g, "")
    .replace(/-/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function isTruthy(val: string): boolean {
  return val.toUpperCase() === "TRUE";
}

// Version columns in order — the LAST TRUE determines currentUpdateVersion
const VERSION_COLUMNS = [
  "V1",
  "V1.1",
  "V1.5",
  "V2",
  "V2.1",
  "V2.2",
  "V3.1",
  "V3.2",
  "V3.3",
  "V3.4",
  "V3.5",
  "V3.8",
  "V4",
  "V5",
  "V5.1",
  "V5.2",
  "V5.3",
  "V5.4",
  "V5.6",
];

// Map CSV column headers to indices
function buildHeaderMap(headers: string[]): Map<string, number> {
  const map = new Map<string, number>();
  headers.forEach((h, i) => {
    map.set(h.trim(), i);
  });
  return map;
}

function getCell(row: string[], headerMap: Map<string, number>, key: string): string {
  const idx = headerMap.get(key);
  if (idx === undefined || idx >= row.length) return "";
  return row[idx]?.trim() || "";
}

// ===== POST /api/customers/import =====

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: "לא מורשה. יש להתחבר למערכת" },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json(
        { error: "לא נבחר קובץ" },
        { status: 400 }
      );
    }

    // Read CSV content
    const buffer = await file.arrayBuffer();
    const text = new TextDecoder("utf-8").decode(buffer);
    const rows = parseCSV(text);

    if (rows.length < 2) {
      return NextResponse.json(
        { error: "הקובץ ריק או לא מכיל שורות נתונים" },
        { status: 400 }
      );
    }

    const headers = rows[0];
    const headerMap = buildHeaderMap(headers);
    const dataRows = rows.slice(1);

    // Verify required columns exist
    const requiredColumns = ["קוד לקוח", "שם לקוח", "פלאפון"];
    const missingColumns = requiredColumns.filter((c) => !headerMap.has(c));
    if (missingColumns.length > 0) {
      return NextResponse.json(
        { error: `עמודות חסרות: ${missingColumns.join(", ")}` },
        { status: 400 }
      );
    }

    // Load organs and set types for lookup
    const [organs, setTypes] = await Promise.all([
      prisma.organ.findMany({ select: { id: true, name: true } }),
      prisma.setType.findMany({ select: { id: true, name: true } }),
    ]);

    const organMap = new Map(organs.map((o) => [o.name, o.id]));
    const setTypeMap = new Map(setTypes.map((s) => [s.name, s.id]));

    // Get existing customer IDs to skip duplicates (by customerId AND by numeric id)
    const existingCustomers = await prisma.customer.findMany({
      select: { id: true, customerId: true },
    });
    const existingCustomerIds = new Set(
      existingCustomers.filter(c => c.customerId).map(c => c.customerId)
    );
    const existingNumericIds = new Set(existingCustomers.map(c => c.id));

    const batchTag = Date.now().toString();
    let created = 0;
    let skipped = 0;
    const errors: { row: number; customerId: string; error: string }[] = [];
    const skippedDetails: { row: number; customerId: string; reason: string }[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNum = i + 2; // 1-indexed, header is row 1
      const customerIdStr = getCell(row, headerMap, "קוד לקוח");

      if (!customerIdStr) {
        skipped++;
        skippedDetails.push({ row: rowNum, customerId: "-", reason: "קוד לקוח ריק" });
        continue;
      }

      // Skip if already exists (by customerId or numeric id)
      const numId = parseInt(customerIdStr);
      if (existingCustomerIds.has(customerIdStr) || (!isNaN(numId) && existingNumericIds.has(numId))) {
        skipped++;
        skippedDetails.push({ row: rowNum, customerId: customerIdStr, reason: "קוד לקוח קיים במערכת" });
        continue;
      }

      try {
        const fullName = getCell(row, headerMap, "שם לקוח");
        const phone = getCell(row, headerMap, "פלאפון");
        const address = getCell(row, headerMap, "כתובת") || null;
        const email = getCell(row, headerMap, "מייל") || "";
        const purchaseDateStr = getCell(row, headerMap, "תאריך קניה");
        const exceptionFlag = isTruthy(getCell(row, headerMap, "חריג"));
        const updateExpiryStr = getCell(row, headerMap, "תאריך עדכון");
        const blockedFlag = isTruthy(getCell(row, headerMap, "חסימת לקוח"));
        const computerFlag = isTruthy(getCell(row, headerMap, "לקוח מחשב"));
        const activeFlag = isTruthy(getCell(row, headerMap, "פעיל"));
        const organName = getCell(row, headerMap, "אורגן");
        const setTypeName = getCell(row, headerMap, "מקצבים");
        const totalAmountStr = getCell(row, headerMap, "סכום");
        const paidAmountStr = getCell(row, headerMap, "שולם");
        const notesRaw = getCell(row, headerMap, "הערת לקוח");
        const hasV3 = isTruthy(getCell(row, headerMap, "V3"));

        // Validation
        if (!fullName) {
          errors.push({ row: rowNum, customerId: customerIdStr, error: "שם לקוח חסר" });
          continue;
        }

        // Lookup organ
        let organId = organMap.get(organName);
        if (!organId && organName) {
          // Try to create the organ
          const newOrgan = await prisma.organ.create({
            data: { name: organName, supportsUpdates: true },
          });
          organMap.set(organName, newOrgan.id);
          organId = newOrgan.id;
        }
        if (!organId) {
          errors.push({ row: rowNum, customerId: customerIdStr, error: `אורגן לא נמצא: "${organName}"` });
          continue;
        }

        // Lookup set type
        let setTypeId = setTypeMap.get(setTypeName);
        if (!setTypeId && setTypeName) {
          // Try to create the set type
          const newSetType = await prisma.setType.create({
            data: { name: setTypeName, price: 0 },
          });
          setTypeMap.set(setTypeName, newSetType.id);
          setTypeId = newSetType.id;
        }
        if (!setTypeId) {
          errors.push({ row: rowNum, customerId: customerIdStr, error: `סוג סט לא נמצא: "${setTypeName}"` });
          continue;
        }

        // Parse dates
        const purchaseDate = parseDateDDMMYYYY(purchaseDateStr) || new Date();
        const updateExpiryDate = parseDateDDMMYYYY(updateExpiryStr) || (() => {
          const d = new Date(purchaseDate);
          d.setFullYear(d.getFullYear() + 1);
          return d;
        })();

        // Determine status
        let status: "ACTIVE" | "BLOCKED" | "FROZEN" | "EXCEPTION" = "ACTIVE";
        if (exceptionFlag) {
          status = "EXCEPTION";
        } else if (blockedFlag) {
          status = "BLOCKED";
        } else if (activeFlag) {
          status = "ACTIVE";
        }
        // Default is ACTIVE

        // Sample type
        const sampleType = computerFlag ? "CPF" : "CPI";

        // Parse amounts — use paid amount (שולם) as amountPaid
        const amountPaid = parseAmount(paidAmountStr) || parseAmount(totalAmountStr) || 0;

        // Determine currentUpdateVersion from V columns
        let currentUpdateVersion: string | null = null;
        for (const ver of VERSION_COLUMNS) {
          const val = getCell(row, headerMap, ver);
          if (isTruthy(val)) {
            currentUpdateVersion = ver;
          }
        }

        // Build notes with batch tag
        const notes = `[CSV_IMPORT:${batchTag}]${notesRaw ? " " + notesRaw : ""}`;

        const numericId = parseInt(customerIdStr);
        await prisma.customer.create({
          data: {
            id: isNaN(numericId) ? undefined : numericId,
            customerId: customerIdStr,
            fullName,
            phone: phone || "",
            address,
            email: email || `no-email-${customerIdStr}@import.local`,
            purchaseDate,
            updateExpiryDate,
            organId,
            setTypeId,
            amountPaid,
            status,
            sampleType,
            currentUpdateVersion,
            hasV3,
            isCasual: false,
            notes,
          },
        });

        created++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push({ row: rowNum, customerId: customerIdStr, error: message });
      }
    }

    await logActivity({
      userId: session.user.id,
      action: "CSV_IMPORT",
      entityType: "CUSTOMER",
      entityId: batchTag,
      details: { created, skipped, errors: errors.length, batchTag },
    });

    return NextResponse.json({
      created,
      skipped,
      skippedDetails: skippedDetails.slice(0, 50),
      errors,
      batchTag,
      total: dataRows.length,
    });
  } catch (error) {
    console.error("Error importing customers:", error);
    return NextResponse.json(
      { error: "שגיאה בייבוא הלקוחות" },
      { status: 500 }
    );
  }
}

// ===== DELETE /api/customers/import =====
// Deletes all customers from a specific import batch

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: "לא מורשה. יש להתחבר למערכת" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const batch = searchParams.get("batch");

    if (!batch) {
      return NextResponse.json(
        { error: "חסר פרמטר batch" },
        { status: 400 }
      );
    }

    // batch=ALL → מחק את כל הלקוחות שיובאו (כל מי שיש לו תגית CSV_IMPORT)
    const whereClause = batch === "ALL"
      ? { notes: { contains: "[CSV_IMPORT:" } }
      : { notes: { startsWith: `[CSV_IMPORT:${batch}]` } };

    const result = await prisma.customer.deleteMany({
      where: whereClause,
    });

    await logActivity({
      userId: session.user.id,
      action: "CSV_IMPORT_ROLLBACK",
      entityType: "CUSTOMER",
      entityId: batch,
      details: { deleted: result.count, batchTag: batch },
    });

    return NextResponse.json({ deleted: result.count });
  } catch (error) {
    console.error("Error deleting imported customers:", error);
    return NextResponse.json(
      { error: "שגיאה במחיקת הייבוא" },
      { status: 500 }
    );
  }
}
