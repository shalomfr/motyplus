import JSZip from "jszip";
import { prisma } from "@/lib/prisma";
import { uploadFileWithPath } from "@/lib/azure-storage";

interface MatchResult {
  setTypeId: string;
  setTypeName: string;
  organId: string;
  organName: string;
  fileUrl: string;
  fileSize: number;
  originalPath: string;
}

interface ProcessResult {
  matched: MatchResult[];
  unmatchedFolders: string[];
  totalFiles: number;
}

/**
 * Process a master ZIP file for an update version.
 *
 * Expected ZIP structure:
 *   SetTypeFolder/
 *     OrganFolder/
 *       ... files ...
 *
 * Each SetType and Organ is matched by folderAlias or name.
 * For each matched combination, a sub-ZIP is created and uploaded.
 */
export async function processUpdateZip(
  zipBuffer: Buffer,
  updateVersionId: string
): Promise<ProcessResult> {
  const zip = await JSZip.loadAsync(zipBuffer);

  // Load set types and organs from DB
  const setTypes = await prisma.setType.findMany({
    where: { isActive: true },
  });
  const organs = await prisma.organ.findMany({
    where: { supportsUpdates: true, isActive: true },
  });

  // Build lookup maps: lowercase alias/name → entity
  const setTypeMap = new Map<string, typeof setTypes[0]>();
  for (const st of setTypes) {
    setTypeMap.set(st.name.toLowerCase(), st);
    if (st.folderAlias) {
      setTypeMap.set(st.folderAlias.toLowerCase(), st);
    }
  }

  const organMap = new Map<string, typeof organs[0]>();
  for (const org of organs) {
    organMap.set(org.name.toLowerCase(), org);
    if (org.folderAlias) {
      organMap.set(org.folderAlias.toLowerCase(), org);
    }
  }

  // Analyze ZIP structure: find top-level folders (set types)
  const topLevelFolders = new Set<string>();
  zip.forEach((relativePath) => {
    const parts = relativePath.split("/").filter(Boolean);
    if (parts.length >= 1) {
      topLevelFolders.add(parts[0]);
    }
  });

  const matched: MatchResult[] = [];
  const unmatchedFolders: string[] = [];
  let totalFiles = 0;

  for (const topFolder of topLevelFolders) {
    const setType = setTypeMap.get(topFolder.toLowerCase());
    if (!setType) {
      unmatchedFolders.push(topFolder);
      continue;
    }

    // Find second-level folders (organs) under this set type
    const secondLevelFolders = new Set<string>();
    zip.forEach((relativePath) => {
      const parts = relativePath.split("/").filter(Boolean);
      if (parts.length >= 2 && parts[0] === topFolder) {
        secondLevelFolders.add(parts[1]);
      }
    });

    for (const organFolder of secondLevelFolders) {
      const organ = organMap.get(organFolder.toLowerCase());
      if (!organ) {
        unmatchedFolders.push(`${topFolder}/${organFolder}`);
        continue;
      }

      // Collect all files under this set type / organ path
      const subZip = new JSZip();
      const prefix = `${topFolder}/${organFolder}/`;
      let fileCount = 0;

      zip.forEach((relativePath, file) => {
        if (relativePath.startsWith(prefix) && !file.dir) {
          // Strip the prefix, keep internal structure
          const innerPath = relativePath.slice(prefix.length);
          if (innerPath) {
            subZip.file(innerPath, file.async("arraybuffer"));
            fileCount++;
          }
        }
      });

      if (fileCount === 0) continue;
      totalFiles += fileCount;

      // Generate sub-ZIP
      const subZipBuffer = await subZip.generateAsync({
        type: "nodebuffer",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
      });

      // Upload to Azure
      const blobPath = `updates/${updateVersionId}/${setType.id}_${organ.id}.zip`;
      const fileUrl = await uploadFileWithPath(subZipBuffer, blobPath);

      matched.push({
        setTypeId: setType.id,
        setTypeName: setType.name,
        organId: organ.id,
        organName: organ.name,
        fileUrl,
        fileSize: subZipBuffer.length,
        originalPath: `${topFolder}/${organFolder}`,
      });
    }
  }

  // Upsert UpdateFile records in the database
  for (const m of matched) {
    await prisma.updateFile.upsert({
      where: {
        updateVersionId_setTypeId_organId: {
          updateVersionId,
          setTypeId: m.setTypeId,
          organId: m.organId,
        },
      },
      update: {
        fileUrl: m.fileUrl,
        fileSize: m.fileSize,
        originalPath: m.originalPath,
      },
      create: {
        updateVersionId,
        setTypeId: m.setTypeId,
        organId: m.organId,
        fileUrl: m.fileUrl,
        fileSize: m.fileSize,
        originalPath: m.originalPath,
      },
    });
  }

  return { matched, unmatchedFolders, totalFiles };
}
