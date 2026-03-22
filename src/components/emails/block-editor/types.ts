export interface HeadingBlock {
  type: "heading"
  id: string
  text: string
  layout?: "center" | "split"
  textLeft?: string
}

export interface BannerBlock {
  type: "banner"
  id: string
  text: string
  color: "orange" | "blue" | "red"
}

export type TextAlign = "right" | "center" | "left" | "justify"

export interface ParagraphBlock {
  type: "paragraph"
  id: string
  text: string
  align?: TextAlign
}

export interface FolderBlock {
  type: "folder"
  id: string
  name: string
  items: string[]
}

export interface ListBlock {
  type: "list"
  id: string
  items: string[]
  ordered: boolean
}

export interface ButtonsBlock {
  type: "buttons"
  id: string
  buttons: ButtonConfig[]
}

export interface ButtonConfig {
  label: string
  url: string
  color: "gold" | "green" | "red" | "blue"
}

export interface PromoBlock {
  type: "promo"
  id: string
  text: string
  price: string
  expiry: string
}

export interface BankTableBlock {
  type: "bankTable"
  id: string
}

export interface WarningBlock {
  type: "warning"
  id: string
  text: string
}

export interface SignatureBlock {
  type: "signature"
  id: string
}

export interface ImageBlock {
  type: "image"
  id: string
  url: string
  alt: string
}

export interface DividerBlock {
  type: "divider"
  id: string
}

export interface InstructionsBlock {
  type: "instructions"
  id: string
  text: string
}

export type EmailBlock =
  | HeadingBlock
  | BannerBlock
  | ParagraphBlock
  | FolderBlock
  | ListBlock
  | ButtonsBlock
  | PromoBlock
  | BankTableBlock
  | WarningBlock
  | SignatureBlock
  | ImageBlock
  | DividerBlock
  | InstructionsBlock

export const BLOCK_LABELS: Record<EmailBlock["type"], string> = {
  heading: "כותרת ראשית",
  banner: "באנר",
  paragraph: "פסקה",
  folder: "כותרת תיקייה + פריטים",
  list: "רשימה",
  buttons: "כפתורים",
  promo: "בלוק מבצע",
  bankTable: "טבלת פרטי בנק",
  warning: "אזהרה",
  signature: "חתימה",
  image: "תמונה",
  divider: "קו מפריד",
  instructions: "הוראות",
}

let blockCounter = 0
export function generateBlockId(): string {
  return `block_${Date.now()}_${++blockCounter}`
}

export function createDefaultBlock(type: EmailBlock["type"]): EmailBlock {
  const id = generateBlockId()

  switch (type) {
    case "heading":
      return { type, id, text: "" }
    case "banner":
      return { type, id, text: "מה חדש בעדכון?", color: "orange" }
    case "paragraph":
      return { type, id, text: "" }
    case "folder":
      return { type, id, name: "שם תיקייה", items: ["פריט ראשון"] }
    case "list":
      return { type, id, items: ["פריט ראשון"], ordered: false }
    case "buttons":
      return {
        type, id,
        buttons: [
          { label: "דגימות", url: "{{LINK_SAMPLES}}", color: "gold" },
          { label: "מקצבים", url: "{{LINK_STYLES}}", color: "gold" },
        ],
      }
    case "promo":
      return { type, id, text: "10% הנחה על כל העדכונים!", price: "", expiry: "" }
    case "bankTable":
      return { type, id }
    case "warning":
      return { type, id, text: "" }
    case "signature":
      return { type, id }
    case "image":
      return { type, id, url: "", alt: "" }
    case "divider":
      return { type, id }
    case "instructions":
      return { type, id, text: "" }
  }
}
