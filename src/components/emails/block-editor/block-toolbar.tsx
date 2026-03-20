"use client"

import { Button } from "@/components/ui/button"
import {
  Heading1, MessageSquare, Type, FolderOpen, List, MousePointer2,
  Percent, Building2, AlertTriangle, PenLine, ImageIcon, Minus, BookOpen, Plus,
} from "lucide-react"
import type { EmailBlock } from "./types"

interface BlockToolbarProps {
  onAdd: (type: EmailBlock["type"]) => void
}

const BLOCK_OPTIONS: Array<{ type: EmailBlock["type"]; label: string; icon: typeof Heading1 }> = [
  { type: "heading", label: "כותרת", icon: Heading1 },
  { type: "banner", label: "באנר", icon: MessageSquare },
  { type: "paragraph", label: "פסקה", icon: Type },
  { type: "folder", label: "תיקייה", icon: FolderOpen },
  { type: "list", label: "רשימה", icon: List },
  { type: "instructions", label: "הוראות", icon: BookOpen },
  { type: "buttons", label: "כפתורים", icon: MousePointer2 },
  { type: "promo", label: "מבצע", icon: Percent },
  { type: "bankTable", label: "טבלת בנק", icon: Building2 },
  { type: "warning", label: "אזהרה", icon: AlertTriangle },
  { type: "signature", label: "חתימה", icon: PenLine },
  { type: "image", label: "תמונה", icon: ImageIcon },
  { type: "divider", label: "מפריד", icon: Minus },
]

export function BlockToolbar({ onAdd }: BlockToolbarProps) {
  return (
    <div className="flex flex-wrap gap-1.5 p-3 bg-muted/30 border-b">
      <span className="text-xs text-muted-foreground self-center ml-1 flex items-center gap-1">
        <Plus className="h-3 w-3" />
        הוסף:
      </span>
      {BLOCK_OPTIONS.map(({ type, label, icon: Icon }) => (
        <Button
          key={type}
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1 px-2"
          onClick={() => onAdd(type)}
        >
          <Icon className="h-3 w-3" />
          {label}
        </Button>
      ))}
    </div>
  )
}
