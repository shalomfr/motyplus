/**
 * Yamaha Pack chunk reader (browser version).
 * Uses Uint8Array/DataView instead of Node Buffer.
 */

export interface RawChunk {
  id: string;
  size: number;
  data: Uint8Array;
  offset: number;
}

const KNOWN_TAGS = new Set([
  'XPFH', 'XPIH', 'XMDL', 'XPID',
  'EUID', 'ETIT', 'BLOB', 'EEXT', 'EICO', 'FBIN',
  'CSEC',
]);

const textDecoder = new TextDecoder('ascii');
const utf8Decoder = new TextDecoder('utf-8');

function readFourCC(buf: Uint8Array, offset: number): string {
  return textDecoder.decode(buf.slice(offset, offset + 4));
}

function readUint32BE(buf: Uint8Array, offset: number): number {
  return ((buf[offset] << 24) | (buf[offset + 1] << 16) | (buf[offset + 2] << 8) | buf[offset + 3]) >>> 0;
}

function isKnownTag(buf: Uint8Array, pos: number): boolean {
  if (pos + 4 > buf.length) return false;
  const tag = readFourCC(buf, pos);
  return KNOWN_TAGS.has(tag);
}

function skipToNextTag(buf: Uint8Array, pos: number, end: number): number {
  while (pos < end) {
    if (isKnownTag(buf, pos)) return pos;
    pos++;
  }
  return pos;
}

export function readChunks(buf: Uint8Array, startOffset: number, endOffset?: number): RawChunk[] {
  const end = endOffset ?? buf.length;
  const chunks: RawChunk[] = [];
  let pos = startOffset;

  while (pos + 8 <= end) {
    pos = skipToNextTag(buf, pos, end);
    if (pos + 8 > end) break;

    const id = readFourCC(buf, pos);
    if (!KNOWN_TAGS.has(id)) break;

    const size = readUint32BE(buf, pos + 4);
    const dataStart = pos + 8;
    const dataEnd = Math.min(dataStart + size, end);
    const data = buf.slice(dataStart, dataEnd);

    chunks.push({ id, size, data, offset: pos });
    pos = dataEnd;
  }

  return chunks;
}

export function readSubChunks(chunk: RawChunk): RawChunk[] {
  return readChunks(chunk.data, 0);
}

export function chunkText(chunk: RawChunk): string {
  return utf8Decoder.decode(chunk.data).replace(/\x00/g, '');
}

// --- Builder functions ---

export function concatArrays(arrays: Uint8Array[]): Uint8Array {
  const totalLen = arrays.reduce((s, a) => s + a.length, 0);
  const result = new Uint8Array(totalLen);
  let pos = 0;
  for (const a of arrays) {
    result.set(a, pos);
    pos += a.length;
  }
  return result;
}

function writeUint32BE(buf: Uint8Array, offset: number, value: number): void {
  buf[offset] = (value >>> 24) & 0xff;
  buf[offset + 1] = (value >>> 16) & 0xff;
  buf[offset + 2] = (value >>> 8) & 0xff;
  buf[offset + 3] = value & 0xff;
}

const textEncoder = new TextEncoder();

export function buildChunk(id: string, data: Uint8Array): Uint8Array {
  const buf = new Uint8Array(8 + data.length);
  const tagBytes = textEncoder.encode(id);
  buf.set(tagBytes.slice(0, 4), 0);
  writeUint32BE(buf, 4, data.length);
  buf.set(data, 8);
  return buf;
}

export function buildContainerChunk(id: string, subChunks: Uint8Array[]): Uint8Array {
  const inner = concatArrays(subChunks);
  return buildChunk(id, inner);
}

export function buildTextChunk(id: string, text: string): Uint8Array {
  const strBytes = textEncoder.encode(text + '\0');
  return buildChunk(id, strBytes);
}
