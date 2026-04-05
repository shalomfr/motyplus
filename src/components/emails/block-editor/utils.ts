import { generateBlockId } from "./types"
import type { EmailBlock } from "./types"

export function cloneBlockWithNewId(block: EmailBlock): EmailBlock {
  return { ...JSON.parse(JSON.stringify(block)), id: generateBlockId() }
}
