"use client"

import { useState, useCallback } from "react"
import { BlockToolbar } from "./block-toolbar"
import { BlockItem } from "./block-item"
import { BlockRenderer } from "./block-renderer"
import { blocksToHtml } from "./blocks-to-html"
import { createDefaultBlock } from "./types"
import type { EmailBlock } from "./types"
import { EMAIL_VARIABLES } from "../variable-badge-extension"
import { Badge } from "@/components/ui/badge"

interface BlockEditorProps {
  blocks: EmailBlock[]
  onChange: (blocks: EmailBlock[]) => void
  onHtmlChange: (html: string) => void
}

export function BlockEditor({ blocks, onChange, onHtmlChange }: BlockEditorProps) {
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)

  const updateBlocks = useCallback(
    (newBlocks: EmailBlock[]) => {
      onChange(newBlocks)
      onHtmlChange(blocksToHtml(newBlocks))
    },
    [onChange, onHtmlChange]
  )

  const addBlock = useCallback(
    (type: EmailBlock["type"]) => {
      const newBlock = createDefaultBlock(type)
      const updated = [...blocks, newBlock]
      updateBlocks(updated)
      setSelectedBlockId(newBlock.id)
    },
    [blocks, updateBlocks]
  )

  const updateBlock = useCallback(
    (index: number, updated: EmailBlock) => {
      const newBlocks = [...blocks]
      newBlocks[index] = updated
      updateBlocks(newBlocks)
    },
    [blocks, updateBlocks]
  )

  const deleteBlock = useCallback(
    (index: number) => {
      const newBlocks = blocks.filter((_, i) => i !== index)
      updateBlocks(newBlocks)
      setSelectedBlockId(null)
    },
    [blocks, updateBlocks]
  )

  const moveBlock = useCallback(
    (fromIndex: number, direction: -1 | 1) => {
      const toIndex = fromIndex + direction
      if (toIndex < 0 || toIndex >= blocks.length) return
      const newBlocks = [...blocks]
      ;[newBlocks[fromIndex], newBlocks[toIndex]] = [newBlocks[toIndex], newBlocks[fromIndex]]
      updateBlocks(newBlocks)
    },
    [blocks, updateBlocks]
  )

  const insertVariable = useCallback(
    (varName: string) => {
      if (selectedBlockId === null) return
      const idx = blocks.findIndex((b) => b.id === selectedBlockId)
      if (idx === -1) return

      const block = blocks[idx]
      if ("text" in block && typeof block.text === "string") {
        updateBlock(idx, { ...block, text: block.text + `{{${varName}}}` } as EmailBlock)
      }
    },
    [blocks, selectedBlockId, updateBlock]
  )

  return (
    <div className="border rounded-lg overflow-hidden bg-white">
      <BlockToolbar onAdd={addBlock} />

      {/* Variables bar */}
      <div className="border-b bg-orange-50/50 px-3 py-2 flex flex-wrap gap-1.5">
        <span className="text-xs text-muted-foreground ml-1 self-center">
          משתנים:
        </span>
        {EMAIL_VARIABLES.map((v) => (
          <Badge
            key={v.name}
            variant="outline"
            className="text-xs cursor-pointer bg-orange-100 text-blue-800 border-blue-200 hover:bg-blue-200"
            onClick={() => insertVariable(v.name)}
          >
            {v.label}
          </Badge>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[500px]">
        {/* Blocks list */}
        <div className="border-l overflow-y-auto max-h-[700px] p-3 space-y-2">
          {blocks.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">
              לחץ על הכפתורים למעלה כדי להוסיף בלוקים למייל
            </div>
          ) : (
            blocks.map((block, idx) => (
              <BlockItem
                key={block.id}
                block={block}
                index={idx}
                total={blocks.length}
                isSelected={block.id === selectedBlockId}
                onSelect={() => setSelectedBlockId(block.id)}
                onChange={(updated) => updateBlock(idx, updated)}
                onDelete={() => deleteBlock(idx)}
                onMoveUp={() => moveBlock(idx, -1)}
                onMoveDown={() => moveBlock(idx, 1)}
              />
            ))
          )}
        </div>

        {/* Live preview */}
        <div className="overflow-y-auto max-h-[700px]">
          <BlockRenderer blocks={blocks} />
        </div>
      </div>
    </div>
  )
}
