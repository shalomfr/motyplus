import { prisma } from "@/lib/prisma";

/**
 * File storage using PostgreSQL (replaces Azure Blob Storage)
 * All files stored in FileStorage table as binary data
 */

export async function uploadFile(
  buffer: Buffer,
  filename: string,
  folder: string
): Promise<string> {
  const path = `${folder}/${filename}`;
  const data = new Uint8Array(buffer);
  await prisma.fileStorage.upsert({
    where: { path },
    update: { data, size: buffer.length, updatedAt: new Date() },
    create: { path, data, size: buffer.length },
  });
  return path;
}

export async function uploadFileWithPath(
  buffer: Buffer,
  blobPath: string
): Promise<string> {
  const data = new Uint8Array(buffer);
  await prisma.fileStorage.upsert({
    where: { path: blobPath },
    update: { data, size: buffer.length, updatedAt: new Date() },
    create: { path: blobPath, data, size: buffer.length },
  });
  return blobPath;
}

export async function downloadFile(pathOrUrl: string): Promise<Buffer> {
  // Support both old Azure URLs and new paths
  const path = pathOrUrl.includes("/files/")
    ? pathOrUrl.split("/files/").slice(1).join("/files/")
    : pathOrUrl;

  const file = await prisma.fileStorage.findUnique({ where: { path } });
  if (!file) throw new Error(`File not found: ${path}`);
  return Buffer.from(file.data);
}

export async function deleteFile(pathOrUrl: string): Promise<void> {
  try {
    const path = pathOrUrl.includes("/files/")
      ? pathOrUrl.split("/files/").slice(1).join("/files/")
      : pathOrUrl;
    await prisma.fileStorage.delete({ where: { path } });
  } catch {
    // ignore delete errors
  }
}

export async function deleteFilesWithPrefix(prefix: string): Promise<number> {
  const result = await prisma.fileStorage.deleteMany({
    where: { path: { startsWith: prefix } },
  });
  return result.count;
}

export async function listFiles(prefix: string): Promise<{ path: string; size: number }[]> {
  return prisma.fileStorage.findMany({
    where: { path: { startsWith: prefix } },
    select: { path: true, size: true },
  });
}
