"use client"

import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"

interface EmailEditorProps {
  value: string
  onChange: (value: string) => void
  label?: string
  placeholder?: string
  variables?: string[]
}

const DEFAULT_VARIABLES = [
  "customerName",
  "customerEmail",
  "customerPhone",
  "organName",
  "version",
  "downloadLink",
  "purchaseDate",
  "expiryDate",
]

export function EmailEditor({
  value,
  onChange,
  label = "תוכן המייל",
  placeholder = "כתוב את תוכן המייל כאן... ניתן להשתמש ב-HTML",
  variables = DEFAULT_VARIABLES,
}: EmailEditorProps) {
  const insertVariable = (variable: string) => {
    const template = `{{${variable}}}`
    onChange(value + template)
  }

  return (
    <div className="space-y-3">
      <Label>{label}</Label>

      <div className="flex flex-wrap gap-1.5 p-2 bg-muted/50 rounded-md">
        <span className="text-xs text-muted-foreground ml-2 self-center">משתנים:</span>
        {variables.map((variable) => (
          <Badge
            key={variable}
            variant="outline"
            className="cursor-pointer hover:bg-primary/10 transition-colors text-xs"
            onClick={() => insertVariable(variable)}
          >
            {`{{${variable}}}`}
          </Badge>
        ))}
      </div>

      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={12}
        className="font-mono text-sm"
        dir="rtl"
      />

      <p className="text-xs text-muted-foreground">
        לחץ על משתנה כדי להוסיף אותו לתוכן. ניתן להשתמש בתגיות HTML לעיצוב.
      </p>
    </div>
  )
}
