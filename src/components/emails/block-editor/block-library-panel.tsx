"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { X, BookOpen, ChevronDown, ChevronLeft, Plus, FolderOpen, FileText, Loader2 } from "lucide-react"
import type { EmailBlock } from "./types"
import { cloneBlockWithNewId } from "./utils"

interface BlockLibraryPanelProps {
  open: boolean
  onClose: () => void
  onAddBlock: (block: EmailBlock) => void
  currentTemplateId?: string
}

interface TemplateItem {
  id: string
  name: string
  folderId?: string | null
}

interface FolderItem {
  id: string
  name: string
  key: string
  _count?: { templates: number }
}

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

function getBlockSnippet(block: EmailBlock): string {
  const text = (block as any).text || (block as any).name || ""
  if (!text) return ""
  const plain = text.replace(/<[^>]*>/g, "")
  return plain.length > 40 ? plain.slice(0, 40) + "..." : plain
}

export function BlockLibraryPanel({
  open,
  onClose,
  onAddBlock,
  currentTemplateId,
}: BlockLibraryPanelProps) {
  const [folders, setFolders] = useState<FolderItem[]>([])
  const [templates, setTemplates] = useState<TemplateItem[]>([])
  const [expandedTemplates, setExpandedTemplates] = useState<Set<string>>(new Set())
  const [blocksCache, setBlocksCache] = useState<Record<string, EmailBlock[]>>({})
  const [loadingBlocks, setLoadingBlocks] = useState<Set<string>>(new Set())
  const [initialLoading, setInitialLoading] = useState(false)
  const [fetched, setFetched] = useState(false)

  useEffect(() => {
    if (open && !fetched) {
      fetchData()
    }
  }, [open, fetched])

  async function fetchData() {
    setInitialLoading(true)
    try {
      const [foldersRes, templatesRes] = await Promise.all([
        fetch("/api/emails/folders"),
        fetch("/api/emails/templates"),
      ])
      if (foldersRes.ok) {
        const data = await foldersRes.json()
        setFolders(data)
      }
      if (templatesRes.ok) {
        const data = await templatesRes.json()
        setTemplates(data)
      }
      setFetched(true)
    } catch (err) {
      console.error("Failed to fetch library data:", err)
    } finally {
      setInitialLoading(false)
    }
  }

  async function toggleTemplate(templateId: string) {
    const next = new Set(expandedTemplates)
    if (next.has(templateId)) {
      next.delete(templateId)
      setExpandedTemplates(next)
      return
    }

    next.add(templateId)
    setExpandedTemplates(next)

    if (!blocksCache[templateId]) {
      setLoadingBlocks((prev) => new Set(prev).add(templateId))
      try {
        const res = await fetch(`/api/emails/templates/${templateId}`)
        if (res.ok) {
          const data = await res.json()
          const blocks: EmailBlock[] = Array.isArray(data.blocks) ? data.blocks : []
          setBlocksCache((prev) => ({ ...prev, [templateId]: blocks }))
        }
      } catch (err) {
        console.error("Failed to fetch template blocks:", err)
      } finally {
        setLoadingBlocks((prev) => {
          const s = new Set(prev)
          s.delete(templateId)
          return s
        })
      }
    }
  }

  const filteredTemplates = templates.filter((t) => t.id !== currentTemplateId)

  function getTemplatesForFolder(folderId: string) {
    return filteredTemplates.filter((t) => t.folderId === folderId)
  }

  const unfiledTemplates = filteredTemplates.filter((t) => !t.folderId)

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/30 z-40"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        className={`fixed top-0 left-0 h-full w-80 max-w-[85vw] bg-white shadow-xl z-50 flex flex-col transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        dir="rtl"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-blue-600" />
            <h2 className="font-bold text-lg">ספריית בלוקים</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1">
          {initialLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <>
              {/* Folders */}
              {folders.map((folder) => {
                const folderTemplates = getTemplatesForFolder(folder.id)
                if (folderTemplates.length === 0) return null
                return (
                  <div key={folder.id} className="border-b">
                    <div className="flex items-center gap-2 p-3 bg-gray-50">
                      <FolderOpen className="h-4 w-4 text-gray-500" />
                      <span className="font-medium text-sm text-gray-700">
                        {folder.name}
                      </span>
                    </div>
                    {folderTemplates.map((template) => (
                      <TemplateRow
                        key={template.id}
                        template={template}
                        expanded={expandedTemplates.has(template.id)}
                        blocks={blocksCache[template.id]}
                        loading={loadingBlocks.has(template.id)}
                        onToggle={() => toggleTemplate(template.id)}
                        onAddBlock={onAddBlock}
                      />
                    ))}
                  </div>
                )
              })}

              {/* Unfiled templates */}
              {unfiledTemplates.length > 0 && (
                <div className="border-b">
                  <div className="flex items-center gap-2 p-3 bg-gray-50">
                    <FileText className="h-4 w-4 text-gray-500" />
                    <span className="font-medium text-sm text-gray-700">
                      ללא תיקייה
                    </span>
                  </div>
                  {unfiledTemplates.map((template) => (
                    <TemplateRow
                      key={template.id}
                      template={template}
                      expanded={expandedTemplates.has(template.id)}
                      blocks={blocksCache[template.id]}
                      loading={loadingBlocks.has(template.id)}
                      onToggle={() => toggleTemplate(template.id)}
                      onAddBlock={onAddBlock}
                    />
                  ))}
                </div>
              )}

              {filteredTemplates.length === 0 && (
                <div className="p-8 text-center text-gray-400 text-sm">
                  אין תבניות זמינות
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}

function TemplateRow({
  template,
  expanded,
  blocks,
  loading,
  onToggle,
  onAddBlock,
}: {
  template: TemplateItem
  expanded: boolean
  blocks?: EmailBlock[]
  loading: boolean
  onToggle: () => void
  onAddBlock: (block: EmailBlock) => void
}) {
  return (
    <div>
      <div
        className="cursor-pointer hover:bg-gray-100 p-2 flex items-center justify-between"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2 text-sm min-w-0">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
          ) : (
            <ChevronLeft className="h-4 w-4 text-gray-400 shrink-0" />
          )}
          <span className="truncate">{template.name}</span>
        </div>
      </div>

      {expanded && (
        <div>
          {loading ? (
            <div className="flex items-center justify-center p-3">
              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
            </div>
          ) : blocks && blocks.length > 0 ? (
            blocks.map((block, idx) => (
              <div
                key={block.id || idx}
                className="flex items-center gap-2 p-2 pr-8 hover:bg-blue-50 text-sm"
              >
                <span className="font-medium text-gray-700 shrink-0">
                  {BLOCK_TYPE_LABELS[block.type] || block.type}
                </span>
                <span className="text-gray-400 truncate min-w-0">
                  {getBlockSnippet(block)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="mr-auto shrink-0 h-7 w-7 p-0"
                  onClick={(e) => {
                    e.stopPropagation()
                    onAddBlock(cloneBlockWithNewId(block))
                  }}
                  title="הוסף בלוק"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))
          ) : (
            <div className="p-3 pr-8 text-xs text-gray-400">
              אין בלוקים בתבנית זו
            </div>
          )}
        </div>
      )}
    </div>
  )
}
