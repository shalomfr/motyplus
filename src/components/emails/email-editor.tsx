"use client"

import { Label } from "@/components/ui/label"
import { RichEmailEditor } from "./rich-email-editor"

interface EmailEditorProps {
  value: string
  onChange: (value: string) => void
  label?: string
  placeholder?: string
  variables?: string[]
}

export function EmailEditor({
  value,
  onChange,
  label = "תוכן המייל",
}: EmailEditorProps) {
  return (
    <div className="space-y-3">
      <Label>{label}</Label>
      <RichEmailEditor
        content={value}
        onChange={onChange}
      />
    </div>
  )
}
