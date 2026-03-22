"use client"

import { useRef, useCallback, useEffect } from "react"
import { EMAIL_VARIABLES } from "../variable-badge-extension"
import { cn } from "@/lib/utils"

interface VariableTextareaProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  className?: string
  singleLine?: boolean
}

const VAR_LABEL_MAP: Record<string, string> = Object.fromEntries(
  EMAIL_VARIABLES.map((v) => [v.name, v.label])
)

function valueToHtml(text: string): string {
  const regex = /\{\{(\w+)\}\}/g
  let result = ""
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const chunk = text.slice(lastIndex, match.index)
      result += chunk.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")
    }
    const varName = match[1]
    const label = VAR_LABEL_MAP[varName] || varName
    result += `<span data-var="${varName}" contenteditable="false" style="display:inline-flex;align-items:center;padding:1px 8px;margin:0 2px;border-radius:9999px;font-size:12px;font-weight:600;background:#dbeafe;color:#1e40af;border:1px solid #93c5fd;cursor:default;user-select:none;">${label}</span>`
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    const chunk = text.slice(lastIndex)
    result += chunk.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")
  }

  return result
}

function domToValue(el: HTMLElement): string {
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
        // contentEditable wraps new lines in <div> or <p>
        if (idx > 0) result += "\n"
        result += domToValue(element)
      } else {
        result += element.textContent || ""
      }
    }
  })
  return result
}

export function VariableTextarea({
  value,
  onChange,
  placeholder,
  rows = 2,
  className,
  singleLine = false,
}: VariableTextareaProps) {
  const editableRef = useRef<HTMLDivElement>(null)
  const lastValueRef = useRef<string>("")
  const isTypingRef = useRef(false)

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
    const extracted = domToValue(el)
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
}
