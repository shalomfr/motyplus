/**
 * PPI Locker — Custom lock mechanism for PPI files.
 * Locks a PPI so it can only be unlocked with a matching N27 info file.
 *
 * Format (.lppi):
 *   [4]  Magic "LPPI"
 *   [1]  Version (0x01)
 *   [32] SHA-256 hash of fullId (for verification)
 *   [12] AES-GCM IV/nonce
 *   [16] AES-GCM auth tag
 *   [...] Encrypted PPI payload
 *
 * Key derivation: SHA-256(fullId from N27) → 32-byte AES-256 key
 */

import { createHash, createCipheriv, createDecipheriv, randomBytes } from "crypto";

const MAGIC = Buffer.from("LPPI");
const VERSION = 0x01;
const HEADER_SIZE = 4 + 1 + 32 + 12 + 16; // 65 bytes

function deriveKey(fullId: string): Buffer {
  return createHash("sha256").update(fullId, "ascii").digest();
}

function hashFullId(fullId: string): Buffer {
  return createHash("sha256").update("lppi-verify:" + fullId, "ascii").digest();
}

export interface LockResult {
  locked: Buffer;
  fullId: string;
  originalSize: number;
}

/**
 * Lock a PPI file to a specific organ's fullId.
 */
export function lockPPI(ppiData: Buffer, fullId: string): LockResult {
  if (!fullId || fullId.length < 4) {
    throw new Error("fullId חייב להכיל לפחות 4 תווים");
  }

  const key = deriveKey(fullId);
  const iv = randomBytes(12);
  const idHash = hashFullId(fullId);

  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(ppiData), cipher.final()]);
  const authTag = cipher.getAuthTag(); // 16 bytes

  const header = Buffer.alloc(HEADER_SIZE);
  let offset = 0;

  // Magic
  MAGIC.copy(header, offset);
  offset += 4;

  // Version
  header[offset] = VERSION;
  offset += 1;

  // fullId hash (for verification)
  idHash.copy(header, offset);
  offset += 32;

  // IV
  iv.copy(header, offset);
  offset += 12;

  // Auth tag
  authTag.copy(header, offset);

  return {
    locked: Buffer.concat([header, encrypted]),
    fullId,
    originalSize: ppiData.length,
  };
}

export interface UnlockResult {
  ppiData: Buffer;
  verified: boolean;
}

/**
 * Unlock an LPPI file using the organ's fullId from N27.
 */
export function unlockPPI(lppiData: Buffer, fullId: string): UnlockResult {
  if (lppiData.length < HEADER_SIZE) {
    throw new Error("קובץ LPPI קטן מדי או פגום");
  }

  // Verify magic
  const magic = lppiData.subarray(0, 4);
  if (!magic.equals(MAGIC)) {
    throw new Error("קובץ לא בפורמט LPPI");
  }

  const version = lppiData[4];
  if (version !== VERSION) {
    throw new Error(`גרסת LPPI לא נתמכת: ${version}`);
  }

  let offset = 5;

  // Read stored hash
  const storedHash = lppiData.subarray(offset, offset + 32);
  offset += 32;

  // Verify fullId matches
  const providedHash = hashFullId(fullId);
  if (!Buffer.from(storedHash).equals(providedHash)) {
    throw new Error("קובץ האינפו לא תואם — אורגן שגוי");
  }

  // Read IV
  const iv = lppiData.subarray(offset, offset + 12);
  offset += 12;

  // Read auth tag
  const authTag = lppiData.subarray(offset, offset + 16);
  offset += 16;

  // Encrypted payload
  const encrypted = lppiData.subarray(offset);

  // Decrypt
  const key = deriveKey(fullId);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  try {
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return { ppiData: decrypted, verified: true };
  } catch {
    throw new Error("פיענוח נכשל — קובץ פגום או אינפו לא תואם");
  }
}

/**
 * Check if an LPPI file matches a given fullId (without decrypting).
 */
export function verifyMatch(lppiData: Buffer, fullId: string): boolean {
  if (lppiData.length < HEADER_SIZE) return false;
  if (!lppiData.subarray(0, 4).equals(MAGIC)) return false;

  const storedHash = lppiData.subarray(5, 37);
  const providedHash = hashFullId(fullId);
  return Buffer.from(storedHash).equals(providedHash);
}
