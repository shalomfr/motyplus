"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { BlockToolbar } from "./block-toolbar"
import { BlockItem } from "./block-item"
import { BlockRenderer } from "./block-renderer"
import { blocksToHtml } from "./blocks-to-html"
import { createDefaultBlock } from "./types"
import type { EmailBlock } from "./types"
import { cloneBlockWithNewId } from "./utils"
import ImportBlocksDialog from "./import-blocks-dialog"
import { BlockLibraryPanel } from "./block-library-panel"
import { EMAIL_VARIABLES } from "../variable-badge-extension"
import { Badge } from "@/components/ui/badge"
import { Undo2, ClipboardPaste } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"

const MAX_UNDO = 50

const CLIPBOARD_KEY = "motty_block_clipboard"

interface BlockEditorProps {
  blocks: EmailBlock[]
  onChange: (blocks: EmailBlock[]) => void
  onHtmlChange: (html: string) => void
  templateId?: string
}

export function BlockEditor({ blocks, onChange, onHtmlChange, templateId }: BlockEditorProps) {
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  // Copy/Paste clipboard
  const [clipboardBlock, setClipboardBlock] = useState<EmailBlock | null>(() => {
    try {
      const saved = sessionStorage.getItem(CLIPBOARD_KEY)
      return saved ? JSON.parse(saved) : null
    } catch { return null }
  })

  // Import dialog & Library panel
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [libraryPanelOpen, setLibraryPanelOpen] = useState(false)

  const { toast } = useToast()

  // Undo stack
  const undoStackRef = useRef<EmailBlock[][]>([])

  const pushUndo = useCallback(() => {
    undoStackRef.current = [...undoStackRef.current.slice(-MAX_UNDO + 1), JSON.parse(JSON.stringify(blocks))]
  }, [blocks])

  const handleUndo = useCallback(() => {
    if (undoStackRef.current.length === 0) return
    const prev = undoStackRef.current.pop()!
    onChange(prev)
    onHtmlChange(blocksToHtml(prev))
  }, [onChange, onHtmlChange])

  // Ctrl+Z listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault()
        handleUndo()
      }
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [handleUndo])

  const updateBlocks = useCallback(
    (newBlocks: EmailBlock[]) => {
      pushUndo()
      onChange(newBlocks)
      onHtmlChange(blocksToHtml(newBlocks))
    },
    [onChange, onHtmlChange, pushUndo]
  )

  const addBlock = useCallback(
    (type: EmailBlock["type"]) => {
      const newBlock = createDefaultBlock(type)
      // Insert after selected block, or at end if none selected
      const selectedIndex = selectedBlockId
        ? blocks.findIndex((b) => b.id === selectedBlockId)
        : -1
      const insertAt = selectedIndex >= 0 ? selectedIndex + 1 : blocks.length
      const updated = [...blocks.slice(0, insertAt), newBlock, ...blocks.slice(insertAt)]
      updateBlocks(updated)
      setSelectedBlockId(newBlock.id)
    },
    [blocks, selectedBlockId, updateBlocks]
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

  // Copy block to clipboard
  const copyBlock = useCallback(
    (index: number) => {
      const block = blocks[index]
      sessionStorage.setItem(CLIPBOARD_KEY, JSON.stringify(block))
      setClipboardBlock(block)
      toast({ title: "הבלוק הועתק", description: "לחץ 'הדבק בלוק' כדי להוסיף אותו" })
    },
    [blocks, toast]
  )

  // Paste block from clipboard
  const pasteBlock = useCallback(() => {
    if (!clipboardBlock) return
    const cloned = cloneBlockWithNewId(clipboardBlock)
    const selectedIndex = selectedBlockId
      ? blocks.findIndex((b) => b.id === selectedBlockId)
      : -1
    const insertAt = selectedIndex >= 0 ? selectedIndex + 1 : blocks.length
    const updated = [...blocks.slice(0, insertAt), cloned, ...blocks.slice(insertAt)]
    updateBlocks(updated)
    setSelectedBlockId(cloned.id)
    toast({ title: "הבלוק הודבק" })
  }, [clipboardBlock, blocks, selectedBlockId, updateBlocks, toast])

  // Import blocks from another template
  const handleImportBlocks = useCallback(
    (importedBlocks: EmailBlock[]) => {
      const updated = [...blocks, ...importedBlocks]
      updateBlocks(updated)
      toast({ title: `${importedBlocks.length} בלוקים יובאו בהצלחה` })
    },
    [blocks, updateBlocks, toast]
  )

  // Add single block from library
  const handleAddLibraryBlock = useCallback(
    (block: EmailBlock) => {
      const selectedIndex = selectedBlockId
        ? blocks.findIndex((b) => b.id === selectedBlockId)
        : -1
      const insertAt = selectedIndex >= 0 ? selectedIndex + 1 : blocks.length
      const updated = [...blocks.slice(0, insertAt), block, ...blocks.slice(insertAt)]
      updateBlocks(updated)
      setSelectedBlockId(block.id)
      toast({ title: "בלוק נוסף" })
    },
    [blocks, selectedBlockId, updateBlocks, toast]
  )

  const insertVariable = useCallback(
    (varName: string) => {
      if (selectedBlockId === null) return
      const idx = blocks.findIndex((b) => b.id === selectedBlockId)
      if (idx === -1) return

      const block = blocks[idx]
      if (!("text" in block) || typeof block.text !== "string") return

      // Try to find the focused VariableTextarea contentEditable and insert at cursor
      const activeEl = document.activeElement
      if (activeEl && activeEl.getAttribute("contenteditable") === "true") {
        const sel = window.getSelection()
        if (sel && sel.rangeCount > 0 && activeEl.contains(sel.getRangeAt(0).startContainer)) {
          // Insert via DOM at cursor position
          const range = sel.getRangeAt(0)
          range.deleteContents()
          const span = document.createElement("span")
          span.setAttribute("data-var", varName)
          span.setAttribute("contenteditable", "false")
          span.style.cssText = "display:inline-flex;align-items:center;padding:1px 8px;margin:0 2px;border-radius:9999px;font-size:12px;font-weight:600;background:#dbeafe;color:#1e40af;border:1px solid #93c5fd;cursor:default;user-select:none;"
          // Get label from EMAIL_VARIABLES
          span.textContent = EMAIL_VARIABLES.find(v => v.name === varName)?.label || varName
          range.insertNode(span)
          // Move cursor after
          const newRange = document.createRange()
          newRange.setStartAfter(span)
          newRange.collapse(true)
          sel.removeAllRanges()
          sel.addRange(newRange)
          // Trigger input event to sync value
          activeEl.dispatchEvent(new Event("input", { bubbles: true }))
          return
        }
      }

      // Fallback: append to end
      updateBlock(idx, { ...block, text: block.text + `{{${varName}}}` } as EmailBlock)
    },
    [blocks, selectedBlockId, updateBlock]
  )

  // Drag & Drop handlers
  const handleDragStart = (index: number) => {
    setDragIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    setDragOverIndex(index)
  }

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragIndex(null)
      setDragOverIndex(null)
      return
    }
    pushUndo()
    const newBlocks = [...blocks]
    const [moved] = newBlocks.splice(dragIndex, 1)
    newBlocks.splice(dropIndex, 0, moved)
    onChange(newBlocks)
    onHtmlChange(blocksToHtml(newBlocks))
    setDragIndex(null)
    setDragOverIndex(null)
  }

  const handleDragEnd = () => {
    setDragIndex(null)
    setDragOverIndex(null)
  }

  return (
    <div className="border rounded-lg overflow-hidden bg-white relative">
      <BlockToolbar
        onAdd={addBlock}
        onImportBlocks={() => setImportDialogOpen(true)}
        onOpenLibrary={() => setLibraryPanelOpen(true)}
      />

      {/* Variables bar + Undo */}
      <div className="border-b bg-blue-50/50 px-3 py-2 flex flex-wrap gap-1.5 items-center">
        <span className="text-xs text-muted-foreground ml-1 self-center">
          משתנים:
        </span>
        {EMAIL_VARIABLES.map((v) => (
          <Badge
            key={v.name}
            variant="outline"
            className="text-xs cursor-pointer bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => insertVariable(v.name)}
          >
            {v.label}
          </Badge>
        ))}
        <div className="mr-auto flex items-center gap-1">
          {clipboardBlock && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-green-700 hover:text-green-900 hover:bg-green-50"
              onClick={pasteBlock}
              title="הדבק בלוק"
            >
              <ClipboardPaste className="h-3.5 w-3.5 ml-1" />
              הדבק בלוק
              <Badge variant="secondary" className="mr-1 text-[10px] h-4 px-1.5 bg-green-100 text-green-700">
                1
              </Badge>
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-gray-500 hover:text-blue-700"
            onClick={handleUndo}
            disabled={undoStackRef.current.length === 0}
            title="בטל (Ctrl+Z)"
          >
            <Undo2 className="h-3.5 w-3.5 ml-1" />
            בטל
          </Button>
        </div>
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
              <div
                key={block.id}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={(e) => handleDrop(e, idx)}
                onDragEnd={handleDragEnd}
                className={
                  dragOverIndex === idx && dragIndex !== idx
                    ? "border-t-2 border-blue-400"
                    : ""
                }
              >
                <BlockItem
                  block={block}
                  index={idx}
                  total={blocks.length}
                  isSelected={block.id === selectedBlockId}
                  onSelect={() => setSelectedBlockId(block.id)}
                  onChange={(updated) => updateBlock(idx, updated)}
                  onDelete={() => deleteBlock(idx)}
                  onMoveUp={() => moveBlock(idx, -1)}
                  onMoveDown={() => moveBlock(idx, 1)}
                  onCopy={() => copyBlock(idx)}
                />
              </div>
            ))
          )}
        </div>

        {/* Live preview */}
        <div className="overflow-y-auto max-h-[700px]">
          <BlockRenderer blocks={blocks} />
        </div>
      </div>

      {/* Import blocks dialog */}
      <ImportBlocksDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImport={handleImportBlocks}
        currentTemplateId={templateId}
      />

      {/* Block library panel */}
      <BlockLibraryPanel
        open={libraryPanelOpen}
        onClose={() => setLibraryPanelOpen(false)}
        onAddBlock={handleAddLibraryBlock}
        currentTemplateId={templateId}
      />
    </div>
  )
}
