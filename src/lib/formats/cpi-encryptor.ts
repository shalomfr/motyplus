/**
 * CPI Encryption Module
 * Encrypts CPI files using Yamaha's DES/3DES encryption format.
 *
 * Encrypted CPI structure:
 *   XPIH (unencrypted) - model lock header (XMDL + XPID)
 *   CSEC chunk (encrypted) - 80 bytes security/authentication data
 *   Raw encrypted payload - DES-CBC encrypted content (EUID + ETIT + BLOBs)
 *
 * Device lock:
 *   When fullId is provided, generates a device-locked CSEC using
 *   key derivation + 3DES instead of the standard (universal) CSEC.
 *   The payload encryption (DES-CBC "Foatfkio") is the same for both.
 */

import DESModule from 'des.js';
import { buildChunk, buildContainerChunk, buildTextChunk, concatArrays } from './chunk-reader';
import type { PPFData } from './ppi-parser';
import { randomBytes, createCipheriv } from 'crypto';

// ============================================================
// Constants
// ============================================================

/** Yamaha DES key (ASCII "Foatfkio") */
const DES_KEY_RAW = [0x46, 0x6f, 0x61, 0x74, 0x66, 0x6b, 0x69, 0x6f];

/** DES key for AIRI encryption (ASCII "dualseal") */
const DES_KEY_DUALSEAL = [0x64, 0x75, 0x61, 0x6c, 0x73, 0x65, 0x61, 0x6c];

const DES_IV = [0, 0, 0, 0, 0, 0, 0, 0];

/** XOR seed for key derivation (IDA: sub_14095DFD0) */
const XOR_SEED = new Uint8Array([
  0x0f, 0x62, 0xbe, 0x39, 0xd1, 0x70, 0xc7, 0xf4,
  0x1a, 0x85, 0x2d, 0x5c, 0x96, 0xe8, 0x4b, 0xa3,
]);

/** Expansion table: 16-byte key → 24-byte 3DES key (IDA: sub_14095E300) */
const EXPANSION_TABLE = [
  0x07, 0x0c, 0x0e, 0x0a, 0x0b, 0x0d, 0x00, 0x01,
  0x06, 0x02, 0x0f, 0x03, 0x09, 0x04, 0x08, 0x05,
  0x00, 0x0f, 0x02, 0x08, 0x06, 0x09, 0x01, 0x0a,
  0x0e, 0x0c, 0x0b, 0x03, 0x04, 0x05, 0x07, 0x0d,
  0x07, 0x05, 0x0c, 0x04, 0x0f, 0x0d, 0x01, 0x09,
  0x08, 0x0a, 0x00, 0x03, 0x0b, 0x06, 0x0e, 0x02,
];

/**
 * Standard CSEC encrypted data (80 bytes).
 * Used for non-device-locked packs.
 */
const CSEC_ENCRYPTED_DATA = new Uint8Array([
  0x5a, 0x51, 0x7c, 0x40, 0x5f, 0x44, 0x7c, 0x02,
  0x90, 0x3b, 0xcc, 0x5e, 0x1d, 0x69, 0xdc, 0xf8,
  0x52, 0x2f, 0xe8, 0x75, 0xd0, 0xed, 0x7f, 0x97,
  0xf3, 0xef, 0x1e, 0x23, 0x6e, 0x4f, 0x9d, 0x80,
  0x29, 0x87, 0x42, 0x89, 0xad, 0xdc, 0xc3, 0xc2,
  0x23, 0xff, 0xa3, 0x65, 0x55, 0xc2, 0x5d, 0xaf,
  0xf4, 0x93, 0x11, 0x96, 0xf1, 0x4d, 0xa7, 0xd9,
  0x12, 0xe6, 0x07, 0xee, 0x15, 0xc0, 0x45, 0x24,
  0x26, 0x58, 0x5c, 0x1f, 0xb4, 0x50, 0x56, 0xe7,
  0x54, 0xbc, 0xe9, 0x49, 0xf6, 0xda, 0xf0, 0x55,
]);

// ============================================================
// DES Helpers
// ============================================================

/**
 * Yamaha MSB parity: bits 0-6 are key material, bit 7 is parity.
 * Matches the Yamaha firmware convention (IDA: sub_14095FD10).
 */
function msbParity(keyBytes: number[] | Uint8Array): number[] {
  const result = new Array(keyBytes.length);
  for (let i = 0; i < keyBytes.length; i++) {
    let b = keyBytes[i] & 0x7f;
    let t = b;
    t ^= (t << 4) & 0xff;
    t ^= (t << 2) & 0xff;
    t ^= (t << 1) & 0xff;
    result[i] = b | (~t & 0x80);
  }
  return result;
}

/**
 * Add Yamaha-style padding to make data a multiple of 8 bytes.
 * Last byte = (originalLength % 8). Always adds at least 8 bytes.
 */
function addYamahaPadding(data: Uint8Array): Uint8Array {
  const remainder = data.length % 8;
  const padLen = remainder === 0 ? 8 : 8 - remainder;
  const padded = new Uint8Array(data.length + padLen);
  padded.set(data, 0);
  padded[padded.length - 1] = remainder;
  return padded;
}

/**
 * Encrypt data using DES-CBC.
 * @param data - Must be a multiple of 8 bytes
 * @param key - Parity-adjusted 8-byte DES key (default: msbParity("Foatfkio"))
 */
function encryptDESCBC(data: Uint8Array, key?: number[]): Uint8Array {
  const desKey = key ?? msbParity(DES_KEY_RAW);
  const des = new DESModule.DES({ type: 'encrypt', key: desKey });
  const encrypted = new Uint8Array(data.length);
  const prevBlock = new Uint8Array(DES_IV);

  for (let i = 0; i < data.length; i += 8) {
    const xored = new Uint8Array(8);
    for (let j = 0; j < 8; j++) {
      xored[j] = data[i + j] ^ prevBlock[j];
    }
    const encBlock = new Uint8Array(des.update(Array.from(xored)));
    encrypted.set(encBlock, i);
    prevBlock.set(encBlock);
  }

  return encrypted;
}

function writeUint32BE(buf: Uint8Array, offset: number, value: number): void {
  buf[offset] = (value >>> 24) & 0xff;
  buf[offset + 1] = (value >>> 16) & 0xff;
  buf[offset + 2] = (value >>> 8) & 0xff;
  buf[offset + 3] = value & 0xff;
}

// ============================================================
// Device Lock Crypto (IDA: sub_14095DFD0, sub_14095E300, sub_14095E550)
// ============================================================

/**
 * Derive a 16-byte key from device fullId string.
 * Short path (<16 chars): copy + XOR pad with XOR_SEED.
 * Long path (>=16 chars): XOR-fold 128-byte buffer into 16 bytes.
 */
function keyDerivation(inputString: string): Uint8Array | null {
  const src = new TextEncoder().encode(inputString);
  let length = src.length;
  if (length === 0) return null;
  if (length > 128) length = 128;

  const buf = new Uint8Array(128);
  buf.set(src.subarray(0, length));

  const output = new Uint8Array(16);
  if (length >= 16) {
    for (let i = 0; i < 16; i++) {
      let val = 0;
      for (let chunk = 0; chunk < 8; chunk++) {
        val ^= buf[chunk * 16 + i];
      }
      output[i] = val;
    }
  } else {
    for (let i = 0; i < length; i++) output[i] = src[i];
    for (let j = 0; j < 16 - length; j++) {
      output[length + j] = XOR_SEED[length + j] ^ src[j % length];
    }
  }
  return output;
}

/**
 * Expand 16-byte key to 24-byte 3DES key using XOR pairs.
 */
function keyExpansion(key16: Uint8Array): Uint8Array {
  const output = new Uint8Array(24);
  for (let r = 0; r < 3; r++) {
    for (let j = 0; j < 8; j++) {
      const idx1 = EXPANSION_TABLE[2 * j + r * 16];
      const idx2 = EXPANSION_TABLE[2 * j + 1 + r * 16];
      output[r * 8 + j] = key16[idx1] ^ key16[idx2];
    }
  }
  return output;
}

/**
 * 3DES-EDE-CBC encryption: E_K3(D_K2(E_K1(block))) per block.
 * @param data - Must be a multiple of 8 bytes
 * @param key24 - 24-byte key (3 × 8-byte DES keys, before parity)
 */
function tripleDesEncryptCBC(data: Uint8Array, key24: Uint8Array): Uint8Array {
  const k1 = msbParity(key24.slice(0, 8));
  const k2 = msbParity(key24.slice(8, 16));
  const k3 = msbParity(key24.slice(16, 24));

  const tripleKey = Buffer.concat([Buffer.from(k1), Buffer.from(k2), Buffer.from(k3)]);
  const iv = Buffer.alloc(8, 0);
  const cipher = createCipheriv('des-ede3-cbc', tripleKey, iv);
  cipher.setAutoPadding(false);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  return new Uint8Array(encrypted);
}

/**
 * Generate a device-locked CSEC (80 bytes encrypted).
 * Reverse-engineers the Key Verify math from IDA sub_14095E550.
 */
function generateLockedCSEC(fullId: string): Uint8Array {
  const keySlot = keyDerivation(fullId);
  if (!keySlot) throw new Error('Cannot generate device-locked CSEC: empty fullId');

  // Random first_data (16 bytes)
  const firstData = new Uint8Array(randomBytes(16));

  // second_data[j] = (keySlot[j] + firstData[15-j]) & 0xFF
  const secondData = new Uint8Array(16);
  for (let j = 0; j < 16; j++) {
    secondData[j] = (keySlot[j] + firstData[15 - j]) & 0xff;
  }

  // AIRI = DES_encrypt("dualseal", yamaha_pad(firstData)) → 24 bytes
  const firstDataPadded = addYamahaPadding(firstData);
  const airi = encryptDESCBC(firstDataPadded, msbParity(DES_KEY_DUALSEAL));

  // AIVF = 3DES_encrypt(expand(keySlot), secondData) → 16 bytes
  const key24 = keyExpansion(keySlot);
  const aivf = tripleDesEncryptCBC(secondData, key24);

  // Build CSEC: ABCF(0001) + ABEI(AIRI + AIVF)
  const abcf = buildChunk('ABCF', new Uint8Array([0x00, 0x01]));
  const airiChunk = buildChunk('AIRI', airi);
  const aivfChunk = buildChunk('AIVF', aivf);
  const abei = buildContainerChunk('ABEI', [airiChunk, aivfChunk]);
  const csecPlaintext = concatArrays([abcf, abei]);

  // DES encrypt with "Foatfkio" + Yamaha padding → 80 bytes
  const csecPadded = addYamahaPadding(csecPlaintext);
  return encryptDESCBC(csecPadded);
}

// ============================================================
// CPI Builder
// ============================================================

/**
 * Build an encrypted CPI file from parsed PPF data.
 *
 * @param fullId - Optional device fullId from N27; when provided, CPI is device-locked
 */
export function buildEncryptedCPI(
  packData: PPFData,
  modelName: string,
  packInstallId: number,
  selectedIndices?: number[],
  fullId?: string,
): Uint8Array {
  // 1. Build XPIH header (unencrypted) - matching Yamaha's original format
  const xmdlData = new TextEncoder().encode(modelName);
  const xmdlChunk = buildChunk('XMDL', xmdlData);

  // Yamaha pads XPIH content to 4-byte alignment between chunks
  const alignPad = (4 - (xmdlChunk.length % 4)) % 4;
  const padding = new Uint8Array(alignPad);

  const xpidData = new Uint8Array(4);
  writeUint32BE(xpidData, 0, packInstallId);
  const xpidChunk = buildChunk('XPID', xpidData);

  const xpihInner = new Uint8Array(xmdlChunk.length + alignPad + xpidChunk.length);
  let xpihPos = 0;
  xpihInner.set(xmdlChunk, xpihPos); xpihPos += xmdlChunk.length;
  xpihInner.set(padding, xpihPos); xpihPos += alignPad;
  xpihInner.set(xpidChunk, xpihPos);
  const xpihChunk = buildChunk('XPIH', xpihInner);

  // 2. CSEC — device-locked if fullId provided, otherwise standard
  const csecData = fullId ? generateLockedCSEC(fullId) : CSEC_ENCRYPTED_DATA;
  const csecChunk = buildChunk('CSEC', csecData);

  // 3. Build payload content (plaintext)
  const payloadParts: Uint8Array[] = [];
  payloadParts.push(buildTextChunk('EUID', packData.uid));
  payloadParts.push(buildTextChunk('ETIT', packData.title));

  const blobs = selectedIndices
    ? packData.blobs.filter((_, i) => selectedIndices.includes(i))
    : packData.blobs;

  for (const blob of blobs) {
    const blobParts: Uint8Array[] = [];
    blobParts.push(buildTextChunk('EUID', blob.uid));
    blobParts.push(buildTextChunk('ETIT', blob.title));
    blobParts.push(buildTextChunk('EEXT', blob.extension));
    if (blob.iconCode) {
      blobParts.push(buildTextChunk('EICO', blob.iconCode));
    }
    blobParts.push(buildChunk('FBIN', blob.binaryData));
    payloadParts.push(buildContainerChunk('BLOB', blobParts));
  }

  // Concatenate payload parts
  const totalPayloadSize = payloadParts.reduce((s, p) => s + p.length, 0);
  const payloadRaw = new Uint8Array(totalPayloadSize);
  let pos = 0;
  for (const part of payloadParts) {
    payloadRaw.set(part, pos);
    pos += part.length;
  }

  // 4. Pad and encrypt payload
  const payloadPadded = addYamahaPadding(payloadRaw);
  const payloadEncrypted = encryptDESCBC(payloadPadded);

  // 5. Assemble: XPIH + CSEC + encrypted payload
  const totalSize = xpihChunk.length + csecChunk.length + payloadEncrypted.length;
  const result = new Uint8Array(totalSize);
  let offset = 0;
  result.set(xpihChunk, offset);
  offset += xpihChunk.length;
  result.set(csecChunk, offset);
  offset += csecChunk.length;
  result.set(payloadEncrypted, offset);

  return result;
}
