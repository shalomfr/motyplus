/**
 * Shared utility for parsing and building CPI filenames.
 *
 * Naming convention:
 *   Main file:       {customerId}.cpi           or  {customerId}_{version}.cpi
 *   Additional organ: {customerId}_{organSuffix}.cpi  or  {customerId}_{organSuffix}_{version}.cpi
 *
 * Version pattern: V followed by digits (and optional dot-digits), e.g. V3, V5, V5.1
 */

const VERSION_RE = /^V\d+(\.\d+)?$/i

export interface ParsedCpiFilename {
  customerId: number | null
  isAdditional: boolean
  version: string | null       // e.g. "V5", null if no version in name
  organSuffix: string | null   // e.g. "02" for additional organ
}

/**
 * Parse a CPI filename (without folder path) into its components.
 * Examples:
 *   "61908.cpi"        → { customerId: 61908, isAdditional: false, version: null,  organSuffix: null }
 *   "61908_V5.cpi"     → { customerId: 61908, isAdditional: false, version: "V5",  organSuffix: null }
 *   "32_02.cpi"        → { customerId: 32,    isAdditional: true,  version: null,  organSuffix: "02" }
 *   "32_02_V5.cpi"     → { customerId: 32,    isAdditional: true,  version: "V5",  organSuffix: "02" }
 */
export function parseCpiFilename(filename: string): ParsedCpiFilename {
  const baseName = filename.replace(/\.cpi$/i, "")
  const parts = baseName.split("_")

  // Check if the last part is a version
  let version: string | null = null
  if (parts.length > 1 && VERSION_RE.test(parts[parts.length - 1])) {
    version = parts.pop()!.toUpperCase()
  }

  const customerId = parseInt(parts[0])
  const isAdditional = parts.length > 1
  const organSuffix = isAdditional ? parts.slice(1).join("_") : null

  return {
    customerId: isNaN(customerId) ? null : customerId,
    isAdditional,
    version,
    organSuffix,
  }
}

/**
 * Build a CPI filename from components.
 */
export function buildCpiFilename(
  customerId: number,
  opts?: { organSuffix?: string | null; version?: string | null }
): string {
  let name = String(customerId)
  if (opts?.organSuffix) name += `_${opts.organSuffix}`
  if (opts?.version) name += `_${opts.version.toUpperCase()}`
  return `${name}.cpi`
}

/**
 * Given a filename and a target version, return the new filename with version added/replaced.
 * Returns null if the file already has the correct version (no rename needed).
 */
export function addVersionToFilename(filename: string, version: string): string | null {
  const parsed = parseCpiFilename(filename)
  const upperVersion = version.toUpperCase()

  // Already has the correct version
  if (parsed.version === upperVersion) return null

  if (parsed.customerId === null) return null

  const newName = buildCpiFilename(parsed.customerId, {
    organSuffix: parsed.organSuffix,
    version: upperVersion,
  })

  return newName
}
