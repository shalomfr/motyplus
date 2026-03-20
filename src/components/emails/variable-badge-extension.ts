import { Node, mergeAttributes } from "@tiptap/core"
import { ReactNodeViewRenderer } from "@tiptap/react"

// משתנים זמינים עם תוויות עבריות
export const EMAIL_VARIABLES = [
  { name: "fullName", label: "שם מלא" },
  { name: "firstName", label: "שם פרטי" },
  { name: "email", label: "מייל" },
  { name: "phone", label: "טלפון" },
  { name: "organ", label: "אורגן" },
  { name: "setType", label: "סוג סט" },
  { name: "purchaseDate", label: "תאריך רכישה" },
  { name: "updateExpiryDate", label: "תפוגת עדכון" },
  { name: "currentVersion", label: "גרסה נוכחית" },
  { name: "updateVersion", label: "גרסת עדכון" },
  { name: "releaseDate", label: "תאריך שחרור" },
  { name: "amountPaid", label: "סכום ששולם" },
  { name: "remainingAmount", label: "יתרה לתשלום" },
  { name: "remainingForFullSet", label: "יתרה להשלמת סט" },
  { name: "samplesLink", label: "קישור דגימות" },
  { name: "rhythmsLink", label: "קישור מקצבים" },
  { name: "driveLink", label: "קישור דרייב" },
  { name: "youtubeLink", label: "קישור יוטיוב" },
  { name: "customLink", label: "קישור חריג" },
]

export const VariableBadge = Node.create({
  name: "variableBadge",
  group: "inline",
  inline: true,
  atom: true,

  addAttributes() {
    return {
      varName: { default: "" },
      label: { default: "" },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-var]',
        getAttrs: (el) => {
          const element = el as HTMLElement
          return {
            varName: element.getAttribute("data-var"),
            label: element.textContent,
          }
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    const varName = HTMLAttributes.varName || ""
    const label = HTMLAttributes.label || varName
    return [
      "span",
      mergeAttributes({
        "data-var": varName,
        style: "background:#fff3e0;color:#e65100;padding:2px 10px;border-radius:12px;font-weight:600;font-size:13px;display:inline-block;margin:0 2px;",
      }),
      label,
    ]
  },
})
