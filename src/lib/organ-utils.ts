/**
 * Normalize organ name: "PSR-SX920" → "Psr-SX920"
 * Applies to all organ names starting with "PSR" (case-insensitive)
 */
export function normalizeOrganName(name: string): string {
  return name.replace(/^PSR\b/i, "Psr");
}
