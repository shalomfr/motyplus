"use client"

import { useState } from "react"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { RichEmailEditor } from "./rich-email-editor"
import { BlockEditor } from "./block-editor"
import { blocksToHtml } from "./block-editor/blocks-to-html"
import type { EmailBlock } from "./block-editor/types"
import { Blocks, Code } from "lucide-react"
import { cn } from "@/lib/utils"

type EditorType = "blocks" | "code"

interface EmailEditorProps {
  value: string
  onChange: (value: string) => void
  label?: string
  placeholder?: string
  variables?: string[]
  initialBlocks?: EmailBlock[]
  onBlocksChange?: (blocks: EmailBlock[]) => void
}

export function EmailEditor({
  value,
  onChange,
  label = "תוכן המייל",
  initialBlocks,
  onBlocksChange,
}: EmailEditorProps) {
  const [editorType, setEditorType] = useState<EditorType>("blocks")
  const [blocks, setBlocks] = useState<EmailBlock[]>(initialBlocks || [])

  const handleBlocksChange = (newBlocks: EmailBlock[]) => {
    setBlocks(newBlocks)
    onBlocksChange?.(newBlocks)
  }

  const handleHtmlChange = (html: string) => {
    onChange(html)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Label className="shrink-0">{label}</Label>
        <div className="flex gap-1 bg-muted rounded-lg p-0.5">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 sm:h-7 text-xs gap-1 rounded-md px-2 sm:px-3 min-h-[36px] sm:min-h-0",
              editorType === "blocks" && "bg-white shadow-sm"
            )}
            onClick={() => setEditorType("blocks")}
          >
            <Blocks className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">עורך בלוקים</span>
            <span className="sm:hidden">בלוקים</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 sm:h-7 text-xs gap-1 rounded-md px-2 sm:px-3 min-h-[36px] sm:min-h-0",
              editorType === "code" && "bg-white shadow-sm"
            )}
            onClick={() => setEditorType("code")}
          >
            <Code className="h-3.5 w-3.5" />
            HTML
          </Button>
        </div>
      </div>

      {editorType === "blocks" ? (
        <BlockEditor
          blocks={blocks}
          onChange={handleBlocksChange}
          onHtmlChange={handleHtmlChange}
        />
      ) : (
        <RichEmailEditor
          content={value}
          onChange={onChange}
        />
      )}
    </div>
  )
}
