/**
 * CPI Conversion Service
 * Generates personalized CPI files from a PPF source, locked to each customer's organ model.
 */

import { parsePPFRaw } from './formats/ppi-parser';
import { buildEncryptedCPI } from './formats/cpi-encryptor';
import { parseN27 } from './formats/n27-parser';
import { downloadFile, uploadFileWithPath } from './azure-storage';

interface CustomerForCPI {
  id: number;
  customerId: string | null;
  infoFileUrl: string | null;
}

interface CPIResult {
  customerId: number;
  cpiUrl: string;
  modelName: string;
}

interface CPIError {
  customerId: number;
  error: string;
}

export interface ConversionResult {
  successful: CPIResult[];
  failed: CPIError[];
}

/**
 * Generate personalized CPI files for a list of customers from a PPF source.
 *
 * @param ppfFileUrl - URL to the uploaded PPF file in storage
 * @param versionNumber - Update version string (e.g., "V5")
 * @param customers - List of customers to generate CPIs for
 * @param updateVersionId - Used for storage path organization
 */
export async function generateCPIsForCustomers(
  ppfFileUrl: string,
  versionNumber: string,
  customers: CustomerForCPI[],
  updateVersionId: string,
): Promise<ConversionResult> {
  // Download and parse PPF file once (shared across all customers)
  const ppfBuffer = await downloadFile(ppfFileUrl);
  const ppfData = parsePPFRaw(new Uint8Array(ppfBuffer));

  const successful: CPIResult[] = [];
  const failed: CPIError[] = [];

  for (const customer of customers) {
    try {
      if (!customer.infoFileUrl) {
        failed.push({
          customerId: customer.id,
          error: 'ללקוח אין קובץ אינפו (.n27) מועלה',
        });
        continue;
      }

      // Download and parse customer's .n27 info file
      const n27Buffer = await downloadFile(customer.infoFileUrl);
      const n27FileName = customer.infoFileUrl.split('/').pop() || 'unknown.n27';
      const instrumentInfo = parseN27(new Uint8Array(n27Buffer), n27FileName);

      if (!instrumentInfo.name) {
        failed.push({
          customerId: customer.id,
          error: 'לא ניתן לחלץ שם דגם מקובץ .n27',
        });
        continue;
      }

      // Build encrypted CPI (XPIH + CSEC + DES-CBC encrypted payload)
      // When fullId is available, CPI is device-locked to that specific instrument
      const packInstallId = 1;
      const cpiData = buildEncryptedCPI(
        ppfData,
        instrumentInfo.name,
        packInstallId,
        undefined,
        instrumentInfo.fullId || undefined,
      );

      // Filename: {customerId}_{versionNumber}.cpi
      const fileIdentifier = customer.customerId || String(customer.id);
      const safeVersion = versionNumber.replace(/[^a-zA-Z0-9._-]/g, '_');
      const cpiFileName = `${fileIdentifier}_${safeVersion}.cpi`;

      // Upload CPI to storage
      const blobPath = `updates/${updateVersionId}/cpi/${cpiFileName}`;
      const cpiBuffer = Buffer.from(cpiData.buffer, cpiData.byteOffset, cpiData.byteLength);
      const cpiUrl = await uploadFileWithPath(cpiBuffer, blobPath);

      successful.push({
        customerId: customer.id,
        cpiUrl,
        modelName: instrumentInfo.name,
      });
    } catch (err) {
      failed.push({
        customerId: customer.id,
        error: err instanceof Error ? err.message : 'שגיאה לא ידועה ביצירת CPI',
      });
    }
  }

  return { successful, failed };
}
