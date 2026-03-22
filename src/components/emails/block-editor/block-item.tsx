"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { VariableTextarea } from "./variable-textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Trash2, GripVertical, ChevronUp, ChevronDown, Plus, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { BLOCK_LABELS } from "./types"
import type { EmailBlock, ButtonConfig } from "./types"
import { cn } from "@/lib/utils"
import { EMAIL_VARIABLES } from "../variable-badge-extension"

interface BlockItemProps {
  block: EmailBlock
  index: number
  total: number
  isSelected: boolean
  onSelect: () => void
  onChange: (updated: EmailBlock) => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}

function ListEditor({
  items,
  onChange,
}: {
  items: string[]
  onChange: (items: string[]) => void
}) {
  const updateItem = (idx: number, value: string) => {
    const next = [...items]
    next[idx] = value
    onChange(next)
  }

  const addItem = () => onChange([...items, ""])
  const removeItem = (idx: number) => onChange(items.filter((_, i) => i !== idx))

  return (
    <div className="space-y-1.5">
      {items.map((item, idx) => (
        <div key={idx} className="flex gap-1">
          <Input
            value={item}
            onChange={(e) => updateItem(idx, e.target.value)}
            className="h-7 text-xs flex-1"
            placeholder={`פריט ${idx + 1}`}
            dir="rtl"
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={() => removeItem(idx)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ))}
      <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={addItem}>
        <Plus className="h-3 w-3 ml-1" />
        הוסף פריט
      </Button>
    </div>
  )
}

function ButtonsEditor({
  buttons,
  onChange,
}: {
  buttons: ButtonConfig[]
  onChange: (buttons: ButtonConfig[]) => void
}) {
  const updateButton = (idx: number, field: keyof ButtonConfig, value: string) => {
    const next = [...buttons]
    next[idx] = { ...next[idx], [field]: value }
    onChange(next)
  }

  const addButton = () =>
    onChange([...buttons, { label: "כפתור", url: "", color: "gold" }])

  const removeButton = (idx: number) =>
    onChange(buttons.filter((_, i) => i !== idx))

  return (
    <div className="space-y-2">
      {buttons.map((btn, idx) => (
        <div key={idx} className="space-y-1 p-2 bg-muted/30 rounded">
          <div className="flex gap-1">
            <Input
              value={btn.label}
              onChange={(e) => updateButton(idx, "label", e.target.value)}
              className="h-7 text-xs"
              placeholder="טקסט כפתור"
              dir="rtl"
            />
            <Select
              value={btn.color}
              onValueChange={(v) => updateButton(idx, "color", v)}
            >
              <SelectTrigger className="h-7 w-20 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gold">זהב</SelectItem>
                <SelectItem value="green">ירוק</SelectItem>
                <SelectItem value="red">אדום</SelectItem>
                <SelectItem value="blue">כחול</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => removeButton(idx)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
          <Input
            value={btn.url}
            onChange={(e) => updateButton(idx, "url", e.target.value)}
            className="h-7 text-xs"
            placeholder="קישור (URL או {{משתנה}})"
            dir="ltr"
          />
          <div className="flex flex-wrap gap-1 pt-0.5">
            {EMAIL_VARIABLES.map((v) => (
              <Badge
                key={v.name}
                variant="outline"
                className="text-[10px] cursor-pointer bg-orange-100 text-blue-800 border-blue-200 hover:bg-blue-200 py-0 px-1.5"
                onClick={() => updateButton(idx, "url", btn.url + `{{${v.name}}}`)}
              >
                {v.label}
              </Badge>
            ))}
          </div>
        </div>
      ))}
      <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={addButton}>
        <Plus className="h-3 w-3 ml-1" />
        הוסף כפתור
      </Button>
    </div>
  )
}

function renderBlockFields(
  block: EmailBlock,
  onChange: (b: EmailBlock) => void
) {
  switch (block.type) {
    case "heading":
      return (
        <VariableTextarea
          value={block.text}
          onChange={(text) => onChange({ ...block, text })}
          placeholder="טקסט כותרת"
          singleLine
        />
      )

    case "banner":
      return (
        <div className="space-y-1.5">
          <VariableTextarea
            value={block.text}
            onChange={(text) => onChange({ ...block, text })}
            placeholder="טקסט באנר"
            singleLine
          />
          <Select
            value={block.color}
            onValueChange={(v) =>
              onChange({ ...block, color: v as "orange" | "blue" | "red" })
            }
          >
            <SelectTrigger className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="orange">כתום-צהוב</SelectItem>
              <SelectItem value="blue">כחול</SelectItem>
              <SelectItem value="red">אדום</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )

    case "paragraph":
      return (
        <VariableTextarea
          value={block.text}
          onChange={(text) => onChange({ ...block, text })}
          placeholder="טקסט פסקה..."
          rows={2}
        />
      )

    case "folder":
      return (
        <div className="space-y-2">
          <Input
            value={block.name}
            onChange={(e) => onChange({ ...block, name: e.target.value })}
            className="h-8 text-sm"
            placeholder="שם תיקייה"
            dir="rtl"
          />
          <Label className="text-xs text-muted-foreground">פריטים:</Label>
          <ListEditor
            items={block.items}
            onChange={(items) => onChange({ ...block, items })}
          />
        </div>
      )

    case "list":
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label className="text-xs">סוג:</Label>
            <Select
              value={block.ordered ? "ordered" : "unordered"}
              onValueChange={(v) =>
                onChange({ ...block, ordered: v === "ordered" })
              }
            >
              <SelectTrigger className="h-7 text-xs w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unordered">נקודות</SelectItem>
                <SelectItem value="ordered">מספרים</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <ListEditor
            items={block.items}
            onChange={(items) => onChange({ ...block, items })}
          />
        </div>
      )

    case "buttons":
      return (
        <ButtonsEditor
          buttons={block.buttons}
          onChange={(buttons) => onChange({ ...block, buttons })}
        />
      )

    case "promo":
      return (
        <div className="space-y-1.5">
          <VariableTextarea
            value={block.text}
            onChange={(text) => onChange({ ...block, text })}
            placeholder="טקסט המבצע"
            rows={2}
          />
          <div className="grid grid-cols-2 gap-1.5">
            <Input
              value={block.price}
              onChange={(e) => onChange({ ...block, price: e.target.value })}
              className="h-7 text-xs"
              placeholder="מחיר (כולל מטבע)"
              dir="rtl"
            />
            <Input
              value={block.expiry}
              onChange={(e) => onChange({ ...block, expiry: e.target.value })}
              className="h-7 text-xs"
              placeholder="תוקף (תאריך)"
              dir="rtl"
            />
          </div>
        </div>
      )

    case "bankTable":
      return (
        <p className="text-xs text-muted-foreground">
          טבלת פרטי בנק קבועה (הפועלים 446, חשבון 113689)
        </p>
      )

    case "warning":
      return (
        <VariableTextarea
          value={block.text}
          onChange={(text) => onChange({ ...block, text })}
          placeholder="טקסט אזהרה..."
          rows={2}
        />
      )

    case "signature":
      return (
        <p className="text-xs text-muted-foreground">
          בברכה, מוטי רוזנפלד
        </p>
      )

    case "image":
      return (
        <div className="space-y-1.5">
          <Input
            value={block.url}
            onChange={(e) => onChange({ ...block, url: e.target.value })}
            className="h-7 text-xs"
            placeholder="כתובת URL של התמונה"
            dir="ltr"
          />
          <Input
            value={block.alt}
            onChange={(e) => onChange({ ...block, alt: e.target.value })}
            className="h-7 text-xs"
            placeholder="תיאור (alt)"
            dir="rtl"
          />
        </div>
      )

    case "divider":
      return (
        <p className="text-xs text-muted-foreground">קו מפריד זהוב</p>
      )

    case "instructions":
      return (
        <VariableTextarea
          value={block.text}
          onChange={(text) => onChange({ ...block, text })}
          placeholder="הוראות הורדה והתקנה..."
          rows={3}
        />
      )
  }
}

const TYPE_COLORS: Partial<Record<EmailBlock["type"], string>> = {
  heading: "border-l-amber-400",
  banner: "border-l-orange-400",
  folder: "border-l-yellow-600",
  buttons: "border-l-orange-400",
  promo: "border-l-yellow-400",
  warning: "border-l-red-400",
  instructions: "border-l-orange-500",
  bankTable: "border-l-gray-400",
  signature: "border-l-gray-300",
}

export function BlockItem({
  block,
  index,
  total,
  isSelected,
  onSelect,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
}: BlockItemProps) {
  return (
    <div
      className={cn(
        "border rounded-lg overflow-hidden transition-all border-l-4",
        TYPE_COLORS[block.type] || "border-l-gray-200",
        isSelected ? "ring-2 ring-blue-400 shadow-sm" : "hover:shadow-sm"
      )}
      onClick={onSelect}
    >
      <div className="flex items-center gap-1 px-2 py-1.5 bg-muted/30 border-b">
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground cursor-grab shrink-0" />
        <span className="text-xs font-medium text-muted-foreground flex-1">
          {BLOCK_LABELS[block.type]}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={(e) => { e.stopPropagation(); onMoveUp() }}
          disabled={index === 0}
        >
          <ChevronUp className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={(e) => { e.stopPropagation(); onMoveDown() }}
          disabled={index === total - 1}
        >
          <ChevronDown className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-red-400 hover:text-red-600"
          onClick={(e) => { e.stopPropagation(); onDelete() }}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
      <div className="p-3">{renderBlockFields(block, onChange)}</div>
    </div>
  )
}
