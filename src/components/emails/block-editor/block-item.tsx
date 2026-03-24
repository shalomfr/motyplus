"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { VariableTextarea, type VariableTextareaHandle } from "./variable-textarea"
import { useRef } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Trash2, GripVertical, ChevronUp, ChevronDown, Plus, X, Upload, Bold, AlignRight, AlignCenter, AlignLeft, AlignJustify, Palette } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { BLOCK_LABELS } from "./types"
import type { EmailBlock, ButtonConfig, TextAlign } from "./types"
import { cn } from "@/lib/utils"
import { EMAIL_VARIABLES } from "../variable-badge-extension"

const TEXT_COLORS = [
  { value: "#c62828", label: "אדום" },
  { value: "#1565c0", label: "כחול" },
  { value: "#2e7d32", label: "ירוק" },
  { value: "#e65100", label: "כתום" },
  { value: "#6a1b9a", label: "סגול" },
  { value: "#000000", label: "שחור (רגיל)" },
]

function ColorPickerButtons() {
  const applyColor = (color: string) => {
    document.execCommand("foreColor", false, color)
  }

  return (
    <>
      {TEXT_COLORS.map((c) => (
        <button
          key={c.value}
          type="button"
          title={c.label}
          className="h-5 w-5 rounded-full border border-gray-300 shrink-0 hover:scale-110 transition-transform"
          style={{ backgroundColor: c.value }}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => applyColor(c.value)}
        />
      ))}
    </>
  )
}

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

function toggleBoldSelection(input: HTMLInputElement): string {
  const { selectionStart, selectionEnd, value } = input
  if (selectionStart == null || selectionEnd == null || selectionStart === selectionEnd) {
    return value
  }
  const before = value.slice(0, selectionStart)
  const selected = value.slice(selectionStart, selectionEnd)
  const after = value.slice(selectionEnd)

  if (selected.startsWith("<b>") && selected.endsWith("</b>")) {
    return before + selected.slice(3, -4) + after
  }
  return `${before}<b>${selected}</b>${after}`
}

function ListEditor({
  items,
  onChange,
}: {
  items: string[]
  onChange: (items: string[]) => void
}) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  const updateItem = (idx: number, value: string) => {
    const next = [...items]
    next[idx] = value
    onChange(next)
  }

  const handleBold = (idx: number) => {
    const input = inputRefs.current[idx]
    if (!input) return
    const updated = toggleBoldSelection(input)
    updateItem(idx, updated)
  }

  const addItem = () => onChange([...items, ""])
  const removeItem = (idx: number) => onChange(items.filter((_, i) => i !== idx))

  return (
    <div className="space-y-1.5">
      {items.map((item, idx) => (
        <div key={idx} className="flex gap-1">
          <Input
            ref={(el) => { inputRefs.current[idx] = el }}
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
            title="הדגשה (Bold)"
            onClick={() => handleBold(idx)}
          >
            <Bold className="h-3 w-3" />
          </Button>
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

function RenderBlockFields({
  block,
  onChange,
}: {
  block: EmailBlock
  onChange: (b: EmailBlock) => void
}) {
  const textareaRef = useRef<VariableTextareaHandle>(null)
  const textareaLeftRef = useRef<VariableTextareaHandle>(null)

  switch (block.type) {
    case "heading":
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <Label className="text-xs">פריסה:</Label>
            <Select
              value={block.layout || "center"}
              onValueChange={(v) => onChange({ ...block, layout: v as "center" | "split" })}
            >
              <SelectTrigger className="h-7 text-xs w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="center">ממורכז</SelectItem>
                <SelectItem value="split">ימין + שמאל</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <VariableTextarea
            ref={textareaRef}
            value={block.text}
            onChange={(text) => onChange({ ...block, text })}
            placeholder={block.layout === "split" ? "כותרת ימין (עברית)" : "טקסט כותרת"}
            singleLine
          />
          {block.layout === "split" && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">צד שמאל:</Label>
              <VariableTextarea
                ref={textareaLeftRef}
                value={block.textLeft || ""}
                onChange={(textLeft) => onChange({ ...block, textLeft })}
                placeholder="כותרת שמאל (Version 5.0)"
                singleLine
              />
              <div className="flex flex-wrap gap-1">
                {EMAIL_VARIABLES.filter(v => ["updateVersion", "releaseDate", "organ", "currentVersion"].includes(v.name)).map((v) => (
                  <Badge
                    key={v.name}
                    variant="outline"
                    className="text-[10px] cursor-pointer bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200 py-0 px-1.5"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => textareaLeftRef.current?.insertAtCursor(`{{${v.name}}}`)}
                  >
                    {v.label}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )

    case "subheading":
      return (
        <div className="space-y-2">
          <VariableTextarea
            ref={textareaRef}
            value={block.text}
            onChange={(text) => onChange({ ...block, text })}
            placeholder="כותרת משנה"
            singleLine
          />
          <div className="flex items-center gap-2">
            <Label className="text-xs">יישור:</Label>
            <Select
              value={block.align || "right"}
              onValueChange={(v) => onChange({ ...block, align: v as "right" | "center" | "left" })}
            >
              <SelectTrigger className="h-7 text-xs w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="right">ימין</SelectItem>
                <SelectItem value="center">מרכז</SelectItem>
                <SelectItem value="left">שמאל</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )

    case "banner":
      return (
        <div className="space-y-1.5">
          <VariableTextarea
            ref={textareaRef}
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

    case "paragraph": {
      const alignOptions: { value: TextAlign; icon: typeof AlignRight; label: string }[] = [
        { value: "right", icon: AlignRight, label: "ימין" },
        { value: "center", icon: AlignCenter, label: "מרכז" },
        { value: "left", icon: AlignLeft, label: "שמאל" },
        { value: "justify", icon: AlignJustify, label: "מלא" },
      ]
      const currentAlign = block.align || "right"
      return (
        <div className="space-y-1">
          <div className="flex gap-1 mb-1">
            <Button
              variant="outline"
              size="sm"
              className="h-6 w-6 p-0"
              title="הדגש (bold)"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                const sel = window.getSelection()
                if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
                  document.execCommand("bold", false)
                  return
                }
                const range = sel.getRangeAt(0)
                // Check if already inside <b>/<strong> — toggle off
                let ancestor = range.commonAncestorContainer as Node
                if (ancestor.nodeType === Node.TEXT_NODE) ancestor = ancestor.parentNode!
                const boldParent = (ancestor as HTMLElement).closest?.("b, strong")
                if (boldParent) {
                  // Unwrap bold
                  const parent = boldParent.parentNode!
                  while (boldParent.firstChild) {
                    parent.insertBefore(boldParent.firstChild, boldParent)
                  }
                  parent.removeChild(boldParent)
                } else {
                  // Wrap entire selection (including variable badges) in <b>
                  const fragment = range.extractContents()
                  const bold = document.createElement("b")
                  bold.appendChild(fragment)
                  range.insertNode(bold)
                  const newRange = document.createRange()
                  newRange.selectNodeContents(bold)
                  sel.removeAllRanges()
                  sel.addRange(newRange)
                }
                // Trigger input event to sync value
                const editable = (range.startContainer.nodeType === Node.TEXT_NODE
                  ? range.startContainer.parentElement
                  : range.startContainer as HTMLElement)?.closest("[contenteditable]")
                editable?.dispatchEvent(new Event("input", { bubbles: true }))
              }}
            >
              <Bold className="h-3 w-3" />
            </Button>
            <div className="border-r mx-1" />
            <Palette className="h-3 w-3 text-muted-foreground" />
            <ColorPickerButtons />
            <div className="border-r mx-1" />
            {alignOptions.map(({ value, icon: Icon, label }) => (
              <Button
                key={value}
                variant={currentAlign === value ? "default" : "outline"}
                size="sm"
                className="h-6 w-6 p-0"
                title={`יישור ${label}`}
                onClick={() => onChange({ ...block, align: value })}
              >
                <Icon className="h-3 w-3" />
              </Button>
            ))}
          </div>
          <VariableTextarea
            ref={textareaRef}
            value={block.text}
            onChange={(text) => onChange({ ...block, text })}
            placeholder="טקסט פסקה..."
            rows={2}
          />
        </div>
      )
    }

    case "folder": {
      const folderAlignOptions: { value: "right" | "center" | "left"; icon: typeof AlignRight; label: string }[] = [
        { value: "right", icon: AlignRight, label: "ימין" },
        { value: "center", icon: AlignCenter, label: "מרכז" },
        { value: "left", icon: AlignLeft, label: "שמאל" },
      ]
      const folderAlign = block.align || "right"
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Input
              value={block.name}
              onChange={(e) => onChange({ ...block, name: e.target.value })}
              className="h-8 text-sm flex-1"
              placeholder="שם תיקייה"
              dir="rtl"
            />
            <div className="flex gap-0.5">
              {folderAlignOptions.map(({ value, icon: Icon, label }) => (
                <Button
                  key={value}
                  variant={folderAlign === value ? "default" : "outline"}
                  size="sm"
                  className="h-8 w-8 p-0"
                  title={`יישור ${label}`}
                  onClick={() => onChange({ ...block, align: value })}
                >
                  <Icon className="h-3 w-3" />
                </Button>
              ))}
            </div>
          </div>
          <Label className="text-xs text-muted-foreground">פריטים:</Label>
          <ListEditor
            items={block.items}
            onChange={(items) => onChange({ ...block, items })}
          />
        </div>
      )
    }

    case "subfolder": {
      const subfolderAlignOptions: { value: "right" | "center" | "left"; icon: typeof AlignRight; label: string }[] = [
        { value: "right", icon: AlignRight, label: "ימין" },
        { value: "center", icon: AlignCenter, label: "מרכז" },
        { value: "left", icon: AlignLeft, label: "שמאל" },
      ]
      const subfolderAlign = block.align || "right"
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Input
              value={block.name}
              onChange={(e) => onChange({ ...block, name: e.target.value })}
              className="h-8 text-sm flex-1"
              placeholder="שם תיקייה משנית"
              dir="rtl"
            />
            <div className="flex gap-0.5">
              {subfolderAlignOptions.map(({ value, icon: Icon, label }) => (
                <Button
                  key={value}
                  variant={subfolderAlign === value ? "default" : "outline"}
                  size="sm"
                  className="h-8 w-8 p-0"
                  title={`יישור ${label}`}
                  onClick={() => onChange({ ...block, align: value })}
                >
                  <Icon className="h-3 w-3" />
                </Button>
              ))}
            </div>
          </div>
          <Label className="text-xs text-muted-foreground">פריטים:</Label>
          <ListEditor
            items={block.items}
            onChange={(items) => onChange({ ...block, items })}
          />
        </div>
      )
    }

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
            ref={textareaRef}
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
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0"
              title="הדגשה (Bold)"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => document.execCommand("bold")}
            >
              <Bold className="h-3.5 w-3.5" />
            </Button>
            <div className="border-r mx-0.5 h-5" />
            <Palette className="h-3.5 w-3.5 text-muted-foreground" />
            <ColorPickerButtons />
            <span className="text-[10px] text-muted-foreground mr-1">סמן טקסט → B / צבע</span>
          </div>
          <VariableTextarea
            ref={textareaRef}
            value={block.text}
            onChange={(text) => onChange({ ...block, text })}
            placeholder="טקסט אזהרה..."
            rows={2}
          />
          <div className="flex items-center gap-2">
            <Label className="text-xs">יישור:</Label>
            <Select
              value={block.align || "center"}
              onValueChange={(v) => onChange({ ...block, align: v as "right" | "center" | "left" | "justify" })}
            >
              <SelectTrigger className="h-7 text-xs w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="right">ימין</SelectItem>
                <SelectItem value="center">מרכז</SelectItem>
                <SelectItem value="left">שמאל</SelectItem>
                <SelectItem value="justify">מלא</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
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
          <div className="flex gap-1.5">
            <Input
              value={block.url}
              onChange={(e) => onChange({ ...block, url: e.target.value })}
              className="h-7 text-xs flex-1"
              placeholder="כתובת URL או העלה תמונה"
              dir="ltr"
            />
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs shrink-0"
              onClick={() => {
                const input = document.createElement("input")
                input.type = "file"
                input.accept = "image/*"
                input.onchange = (ev) => {
                  const file = (ev.target as HTMLInputElement).files?.[0]
                  if (!file) return
                  const reader = new FileReader()
                  reader.onload = () => {
                    onChange({ ...block, url: reader.result as string, alt: block.alt || file.name })
                  }
                  reader.readAsDataURL(file)
                }
                input.click()
              }}
            >
              <Upload className="h-3 w-3 ml-1" />
              העלה
            </Button>
          </div>
          {block.url && block.url.startsWith("data:") && (
            <div className="text-[10px] text-green-600">תמונה הועלתה בהצלחה</div>
          )}
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
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0"
              title="הדגשה (Bold)"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => document.execCommand("bold")}
            >
              <Bold className="h-3.5 w-3.5" />
            </Button>
            <div className="border-r mx-0.5 h-5" />
            <Palette className="h-3.5 w-3.5 text-muted-foreground" />
            <ColorPickerButtons />
            <span className="text-[10px] text-muted-foreground mr-1">סמן טקסט → B / צבע</span>
          </div>
          <VariableTextarea
            ref={textareaRef}
            value={block.text}
            onChange={(text) => onChange({ ...block, text })}
            placeholder="הוראות הורדה והתקנה..."
            rows={3}
          />
          <div className="flex items-center gap-2">
            <Label className="text-xs">יישור:</Label>
            <Select
              value={block.align || "right"}
              onValueChange={(v) => onChange({ ...block, align: v as "right" | "center" | "left" | "justify" })}
            >
              <SelectTrigger className="h-7 text-xs w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="right">ימין</SelectItem>
                <SelectItem value="center">מרכז</SelectItem>
                <SelectItem value="left">שמאל</SelectItem>
                <SelectItem value="justify">מלא</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
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
      <div className="p-3"><RenderBlockFields block={block} onChange={onChange} /></div>
    </div>
  )
}
