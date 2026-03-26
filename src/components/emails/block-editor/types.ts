export type TextAlign = "right" | "center" | "left" | "justify"

export interface HeadingBlock {
  type: "heading"
  id: string
  text: string
  layout?: "center" | "split"
  textLeft?: string
}

export interface SubheadingBlock {
  type: "subheading"
  id: string
  text: string
  align?: TextAlign
}

export interface BannerBlock {
  type: "banner"
  id: string
  text: string
  color: "orange" | "blue" | "red"
}

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
  align?: "right" | "center" | "left"
}

export interface SubfolderBlock {
  type: "subfolder"
  id: string
  name: string
  items: string[]
  align?: "right" | "center" | "left"
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
  color: "gold" | "green" | "red" | "blue" | "orange" | "purple" | "teal" | "gray"
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
  align?: TextAlign
}

export interface SignatureBlock {
  type: "signature"
  id: string
}

export interface BrandBannerBlock {
  type: "brandBanner"
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
  align?: TextAlign
}

export type EmailBlock =
  | HeadingBlock
  | SubheadingBlock
  | BannerBlock
  | ParagraphBlock
  | FolderBlock
  | SubfolderBlock
  | ListBlock
  | ButtonsBlock
  | PromoBlock
  | BankTableBlock
  | WarningBlock
  | SignatureBlock
  | BrandBannerBlock
  | ImageBlock
  | DividerBlock
  | InstructionsBlock

export const BLOCK_LABELS: Record<EmailBlock["type"], string> = {
  heading: "כותרת ראשית",
  subheading: "כותרת משנה",
  banner: "באנר",
  paragraph: "פסקה",
  folder: "כותרת תיקייה + פריטים",
  subfolder: "תיקייה משנית + פריטים",
  list: "רשימה",
  buttons: "כפתורים",
  promo: "בלוק מבצע",
  bankTable: "טבלת פרטי בנק",
  warning: "אזהרה",
  signature: "חתימה",
  brandBanner: "באנר מיתוג",
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
    case "subheading":
      return { type, id, text: "", align: "right" }
    case "banner":
      return { type, id, text: "מה חדש בעדכון?", color: "orange" }
    case "paragraph":
      return { type, id, text: "" }
    case "folder":
      return { type, id, name: "שם תיקייה", items: ["פריט ראשון"], align: "right" }
    case "subfolder":
      return { type, id, name: "תיקייה משנית", items: ["פריט ראשון"], align: "right" }
    case "list":
      return { type, id, items: ["פריט ראשון"], ordered: false }
    case "buttons":
      return {
        type, id,
        buttons: [
          { label: "דגימות", url: "{{samplesLink}}", color: "gold" },
          { label: "מקצבים", url: "{{rhythmsLink}}", color: "gold" },
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
    case "brandBanner":
      return { type, id }
    case "image":
      return { type, id, url: "", alt: "" }
    case "divider":
      return { type, id }
    case "instructions":
      return { type, id, text: "" }
  }
}
