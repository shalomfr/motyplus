"use client"

import { useRef, useCallback } from "react"
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

function parseTextWithVariables(text: string): Array<{ type: "text" | "var"; value: string; label?: string }> {
  const parts: Array<{ type: "text" | "var"; value: string; label?: string }> = []
  const regex = /\{\{(\w+)\}\}/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", value: text.slice(lastIndex, match.index) })
    }
    parts.push({
      type: "var",
      value: match[1],
      label: VAR_LABEL_MAP[match[1]] || match[1],
    })
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    parts.push({ type: "text", value: text.slice(lastIndex) })
  }

  return parts
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

  const handleInput = useCallback(() => {
    if (!editableRef.current) return
    const el = editableRef.current

    let result = ""
    el.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        result += node.textContent || ""
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement
        const varName = element.getAttribute("data-var")
        if (varName) {
          result += `{{${varName}}}`
        } else if (element.tagName === "BR") {
          result += "\n"
        } else {
          result += element.textContent || ""
        }
      }
    })

    onChange(result)
  }, [onChange])

  const parts = parseTextWithVariables(value)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (singleLine && e.key === "Enter") {
      e.preventDefault()
    }
  }

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
        "empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground",
        singleLine ? "min-h-[32px] whitespace-nowrap overflow-x-auto" : `min-h-[${rows * 24 + 16}px]`,
        className
      )}
    >
      {parts.map((part, i) => {
        if (part.type === "var") {
          return (
            <span
              key={i}
              data-var={part.value}
              contentEditable={false}
              className="inline-flex items-center px-2 py-0.5 mx-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 border border-orange-200 cursor-default select-none"
            >
              {part.label}
            </span>
          )
        }
        return part.value.split("\n").map((line, j, arr) => (
          <span key={`${i}-${j}`}>
            {line}
            {j < arr.length - 1 && <br />}
          </span>
        ))
      })}
    </div>
  )
}
