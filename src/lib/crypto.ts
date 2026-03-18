import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY || process.env.AUTH_SECRET || "";
  // Pad or hash to 32 bytes
  const buf = Buffer.alloc(32);
  buf.write(key, "utf8");
  return buf;
}

export function encrypt(text: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: iv:tag:encrypted (hex)
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decrypt(encrypted: string): string {
  const parts = encrypted.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted format");
  }
  const iv = Buffer.from(parts[0], "hex");
  const tag = Buffer.from(parts[1], "hex");
  const data = Buffer.from(parts[2], "hex");
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(tag);
  return decipher.update(data) + decipher.final("utf8");
}
