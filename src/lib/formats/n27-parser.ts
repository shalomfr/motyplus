/**
 * N27 (Instrument Info) parser.
 * Extracts instrument model name from .n27 binary files.
 */

export interface InstrumentInfo {
  name: string;
  fileName: string;
  serial: string;
  fullId: string;
  waveCapacity: number;
  paramCapacity: number;
}

function readNullTerminatedString(buf: Uint8Array, offset: number, maxLen: number): string {
  let end = offset;
  while (end < offset + maxLen && buf[end] !== 0) end++;
  return new TextDecoder('ascii').decode(buf.slice(offset, end));
}

function readUint32BE(buf: Uint8Array, offset: number): number {
  return ((buf[offset] << 24) | (buf[offset + 1] << 16) | (buf[offset + 2] << 8) | buf[offset + 3]) >>> 0;
}

export function parseN27(buf: Uint8Array, fileName: string): InstrumentInfo {
  const name = readNullTerminatedString(buf, 0, 64);
  const serial = buf.length >= 88 ? readNullTerminatedString(buf, 64, 24) : '';
  const fullId = buf.length >= 120 ? readNullTerminatedString(buf, 88, 32) : '';

  let waveCapacity = 0;
  let paramCapacity = 0;

  if (buf.length >= 0x84) {
    const waveUnits = readUint32BE(buf, 0x78);
    const paramUnits = readUint32BE(buf, 0x80);
    waveCapacity = waveUnits * 1024;
    paramCapacity = paramUnits * 1024;
  }

  return { name, fileName, serial, fullId, waveCapacity, paramCapacity };
}
