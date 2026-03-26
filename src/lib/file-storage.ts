import { getDrive, getRootFolderId } from "@/lib/google-drive";
import { Readable } from "stream";

/**
 * File storage using Google Drive
 * Replaces PostgreSQL FileStorage - same function signatures
 */

// In-memory cache: path segment → Drive folder ID
const folderCache = new Map<string, string>();

// Escape single quotes for Google Drive API queries
function escapeDriveQuery(name: string): string {
  return name.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

// === Internal helpers ===

export async function ensureFolderPath(folderPath: string): Promise<string> {
  if (folderCache.has(folderPath)) return folderCache.get(folderPath)!;

  const drive = getDrive();
  const parts = folderPath.split("/").filter(Boolean);
  let parentId = getRootFolderId();

  let currentPath = "";
  for (const part of parts) {
    currentPath = currentPath ? `${currentPath}/${part}` : part;

    if (folderCache.has(currentPath)) {
      parentId = folderCache.get(currentPath)!;
      continue;
    }

    // Search for existing folder
    const res = await drive.files.list({
      q: `name='${escapeDriveQuery(part)}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: "files(id)",
      spaces: "drive",
    });

    if (res.data.files && res.data.files.length > 0) {
      parentId = res.data.files[0].id!;
    } else {
      // Create folder
      const created = await drive.files.create({
        requestBody: {
          name: part,
          mimeType: "application/vnd.google-apps.folder",
          parents: [parentId],
        },
        fields: "id",
      });
      parentId = created.data.id!;
    }

    folderCache.set(currentPath, parentId);
  }

  return parentId;
}

async function resolveFileId(path: string): Promise<string | null> {
  const drive = getDrive();
  const parts = path.split("/");
  const filename = parts.pop()!;
  const folderPath = parts.join("/");

  const folderId = folderPath ? await ensureFolderPath(folderPath) : getRootFolderId();

  const res = await drive.files.list({
    q: `name='${escapeDriveQuery(filename)}' and '${folderId}' in parents and trashed=false`,
    fields: "files(id)",
    spaces: "drive",
  });

  return res.data.files?.[0]?.id || null;
}

function bufferToStream(buffer: Buffer): Readable {
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);
  return stream;
}

// === Public API (same signatures as before) ===

export async function uploadFile(
  buffer: Buffer,
  filename: string,
  folder: string
): Promise<string> {
  const path = `${folder}/${filename}`;
  const drive = getDrive();
  const folderId = await ensureFolderPath(folder);

  // Check if file already exists (upsert)
  const existing = await drive.files.list({
    q: `name='${escapeDriveQuery(filename)}' and '${folderId}' in parents and trashed=false`,
    fields: "files(id)",
    spaces: "drive",
  });

  if (existing.data.files && existing.data.files.length > 0) {
    // Update existing file
    await drive.files.update({
      fileId: existing.data.files[0].id!,
      media: { body: bufferToStream(buffer) },
    });
  } else {
    // Create new file
    await drive.files.create({
      requestBody: {
        name: filename,
        parents: [folderId],
      },
      media: { body: bufferToStream(buffer) },
      fields: "id",
    });
  }

  return path;
}

export async function uploadFileWithPath(
  buffer: Buffer,
  blobPath: string
): Promise<string> {
  const parts = blobPath.split("/");
  const filename = parts.pop()!;
  const folder = parts.join("/");
  return uploadFile(buffer, filename, folder);
}

export async function downloadFile(pathOrUrl: string): Promise<Buffer> {
  const path = pathOrUrl.includes("/files/")
    ? pathOrUrl.split("/files/").slice(1).join("/files/")
    : pathOrUrl;

  const fileId = await resolveFileId(path);
  if (!fileId) throw new Error(`File not found: ${path}`);

  const drive = getDrive();
  const res = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "arraybuffer" }
  );

  return Buffer.from(res.data as ArrayBuffer);
}

export async function deleteFile(pathOrUrl: string): Promise<void> {
  try {
    const path = pathOrUrl.includes("/files/")
      ? pathOrUrl.split("/files/").slice(1).join("/files/")
      : pathOrUrl;

    const fileId = await resolveFileId(path);
    if (fileId) {
      const drive = getDrive();
      await drive.files.delete({ fileId });
    }
  } catch {
    // ignore delete errors
  }
}

export async function deleteFilesWithPrefix(prefix: string): Promise<number> {
  const drive = getDrive();
  const folderId = await ensureFolderPath(prefix).catch(() => null);
  if (!folderId) return 0;

  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed=false`,
    fields: "files(id)",
    spaces: "drive",
  });

  let deleted = 0;
  for (const file of res.data.files || []) {
    await drive.files.delete({ fileId: file.id! });
    deleted++;
  }
  return deleted;
}

export async function deleteFolder(folderPath: string): Promise<void> {
  const drive = getDrive();
  const folderId = await ensureFolderPath(folderPath).catch(() => null);
  if (!folderId) return;

  // Delete all contents first, then the folder itself
  await deleteFilesWithPrefix(folderPath);
  await drive.files.delete({ fileId: folderId });
  folderCache.delete(folderPath);
}

export async function listFiles(prefix: string): Promise<{ path: string; size: number }[]> {
  const drive = getDrive();
  const folderId = await ensureFolderPath(prefix).catch(() => null);
  if (!folderId) return [];

  const res = await drive.files.list({
    q: `'${folderId}' in parents and mimeType!='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(name, size)",
    spaces: "drive",
  });

  return (res.data.files || []).map((f) => ({
    path: `${prefix}/${f.name}`,
    size: parseInt(f.size || "0"),
  }));
}

// === Sharing & Permissions ===

export async function shareFile(
  path: string,
  _email: string,
  _role: "reader" | "writer" = "reader"
): Promise<string> {
  const fileId = await resolveFileId(path);
  if (!fileId) throw new Error(`File not found: ${path}`);

  const drive = getDrive();

  // שיתוף עם "כל מי שיש לו את הלינק" — עובד לכל סוגי מייל (לא רק Gmail)
  await drive.permissions.create({
    fileId,
    requestBody: {
      type: "anyone",
      role: "reader",
    },
  });

  const file = await drive.files.get({ fileId, fields: "webContentLink, webViewLink" });
  // webContentLink = הורדה ישירה, webViewLink = צפייה בדרייב
  return file.data.webContentLink || file.data.webViewLink || "";
}

export async function getShareableLink(path: string): Promise<string> {
  const fileId = await resolveFileId(path);
  if (!fileId) throw new Error(`File not found: ${path}`);

  const drive = getDrive();

  // Make file accessible to anyone with the link
  await drive.permissions.create({
    fileId,
    requestBody: {
      type: "anyone",
      role: "reader",
    },
  });

  const file = await drive.files.get({ fileId, fields: "webViewLink, webContentLink" });
  // webContentLink = direct download link
  return file.data.webContentLink || file.data.webViewLink || "";
}

export async function revokeAccess(path: string, email: string): Promise<void> {
  const fileId = await resolveFileId(path);
  if (!fileId) return;

  const drive = getDrive();
  const perms = await drive.permissions.list({ fileId, fields: "permissions(id, emailAddress)" });

  for (const perm of perms.data.permissions || []) {
    if (perm.emailAddress === email) {
      await drive.permissions.delete({ fileId, permissionId: perm.id! });
    }
  }
}

export async function revokeAllAccess(path: string): Promise<void> {
  const fileId = await resolveFileId(path);
  if (!fileId) return;

  const drive = getDrive();
  const perms = await drive.permissions.list({ fileId, fields: "permissions(id, role, type)" });

  for (const perm of perms.data.permissions || []) {
    // Don't revoke owner permission
    if (perm.role !== "owner") {
      try {
        await drive.permissions.delete({ fileId, permissionId: perm.id! });
      } catch {
        // ignore
      }
    }
  }
}
