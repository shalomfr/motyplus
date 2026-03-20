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
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <div className="flex gap-1 bg-muted rounded-lg p-0.5">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 text-xs gap-1 rounded-md",
              editorType === "blocks" && "bg-white shadow-sm"
            )}
            onClick={() => setEditorType("blocks")}
          >
            <Blocks className="h-3.5 w-3.5" />
            עורך בלוקים
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 text-xs gap-1 rounded-md",
              editorType === "code" && "bg-white shadow-sm"
            )}
            onClick={() => setEditorType("code")}
          >
            <Code className="h-3.5 w-3.5" />
            עורך HTML
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
