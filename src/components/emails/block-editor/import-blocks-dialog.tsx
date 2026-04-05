"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Import, FolderOpen, FileText, Check } from "lucide-react"
import type { EmailBlock } from "./types"
import { cloneBlockWithNewId } from "./utils"

const BLOCK_TYPE_LABELS: Record<string, string> = {
  heading: "כותרת",
  subheading: "כותרת משנה",
  paragraph: "פסקה",
  banner: "באנר",
  folder: "תיקייה",
  subfolder: "תת-תיקייה",
  list: "רשימה",
  buttons: "כפתורים",
  promo: "מבצע",
  warning: "אזהרה",
  signature: "חתימה",
  brandBanner: "באנר מותג",
  image: "תמונה",
  divider: "קו הפרדה",
  instructions: "הוראות",
  bankTable: "פרטי בנק",
}

interface Template {
  id: string
  name: string
  folderId?: string | null
  blocks?: EmailBlock[]
}

interface Folder {
  id: string
  name: string
}

interface ImportBlocksDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImport: (blocks: EmailBlock[]) => void
  currentTemplateId?: string
}

function getBlockSnippet(block: EmailBlock): string {
  if ("text" in block && block.text) {
    return block.text.slice(0, 50)
  }
  if ("name" in block && block.name) {
    return block.name.slice(0, 50)
  }
  if ("items" in block && Array.isArray(block.items) && block.items.length > 0) {
    return block.items[0].slice(0, 50)
  }
  if ("buttons" in block && Array.isArray(block.buttons) && block.buttons.length > 0) {
    return block.buttons.map((b) => b.label).join(", ").slice(0, 50)
  }
  if ("url" in block && block.url) {
    return block.url.slice(0, 50)
  }
  return ""
}

export default function ImportBlocksDialog({
  open,
  onOpenChange,
  onImport,
  currentTemplateId,
}: ImportBlocksDialogProps) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [loadingBlocks, setLoadingBlocks] = useState(false)
  const [selectedBlockIds, setSelectedBlockIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!open) {
      setSelectedTemplate(null)
      setSelectedBlockIds(new Set())
      return
    }

    setLoading(true)
    Promise.all([
      fetch("/api/emails/templates").then((r) => r.json()),
      fetch("/api/emails/folders").then((r) => r.json()),
    ])
      .then(([templatesData, foldersData]) => {
        setTemplates(
          (Array.isArray(templatesData) ? templatesData : templatesData.templates || [])
            .filter((t: Template) => t.id !== currentTemplateId)
        )
        setFolders(Array.isArray(foldersData) ? foldersData : foldersData.folders || [])
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [open, currentTemplateId])

  const handleSelectTemplate = async (template: Template) => {
    if (template.blocks && template.blocks.length > 0) {
      setSelectedTemplate(template)
      setSelectedBlockIds(new Set())
      return
    }

    setLoadingBlocks(true)
    setSelectedTemplate(template)
    setSelectedBlockIds(new Set())

    try {
      const res = await fetch(`/api/emails/templates/${template.id}`)
      const data = await res.json()
      const blocks = data.blocks || data.template?.blocks || []
      setSelectedTemplate({ ...template, blocks })
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingBlocks(false)
    }
  }

  const toggleBlock = (blockId: string) => {
    setSelectedBlockIds((prev) => {
      const next = new Set(prev)
      if (next.has(blockId)) {
        next.delete(blockId)
      } else {
        next.add(blockId)
      }
      return next
    })
  }

  const selectAll = () => {
    if (!selectedTemplate?.blocks) return
    setSelectedBlockIds(new Set(selectedTemplate.blocks.map((b) => b.id)))
  }

  const clearAll = () => {
    setSelectedBlockIds(new Set())
  }

  const handleImport = () => {
    if (!selectedTemplate?.blocks) return
    const blocksToImport = selectedTemplate.blocks
      .filter((b) => selectedBlockIds.has(b.id))
      .map(cloneBlockWithNewId)
    onImport(blocksToImport)
    onOpenChange(false)
  }

  const folderMap = new Map(folders.map((f) => [f.id, f.name]))

  const groupedTemplates: Record<string, Template[]> = {}
  for (const t of templates) {
    const key = t.folderId && folderMap.has(t.folderId) ? t.folderId : "__none__"
    if (!groupedTemplates[key]) groupedTemplates[key] = []
    groupedTemplates[key].push(t)
  }

  const blocks = selectedTemplate?.blocks || []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Import className="h-5 w-5" />
            ייבוא בלוקים מתבנית אחרת
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 min-h-[300px]">
          {/* Left panel - Template list (visually right in RTL) */}
          <div className="border-b sm:border-b-0 sm:border-l border-gray-200 max-h-[400px] overflow-y-auto p-2">
            <p className="text-xs text-gray-500 font-medium mb-2 px-1">תבניות</p>
            {loading ? (
              <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
                טוען...
              </div>
            ) : templates.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
                אין תבניות זמינות
              </div>
            ) : (
              <>
                {Object.entries(groupedTemplates).map(([key, groupTemplates]) => (
                  <div key={key} className="mb-2">
                    <div className="flex items-center gap-1.5 px-1 py-1 text-xs font-medium text-gray-500">
                      <FolderOpen className="h-3.5 w-3.5" />
                      {key === "__none__" ? "ללא תיקייה" : folderMap.get(key)}
                    </div>
                    {groupTemplates.map((template) => (
                      <button
                        key={template.id}
                        onClick={() => handleSelectTemplate(template)}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-right transition-colors cursor-pointer ${
                          selectedTemplate?.id === template.id
                            ? "bg-blue-50 text-blue-700 font-medium"
                            : "hover:bg-gray-50 text-gray-700"
                        }`}
                      >
                        <FileText className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{template.name}</span>
                      </button>
                    ))}
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Right panel - Block selection (visually left in RTL) */}
          <div className="max-h-[400px] overflow-y-auto p-2">
            {!selectedTemplate ? (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                בחר תבנית מהרשימה
              </div>
            ) : loadingBlocks ? (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                טוען בלוקים...
              </div>
            ) : blocks.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                אין בלוקים בתבנית זו
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-2 px-1">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={selectAll}
                      className="text-xs text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      בחר הכל
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      onClick={clearAll}
                      className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      נקה הכל
                    </button>
                  </div>
                  {selectedBlockIds.size > 0 && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                      {selectedBlockIds.size} נבחרו
                    </span>
                  )}
                </div>

                <div className="space-y-0.5">
                  {blocks.map((block) => {
                    const isSelected = selectedBlockIds.has(block.id)
                    const snippet = getBlockSnippet(block)
                    return (
                      <button
                        key={block.id}
                        onClick={() => toggleBlock(block.id)}
                        className={`w-full flex items-center gap-2 p-2 rounded-md text-right transition-colors cursor-pointer ${
                          isSelected
                            ? "bg-blue-50"
                            : "hover:bg-gray-50"
                        }`}
                      >
                        <div
                          className={`h-4 w-4 shrink-0 rounded border flex items-center justify-center transition-colors ${
                            isSelected
                              ? "bg-blue-600 border-blue-600"
                              : "border-gray-300 bg-white"
                          }`}
                        >
                          {isSelected && <Check className="h-3 w-3 text-white" />}
                        </div>
                        <span className="text-xs font-medium text-gray-500 shrink-0">
                          {BLOCK_TYPE_LABELS[block.type] || block.type}
                        </span>
                        {snippet && (
                          <span className="text-xs text-gray-400 truncate">
                            {snippet}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        <DialogFooter>
          <div className="flex items-center justify-between w-full gap-2">
            <div>
              {selectedBlockIds.size > 0 && (
                <span className="text-sm text-gray-600">
                  {selectedBlockIds.size} בלוקים נבחרו
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                ביטול
              </Button>
              <Button
                size="sm"
                onClick={handleImport}
                disabled={selectedBlockIds.size === 0}
                className="gap-1.5"
              >
                <Import className="h-4 w-4" />
                ייבוא
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
