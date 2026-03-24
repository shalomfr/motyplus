import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

// Wave capacity units per organ model
const ORGAN_WAVE_UNITS: Record<string, number> = {
  "Tyros5-1G": 0x03FF,
  "Tyros5-2G": 0x07FF,
  "Genos":     0x1FFF,    // larger
  "Genos 2":   0x3FFF,    // largest
  "PSR-SX920": 0x07FF,
  "PSR-SX720": 0x03FF,
  "PSR-SX900": 0x07FF,
  "PSR-SX700": 0x03FF,
  "PSR-S970":  0x03FF,
  "PSR-S975":  0x03FF,
  "PSR-A3000": 0x03FF,
  "PSR-S770":  0x01FF,
  "PSR-S775":  0x01FF,
};

const ORGAN_PARAM_UNITS: Record<string, number> = {
  "Tyros5-1G": 0x007C,
  "Tyros5-2G": 0x00F8,
  "Genos":     0x01F0,
  "Genos 2":   0x03E0,
  "PSR-SX920": 0x007C,
  "PSR-SX720": 0x003E,
  "PSR-SX900": 0x007C,
  "PSR-SX700": 0x003E,
  "PSR-S970":  0x003E,
  "PSR-S975":  0x003E,
  "PSR-A3000": 0x003E,
  "PSR-S770":  0x001F,
  "PSR-S775":  0x001F,
};

// N27 instrument name as it appears in the binary
const ORGAN_N27_NAME: Record<string, string> = {
  "Tyros5-1G": "TYROS5",
  "Tyros5-2G": "TYROS5",
  "Genos":     "GENOS",
  "Genos 2":   "GENOS2",
  "PSR-SX920": "PSR-SX920",
  "PSR-SX720": "PSR-SX720",
  "PSR-SX900": "PSR-SX900",
  "PSR-SX700": "PSR-SX700",
  "PSR-S970":  "PSR-S970",
  "PSR-S975":  "PSR-S975",
  "PSR-A3000": "PSR-A3000",
  "PSR-S770":  "PSR-S770",
  "PSR-S775":  "PSR-S775",
};

function writeString(buf: Buffer, offset: number, str: string, maxLen: number) {
  buf.fill(0, offset, offset + maxLen);
  buf.write(str, offset, Math.min(str.length, maxLen), "ascii");
}

function writeUint32BE(buf: Buffer, offset: number, value: number) {
  buf[offset]     = (value >>> 24) & 0xFF;
  buf[offset + 1] = (value >>> 16) & 0xFF;
  buf[offset + 2] = (value >>> 8) & 0xFF;
  buf[offset + 3] = value & 0xFF;
}

function generateSerial(customerId: number): string {
  const prefix = "MB"; // Motty Beats
  const hex = customerId.toString(16).toUpperCase().padStart(8, "0");
  return `${prefix}${hex}`;
}

function generateFullId(customerId: number, serial: string): string {
  return `${customerId}_${serial}`;
}

function createN27(organName: string, customerId: number): Buffer {
  const buf = Buffer.alloc(144, 0); // 0x90 bytes

  const n27Name = ORGAN_N27_NAME[organName] || organName.toUpperCase().replace(/[\s-]/g, "");
  const serial = generateSerial(customerId);
  const fullId = generateFullId(customerId, serial);
  const waveUnits = ORGAN_WAVE_UNITS[organName] || 0x03FF;
  const paramUnits = ORGAN_PARAM_UNITS[organName] || 0x003E;

  // 0x00-0x3F: instrument name (64 bytes)
  writeString(buf, 0x00, n27Name, 64);

  // 0x40-0x57: serial (24 bytes)
  writeString(buf, 0x40, serial, 24);

  // 0x58-0x77: full ID (32 bytes)
  writeString(buf, 0x58, fullId, 32);

  // 0x78-0x7B: wave units (uint32 BE)
  writeUint32BE(buf, 0x78, waveUnits);

  // 0x7C-0x7F: zero padding
  writeUint32BE(buf, 0x7C, 0);

  // 0x80-0x83: param units (uint32 BE)
  writeUint32BE(buf, 0x80, paramUnits);

  // 0x84-0x8B: additional flags
  writeUint32BE(buf, 0x84, 0x03); // matches original

  return buf;
}

async function main() {
  const outputDir = path.join(__dirname, "..", "generated-info-files");
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const customers = await prisma.customer.findMany({
    include: { organ: true },
    orderBy: { id: "asc" },
  });

  console.log(`=== יצירת קבצי N27 ל-${customers.length} לקוחות ===\n`);

  for (const customer of customers) {
    const n27 = createN27(customer.organ.name, customer.id);
    const fileName = `${customer.id}.n27`;
    const filePath = path.join(outputDir, fileName);

    fs.writeFileSync(filePath, n27);

    // עדכון שם מזהה בDB
    await prisma.customer.update({
      where: { id: customer.id },
      data: { customerId: String(customer.id) },
    });

    console.log(`  ✓ ${fileName} — ${customer.fullName} (${customer.organ.name})`);
  }

  console.log(`\n=== נוצרו ${customers.length} קבצים ב-${outputDir} ===`);
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
