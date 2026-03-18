/**
 * Cross-validation test: verify server-side crypto matches Python reference.
 * Run: node test-device-lock.mjs
 */

// We can't easily import TypeScript directly, so we test the logic inline
// matching the exact same constants and algorithms from cpi-encryptor.ts.
// This validates the algorithm, not the import — the TypeScript check validates the imports.

import DESModule from 'des.js';
import { createCipheriv } from 'crypto';

const XOR_SEED = new Uint8Array([
  0x0f, 0x62, 0xbe, 0x39, 0xd1, 0x70, 0xc7, 0xf4,
  0x1a, 0x85, 0x2d, 0x5c, 0x96, 0xe8, 0x4b, 0xa3,
]);

const EXPANSION_TABLE = [
  0x07, 0x0c, 0x0e, 0x0a, 0x0b, 0x0d, 0x00, 0x01,
  0x06, 0x02, 0x0f, 0x03, 0x09, 0x04, 0x08, 0x05,
  0x00, 0x0f, 0x02, 0x08, 0x06, 0x09, 0x01, 0x0a,
  0x0e, 0x0c, 0x0b, 0x03, 0x04, 0x05, 0x07, 0x0d,
  0x07, 0x05, 0x0c, 0x04, 0x0f, 0x0d, 0x01, 0x09,
  0x08, 0x0a, 0x00, 0x03, 0x0b, 0x06, 0x0e, 0x02,
];

function msbParity(keyBytes) {
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

function keyDerivation(inputString) {
  const src = Buffer.from(inputString, 'ascii');
  let length = src.length;
  if (length === 0) return null;
  if (length > 128) length = 128;
  const buf = new Uint8Array(128);
  buf.set(src.subarray(0, length));
  const output = new Uint8Array(16);
  if (length >= 16) {
    for (let i = 0; i < 16; i++) {
      let val = 0;
      for (let chunk = 0; chunk < 8; chunk++) val ^= buf[chunk * 16 + i];
      output[i] = val;
    }
  } else {
    for (let i = 0; i < length; i++) output[i] = src[i];
    for (let j = 0; j < 16 - length; j++) output[length + j] = XOR_SEED[length + j] ^ src[j % length];
  }
  return output;
}

function keyExpansion(key16) {
  const output = new Uint8Array(24);
  for (let r = 0; r < 3; r++) {
    for (let j = 0; j < 8; j++) {
      output[r * 8 + j] = key16[EXPANSION_TABLE[2 * j + r * 16]] ^ key16[EXPANSION_TABLE[2 * j + 1 + r * 16]];
    }
  }
  return output;
}

function addYamahaPadding(data) {
  const remainder = data.length % 8;
  const padLen = remainder === 0 ? 8 : 8 - remainder;
  const padded = new Uint8Array(data.length + padLen);
  padded.set(data, 0);
  padded[padded.length - 1] = remainder;
  return padded;
}

function encryptDESCBC(data, key) {
  const des = new DESModule.DES({ type: 'encrypt', key });
  const encrypted = new Uint8Array(data.length);
  const prev = new Uint8Array(8);
  for (let i = 0; i < data.length; i += 8) {
    const xored = new Uint8Array(8);
    for (let j = 0; j < 8; j++) xored[j] = data[i + j] ^ prev[j];
    const enc = new Uint8Array(des.update(Array.from(xored)));
    encrypted.set(enc, i);
    prev.set(enc);
  }
  return encrypted;
}

function tripleDesEncryptCBC(data, key24) {
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

// === Tests ===

// Test 1: keyDerivation
const kd1 = keyDerivation('3339_F83B3806273');
const kd2 = keyDerivation('test');
console.log('Test 1: keyDerivation (long)');
console.log('  Output:', Buffer.from(kd1).toString('hex'));
console.log('  Expected: 333333395f4638334233383036323733');
console.log('  Match:', Buffer.from(kd1).toString('hex') === '333333395f4638334233383036323733' ? 'OK' : 'FAIL');

console.log('\nTest 2: keyDerivation (short)');
console.log('  Output:', Buffer.from(kd2).toString('hex'));
console.log('  Expected: 74657374a515b4806ee05e28e28d38d7');
console.log('  Match:', Buffer.from(kd2).toString('hex') === '74657374a515b4806ee05e28e28d38d7' ? 'OK' : 'FAIL');

// Test 3: keyExpansion
const ke1 = keyExpansion(kd1);
console.log('\nTest 3: keyExpansion');
console.log('  Output:', Buffer.from(ke1).toString('hex'));
console.log('  Expected: 050f02000b0a6c0400710b0b01091901756901007a0a0804');
console.log('  Match:', Buffer.from(ke1).toString('hex') === '050f02000b0a6c0400710b0b01091901756901007a0a0804' ? 'OK' : 'FAIL');

// Test 4: Full CSEC generation with fixed first_data
const DES_KEY_DUALSEAL = [0x64, 0x75, 0x61, 0x6c, 0x73, 0x65, 0x61, 0x6c];
const DES_KEY_RAW = [0x46, 0x6f, 0x61, 0x74, 0x66, 0x6b, 0x69, 0x6f];

const keySlot = keyDerivation('3339_F83B3806273');
const firstData = new Uint8Array(16);
for (let i = 0; i < 16; i++) firstData[i] = i;

const secondData = new Uint8Array(16);
for (let j = 0; j < 16; j++) secondData[j] = (keySlot[j] + firstData[15 - j]) & 0xff;

const firstDataPadded = addYamahaPadding(firstData);
const airi = encryptDESCBC(firstDataPadded, msbParity(DES_KEY_DUALSEAL));
const key24 = keyExpansion(keySlot);
const aivf = tripleDesEncryptCBC(secondData, key24);

// Build CSEC plaintext
function buildChunkRaw(tag, data) {
  const buf = new Uint8Array(8 + data.length);
  const tagBytes = Buffer.from(tag, 'ascii');
  buf.set(tagBytes, 0);
  buf[4] = (data.length >>> 24) & 0xff;
  buf[5] = (data.length >>> 16) & 0xff;
  buf[6] = (data.length >>> 8) & 0xff;
  buf[7] = data.length & 0xff;
  buf.set(data, 8);
  return buf;
}

const abcf = buildChunkRaw('ABCF', new Uint8Array([0x00, 0x01]));
const airiChunk = buildChunkRaw('AIRI', airi);
const aivfChunk = buildChunkRaw('AIVF', aivf);
const abeiInner = new Uint8Array(airiChunk.length + aivfChunk.length);
abeiInner.set(airiChunk, 0);
abeiInner.set(aivfChunk, airiChunk.length);
const abei = buildChunkRaw('ABEI', abeiInner);
const csecPlain = new Uint8Array(abcf.length + abei.length);
csecPlain.set(abcf, 0);
csecPlain.set(abei, abcf.length);

const csecPadded = addYamahaPadding(csecPlain);
const csecEnc = encryptDESCBC(csecPadded, msbParity(DES_KEY_RAW));

const expectedCsec = '5a517c405f447c02903bcc5e1d69dcf8522fe875d0ed7f97424785ba7ea0d14a7002c5ff773547d8d7976ecdb236044d633e86b0924686a1a53ece088414de6b02d34f44885a9c85c6eeeb8cd73900a9';

console.log('\nTest 4: Full CSEC with fixed first_data (des.js)');
console.log('  Output:', Buffer.from(csecEnc).toString('hex'));
console.log('  Expected:', expectedCsec);
console.log('  Match:', Buffer.from(csecEnc).toString('hex') === expectedCsec ? 'OK' : 'FAIL');
console.log('  Length:', csecEnc.length, csecEnc.length === 80 ? 'OK' : 'FAIL');

console.log('\nAll tests complete.');
