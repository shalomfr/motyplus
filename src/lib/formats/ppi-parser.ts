/**
 * PPF (Pack Project File) parser.
 * PPF files start with 8 bytes header before chunks (offset 8).
 */

import { readChunks, readSubChunks, chunkText } from './chunk-reader';

export interface PPFBlobEntry {
  uid: string;
  title: string;
  extension: string;
  iconCode?: string;
  binaryData: Uint8Array;
}

export interface PPFData {
  uid: string;
  title: string;
  blobs: PPFBlobEntry[];
}

/**
 * Parse a PPF file buffer.
 * PPF starts at offset 8 (has 8-byte XPFH header before chunks).
 */
export function parsePPFRaw(buf: Uint8Array): PPFData {
  const chunks = readChunks(buf, 8); // offset 8 for PPF
  let uid = '';
  let title = '';
  const blobs: PPFBlobEntry[] = [];

  for (const chunk of chunks) {
    if (chunk.id === 'XPIH') continue; // skip CPI header if present
    if (chunk.id === 'EUID' && !uid) {
      uid = chunkText(chunk);
    } else if (chunk.id === 'ETIT' && !title) {
      title = chunkText(chunk);
    } else if (chunk.id === 'BLOB') {
      const sub = readSubChunks(chunk);
      const entry: PPFBlobEntry = {
        uid: '', title: '', extension: '', binaryData: new Uint8Array(0),
      };
      for (const s of sub) {
        switch (s.id) {
          case 'EUID': entry.uid = chunkText(s); break;
          case 'ETIT': entry.title = chunkText(s); break;
          case 'EEXT': entry.extension = chunkText(s); break;
          case 'EICO': entry.iconCode = chunkText(s); break;
          case 'FBIN': entry.binaryData = s.data; break;
        }
      }
      blobs.push(entry);
    }
  }

  return { uid, title, blobs };
}
