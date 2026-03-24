/**
 * CLI tool for locking/unlocking PPI files.
 *
 * Usage:
 *   npx tsx scripts/ppi-lock-cli.ts lock  <ppi-file> <n27-file> [output.lppi]
 *   npx tsx scripts/ppi-lock-cli.ts unlock <lppi-file> <n27-file> [output.ppi]
 *   npx tsx scripts/ppi-lock-cli.ts verify <lppi-file> <n27-file>
 */

import { readFileSync, writeFileSync } from "fs";
import { basename, resolve } from "path";
import { lockPPI, unlockPPI, verifyMatch } from "../src/lib/formats/ppi-locker";

// Inline N27 parser (avoid import path issues)
function parseN27FullId(buf: Buffer): { name: string; serial: string; fullId: string } {
  const readStr = (offset: number, maxLen: number) => {
    let end = offset;
    while (end < offset + maxLen && buf[end] !== 0) end++;
    return buf.subarray(offset, end).toString("ascii");
  };
  return {
    name: readStr(0, 64).trim(),
    serial: buf.length >= 88 ? readStr(64, 24).trim() : "",
    fullId: buf.length >= 120 ? readStr(88, 32).trim() : "",
  };
}

const [, , command, file1, file2, outputPath] = process.argv;

if (!command || !file1 || !file2) {
  console.log(`
PPI Locker — נעילת קבצי PPI לאורגן ספציפי

שימוש:
  npx tsx scripts/ppi-lock-cli.ts lock   <ppi-file> <n27-file> [output.lppi]
  npx tsx scripts/ppi-lock-cli.ts unlock <lppi-file> <n27-file> [output.ppi]
  npx tsx scripts/ppi-lock-cli.ts verify <lppi-file> <n27-file>
  npx tsx scripts/ppi-lock-cli.ts lock-id <ppi-file> <fullId>   [output.lppi]
`);
  process.exit(1);
}

try {
  if (command === "lock") {
    const ppiData = readFileSync(resolve(file1));
    const n27Data = readFileSync(resolve(file2));
    const info = parseN27FullId(n27Data);

    if (!info.fullId) {
      console.error("שגיאה: לא נמצא fullId בקובץ N27");
      process.exit(1);
    }

    console.log(`אורגן: ${info.name}`);
    console.log(`סריאל: ${info.serial}`);
    console.log(`fullId: ${info.fullId}`);
    console.log(`גודל PPI: ${(ppiData.length / 1024 / 1024).toFixed(2)} MB`);

    const result = lockPPI(ppiData, info.fullId);
    const outFile = outputPath || file1.replace(/\.ppi$/i, ".lppi");
    writeFileSync(resolve(outFile), result.locked);

    console.log(`\nנעול בהצלחה → ${basename(outFile)}`);
    console.log(`גודל LPPI: ${(result.locked.length / 1024 / 1024).toFixed(2)} MB`);

  } else if (command === "lock-id") {
    // Lock with a raw fullId string (without N27 file)
    const ppiData = readFileSync(resolve(file1));
    const fullId = file2; // file2 is actually the fullId string

    console.log(`fullId: ${fullId}`);
    console.log(`גודל PPI: ${(ppiData.length / 1024 / 1024).toFixed(2)} MB`);

    const result = lockPPI(ppiData, fullId);
    const outFile = outputPath || file1.replace(/\.ppi$/i, ".lppi");
    writeFileSync(resolve(outFile), result.locked);

    console.log(`\nנעול בהצלחה → ${basename(outFile)}`);
    console.log(`גודל LPPI: ${(result.locked.length / 1024 / 1024).toFixed(2)} MB`);

  } else if (command === "unlock") {
    const lppiData = readFileSync(resolve(file1));
    const n27Data = readFileSync(resolve(file2));
    const info = parseN27FullId(n27Data);

    if (!info.fullId) {
      console.error("שגיאה: לא נמצא fullId בקובץ N27");
      process.exit(1);
    }

    console.log(`מנסה לפתוח עם: ${info.name} (${info.fullId})`);

    const result = unlockPPI(lppiData, info.fullId);
    const outFile = outputPath || file1.replace(/\.lppi$/i, "_unlocked.ppi");
    writeFileSync(resolve(outFile), result.ppiData);

    console.log(`נפתח בהצלחה → ${basename(outFile)}`);
    console.log(`גודל PPI: ${(result.ppiData.length / 1024 / 1024).toFixed(2)} MB`);

  } else if (command === "verify") {
    const lppiData = readFileSync(resolve(file1));
    const n27Data = readFileSync(resolve(file2));
    const info = parseN27FullId(n27Data);

    if (!info.fullId) {
      console.error("שגיאה: לא נמצא fullId בקובץ N27");
      process.exit(1);
    }

    const matches = verifyMatch(lppiData, info.fullId);
    console.log(`אורגן: ${info.name} (${info.fullId})`);
    console.log(matches ? "תואם — ניתן לפתוח" : "לא תואם — אורגן שגוי");
    process.exit(matches ? 0 : 1);

  } else {
    console.error(`פקודה לא מוכרת: ${command}`);
    process.exit(1);
  }
} catch (err: unknown) {
  console.error(`שגיאה: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
}
