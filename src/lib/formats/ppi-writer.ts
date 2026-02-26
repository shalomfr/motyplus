/**
 * PPI/CPI writer.
 * Builds PPI (without XPIH header) or CPI (with XPIH header locked to a model).
 */

import { buildChunk, buildContainerChunk, buildTextChunk } from './chunk-reader';
import type { PPFData } from './ppi-parser';

export function buildPPI(
  packData: PPFData,
  modelName: string,
  packInstallId: number,
  selectedIndices?: number[],
  includeHeader = true,
): Uint8Array {
  const parts: Uint8Array[] = [];

  if (includeHeader && modelName) {
    const xmdlChunk = buildTextChunk('XMDL', modelName);
    const xpidData = new Uint8Array(4);
    xpidData[0] = (packInstallId >>> 24) & 0xff;
    xpidData[1] = (packInstallId >>> 16) & 0xff;
    xpidData[2] = (packInstallId >>> 8) & 0xff;
    xpidData[3] = packInstallId & 0xff;
    const xpidChunk = buildChunk('XPID', xpidData);
    const xpihChunk = buildContainerChunk('XPIH', [xmdlChunk, xpidChunk]);
    parts.push(xpihChunk);
  }

  parts.push(buildTextChunk('EUID', packData.uid));
  parts.push(buildTextChunk('ETIT', packData.title));

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
    parts.push(buildContainerChunk('BLOB', blobParts));
  }

  const totalSize = parts.reduce((sum, p) => sum + p.length, 0);
  const result = new Uint8Array(totalSize);
  let pos = 0;
  for (const part of parts) {
    result.set(part, pos);
    pos += part.length;
  }

  return result;
}
