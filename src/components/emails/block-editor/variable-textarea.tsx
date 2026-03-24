"use client"

import { useRef, useCallback, useEffect, useImperativeHandle, forwardRef } from "react"
import { EMAIL_VARIABLES } from "../variable-badge-extension"
import { cn } from "@/lib/utils"

export interface VariableTextareaHandle {
  insertAtCursor: (text: string) => void
}

interface VariableTextareaProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  className?: string
  singleLine?: boolean
  defaultAlign?: string
}

const VAR_LABEL_MAP: Record<string, string> = Object.fromEntries(
  EMAIL_VARIABLES.map((v) => [v.name, v.label])
)

// Allowed HTML tags that should pass through without escaping
const ALLOWED_TAGS = /(<\/?(?:b|strong|i|em|u)>|<span style="color:[^"]*">|<\/span>|<p style="text-align:[^"]*">|<\/p>)/gi

function escapeChunk(chunk: string): string {
  return chunk.split(ALLOWED_TAGS).map((part, i) => {
    if (i % 2 === 1) return part
    return part.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")
  }).join("")
}

function valueToHtml(text: string): string {
  const regex = /\{\{(\w+)\}\}/g
  let result = ""
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      result += escapeChunk(text.slice(lastIndex, match.index))
    }
    const varName = match[1]
    const label = VAR_LABEL_MAP[varName] || varName
    result += `<span data-var="${varName}" contenteditable="false" style="display:inline-flex;align-items:center;padding:1px 8px;margin:0 2px;border-radius:9999px;font-size:12px;font-weight:600;background:#dbeafe;color:#1e40af;border:1px solid #93c5fd;cursor:default;user-select:none;">${label}</span>`
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    result += escapeChunk(text.slice(lastIndex))
  }

  return result
}

const INLINE_TAGS: Record<string, { open: string; close: string }> = {
  B: { open: "<b>", close: "</b>" },
  STRONG: { open: "<b>", close: "</b>" },
  I: { open: "<i>", close: "</i>" },
  EM: { open: "<i>", close: "</i>" },
  U: { open: "<u>", close: "</u>" },
}

function getSpanColorTag(el: HTMLElement): { open: string; close: string } | null {
  const color = el.style?.color
  if (!color) return null
  return { open: `<span style="color:${color}">`, close: "</span>" }
}

function domToValue(el: HTMLElement, defaultAlign?: string): string {
  let result = ""
  el.childNodes.forEach((node, idx) => {
    if (node.nodeType === Node.TEXT_NODE) {
      result += node.textContent || ""
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement
      const varName = element.getAttribute("data-var")
      if (varName) {
        result += `{{${varName}}}`
      } else if (element.tagName === "BR") {
        result += "\n"
      } else if (element.tagName === "DIV" || element.tagName === "P") {
        const lineAlign = element.style?.textAlign
        if (idx > 0) result += "\n"
        const inner = domToValue(element, defaultAlign)
        const isDifferentFromBlock = lineAlign && lineAlign !== "start" && lineAlign !== (defaultAlign || "")
        if (isDifferentFromBlock && inner) {
          result += `<p style="text-align:${lineAlign}">${inner}</p>`
        } else {
          result += inner
        }
      } else if (INLINE_TAGS[element.tagName]) {
        const tag = INLINE_TAGS[element.tagName]
        const inner = domToValue(element, defaultAlign)
        if (inner) result += tag.open + inner + tag.close
      } else if (element.tagName === "SPAN" || element.tagName === "FONT") {
        const colorTag = getSpanColorTag(element)
        const inner = domToValue(element, defaultAlign)
        if (colorTag && inner) {
          result += colorTag.open + inner + colorTag.close
        } else {
          result += inner
        }
      } else {
        result += domToValue(element, defaultAlign)
      }
    }
  })
  return result
}

export const VariableTextarea = forwardRef<VariableTextareaHandle, VariableTextareaProps>(function VariableTextarea({
  value,
  onChange,
  placeholder,
  rows = 2,
  className,
  singleLine = false,
  defaultAlign,
}, ref) {
  const editableRef = useRef<HTMLDivElement>(null)
  const lastValueRef = useRef<string>("")
  const isTypingRef = useRef(false)
  const savedRangeRef = useRef<Range | null>(null)

  // Save cursor position on selection change / blur
  const saveCursorPosition = useCallback(() => {
    const el = editableRef.current
    if (!el) return
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0)
      if (el.contains(range.startContainer)) {
        savedRangeRef.current = range.cloneRange()
      }
    }
  }, [])

  useEffect(() => {
    document.addEventListener("selectionchange", saveCursorPosition)
    return () => document.removeEventListener("selectionchange", saveCursorPosition)
  }, [saveCursorPosition])

  // Expose insertAtCursor to parent via ref
  useImperativeHandle(ref, () => ({
    insertAtCursor(text: string) {
      const el = editableRef.current
      if (!el) return

      // Build the variable badge HTML
      const html = valueToHtml(text)

      el.focus()
      const sel = window.getSelection()
      if (!sel) return

      // Restore saved cursor position if available
      if (savedRangeRef.current && el.contains(savedRangeRef.current.startContainer)) {
        sel.removeAllRanges()
        sel.addRange(savedRangeRef.current)
      }

      // If selection is not inside our element, place cursor at end
      if (!sel.rangeCount || !el.contains(sel.getRangeAt(0).startContainer)) {
        const range = document.createRange()
        range.selectNodeContents(el)
        range.collapse(false)
        sel.removeAllRanges()
        sel.addRange(range)
      }

      // Insert at cursor position
      const range = sel.getRangeAt(0)
      range.deleteContents()
      const temp = document.createElement("span")
      temp.innerHTML = html
      const frag = document.createDocumentFragment()
      let lastNode: Node | null = null
      while (temp.firstChild) {
        lastNode = frag.appendChild(temp.firstChild)
      }
      range.insertNode(frag)

      // Move cursor after inserted content
      if (lastNode) {
        const newRange = document.createRange()
        newRange.setStartAfter(lastNode)
        newRange.collapse(true)
        sel.removeAllRanges()
        sel.addRange(newRange)
      }

      // Sync value
      isTypingRef.current = true
      const extracted = domToValue(el, defaultAlign)
      lastValueRef.current = extracted
      onChange(extracted)
      requestAnimationFrame(() => { isTypingRef.current = false })
    }
  }), [onChange, defaultAlign])

  // Sync DOM from value — only when value changes externally
  useEffect(() => {
    const el = editableRef.current
    if (!el) return
    if (isTypingRef.current) return // Don't interfere while user is typing
    if (lastValueRef.current === value) return
    lastValueRef.current = value
    el.innerHTML = valueToHtml(value)
  }, [value])

  // Initial render
  useEffect(() => {
    const el = editableRef.current
    if (!el) return
    lastValueRef.current = value
    el.innerHTML = valueToHtml(value)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleInput = useCallback(() => {
    const el = editableRef.current
    if (!el) return
    isTypingRef.current = true
    const extracted = domToValue(el, defaultAlign)
    lastValueRef.current = extracted
    onChange(extracted)
    // Reset typing flag after React processes the update
    requestAnimationFrame(() => {
      isTypingRef.current = false
    })
  }, [onChange])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (singleLine && e.key === "Enter") {
      e.preventDefault()
    }
  }

  // Prevent React from touching DOM children
  return (
    <div
      ref={editableRef}
      contentEditable
      suppressContentEditableWarning
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      dir="rtl"
      data-placeholder={placeholder}
      className={cn(
        "border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 bg-background",
        singleLine ? "min-h-[32px] whitespace-nowrap overflow-x-auto" : `min-h-[${rows * 24 + 16}px]`,
        className
      )}
      style={!value ? { color: "#9ca3af" } : undefined}
    />
  )
})
