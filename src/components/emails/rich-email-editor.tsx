"use client"

import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Link from "@tiptap/extension-link"
import TextAlign from "@tiptap/extension-text-align"
import Underline from "@tiptap/extension-underline"
import { TextStyle } from "@tiptap/extension-text-style"
import Color from "@tiptap/extension-color"
import Image from "@tiptap/extension-image"
import { VariableBadge, EMAIL_VARIABLES } from "./variable-badge-extension"
import { cn } from "@/lib/utils"
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  AlignRight, AlignCenter, AlignLeft,
  List, ListOrdered, Minus, Link as LinkIcon,
  ImageIcon, Type, Heading1, Heading2, Heading3,
  Undo, Redo, Code, Eye, Paintbrush,
} from "lucide-react"
import { useState, useEffect, useCallback, useRef } from "react"

type EditorMode = "visual" | "code" | "preview"

const BODY_START = "<!-- BODY_START -->"
const BODY_END = "<!-- BODY_END -->"

/** חילוץ הגוף מתוך HTML מייל מלא */
function extractBody(html: string): string | null {
  const startIdx = html.indexOf(BODY_START)
  const endIdx = html.indexOf(BODY_END)
  if (startIdx === -1 || endIdx === -1) return null
  return html.substring(startIdx + BODY_START.length, endIdx).trim()
}

/** הזרקת גוף חדש בתוך שלד HTML קיים */
function injectBody(fullHtml: string, newBody: string): string {
  const startIdx = fullHtml.indexOf(BODY_START)
  const endIdx = fullHtml.indexOf(BODY_END)
  if (startIdx === -1 || endIdx === -1) return fullHtml
  return fullHtml.substring(0, startIdx + BODY_START.length) + "\n" + newBody + "\n" + fullHtml.substring(endIdx)
}

interface RichEmailEditorProps {
  content: string
  onChange: (html: string) => void
  placeholder?: string
}

export function RichEmailEditor({ content, onChange }: RichEmailEditorProps) {
  // האם יש markers? אם כן — תמיכה מלאה בויזואלי
  const hasMarkers = content.includes(BODY_START) && content.includes(BODY_END)
  // HTML מייל בלי markers — רק code+preview
  const isLegacyFullHtml = !hasMarkers && (content.includes("<table") || content.includes("<!DOCTYPE"))

  const [mode, setMode] = useState<EditorMode>(
    hasMarkers ? "visual" : isLegacyFullHtml ? "preview" : "visual"
  )
  const [codeContent, setCodeContent] = useState(content)
  // שלד העיצוב — שמור בנפרד
  const shellRef = useRef(content)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // תוכן הגוף בלבד (לעורך הויזואלי)
  const initialBody = hasMarkers ? (extractBody(content) || "") : content

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Link.configure({ openOnClick: false }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Underline,
      TextStyle,
      Color,
      Image,
      VariableBadge,
    ],
    content: initialBody,
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none min-h-[200px] sm:min-h-[300px] p-3 sm:p-4 focus:outline-none [direction:rtl]",
      },
    },
    onUpdate: ({ editor: ed }) => {
      const bodyHtml = ed.getHTML()
      if (hasMarkers) {
        // הזרקה חזרה לשלד
        const full = injectBody(shellRef.current, bodyHtml)
        shellRef.current = full
        setCodeContent(full)
        onChange(full)
      } else {
        setCodeContent(bodyHtml)
        onChange(bodyHtml)
      }
    },
  })

  // סנכרון בין מצבים
  const switchMode = useCallback((newMode: EditorMode) => {
    if (newMode === "visual" && isLegacyFullHtml) return

    if (mode === "visual" && newMode !== "visual" && editor) {
      // שמירת תוכן ויזואלי → code
      const bodyHtml = editor.getHTML()
      if (hasMarkers) {
        const full = injectBody(shellRef.current, bodyHtml)
        shellRef.current = full
        setCodeContent(full)
      } else {
        setCodeContent(bodyHtml)
      }
    }

    if (mode === "code" && newMode === "visual" && editor) {
      // code → ויזואלי: חילוץ הגוף בלבד
      shellRef.current = codeContent
      const body = extractBody(codeContent)
      if (body !== null) {
        editor.commands.setContent(body)
      } else {
        editor.commands.setContent(codeContent)
      }
    }

    if (mode === "code" && newMode === "preview") {
      onChange(codeContent)
    }

    setMode(newMode)
  }, [mode, editor, codeContent, onChange, hasMarkers, isLegacyFullHtml])

  // עדכון iframe בתצוגה מקדימה
  useEffect(() => {
    if (mode === "preview" && iframeRef.current) {
      const doc = iframeRef.current.contentDocument
      if (doc) {
        doc.open()
        doc.write(codeContent)
        doc.close()
      }
    }
  }, [mode, codeContent])

  const insertVariable = useCallback((varName: string, label: string) => {
    if (mode === "code") {
      const tag = `{{${varName}}}`
      setCodeContent(prev => {
        const updated = prev + tag
        onChange(updated)
        return updated
      })
      return
    }
    if (!editor) return
    editor.chain().focus().insertContent({
      type: "variableBadge",
      attrs: { varName, label },
    }).run()
  }, [editor, mode, onChange])

  const addLink = useCallback(() => {
    if (!editor) return
    const url = prompt("הזן כתובת URL:")
    if (!url) return
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run()
  }, [editor])

  const addImage = useCallback(() => {
    if (!editor) return
    const url = prompt("הזן כתובת URL לתמונה:")
    if (!url) return
    editor.chain().focus().setImage({ src: url }).run()
  }, [editor])

  if (!editor) return null

  const ToolBtn = ({ onClick, active, children, title }: { onClick: () => void; active?: boolean; children: React.ReactNode; title?: string }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "p-2 sm:p-1.5 rounded hover:bg-gray-100 transition-colors min-h-[36px] min-w-[36px] sm:min-h-0 sm:min-w-0 flex items-center justify-center",
        active && "bg-gray-200 text-blue-600"
      )}
    >
      {children}
    </button>
  )

  const TabBtn = ({ tabMode, icon: Icon, label }: { tabMode: EditorMode; icon: React.ElementType; label: string }) => (
    <button
      type="button"
      onClick={() => switchMode(tabMode)}
      className={cn(
        "flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-2 sm:py-1.5 text-xs sm:text-sm font-medium rounded-t-lg transition-colors border-b-2 min-h-[40px] sm:min-h-0",
        mode === tabMode
          ? "bg-white text-blue-700 border-blue-600"
          : "bg-gray-100 text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50"
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  )

  return (
    <div className="border rounded-lg overflow-hidden bg-white">
      {/* Mode tabs */}
      <div className="bg-gray-100 px-2 pt-2 flex gap-1 border-b">
        {!isLegacyFullHtml && (
          <TabBtn tabMode="visual" icon={Paintbrush} label="ויזואלי" />
        )}
        <TabBtn tabMode="code" icon={Code} label="HTML קוד" />
        <TabBtn tabMode="preview" icon={Eye} label="תצוגה מקדימה" />
      </div>

      {/* הודעה על עריכת טקסט בלבד */}
      {mode === "visual" && hasMarkers && (
        <div className="bg-orange-50 border-b border-orange-100 px-3 py-1.5 text-xs text-blue-600">
          עורך את תוכן המייל בלבד — העיצוב נשמר אוטומטית
        </div>
      )}

      {/* Visual mode */}
      {mode === "visual" && (
        <>
          {/* Toolbar */}
          <div className="border-b bg-gray-50 px-1.5 sm:px-2 py-1.5 flex flex-wrap items-center gap-0.5 sm:gap-0.5">
            <ToolBtn onClick={() => editor.chain().focus().undo().run()} title="ביטול">
              <Undo className="h-4 w-4" />
            </ToolBtn>
            <ToolBtn onClick={() => editor.chain().focus().redo().run()} title="שחזור">
              <Redo className="h-4 w-4" />
            </ToolBtn>

            <span className="w-px h-5 bg-gray-300 mx-1" />

            <ToolBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="מודגש">
              <Bold className="h-4 w-4" />
            </ToolBtn>
            <ToolBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="נטוי">
              <Italic className="h-4 w-4" />
            </ToolBtn>
            <ToolBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="קו תחתי">
              <UnderlineIcon className="h-4 w-4" />
            </ToolBtn>
            <ToolBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="קו חוצה">
              <Strikethrough className="h-4 w-4" />
            </ToolBtn>

            <span className="w-px h-5 bg-gray-300 mx-1" />

            <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive("heading", { level: 1 })} title="כותרת 1">
              <Heading1 className="h-4 w-4" />
            </ToolBtn>
            <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="כותרת 2">
              <Heading2 className="h-4 w-4" />
            </ToolBtn>
            <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} title="כותרת 3">
              <Heading3 className="h-4 w-4" />
            </ToolBtn>

            <span className="w-px h-5 bg-gray-300 mx-1" />

            <ToolBtn onClick={() => editor.chain().focus().setTextAlign("right").run()} active={editor.isActive({ textAlign: "right" })} title="יישור לימין">
              <AlignRight className="h-4 w-4" />
            </ToolBtn>
            <ToolBtn onClick={() => editor.chain().focus().setTextAlign("center").run()} active={editor.isActive({ textAlign: "center" })} title="מרכז">
              <AlignCenter className="h-4 w-4" />
            </ToolBtn>
            <ToolBtn onClick={() => editor.chain().focus().setTextAlign("left").run()} active={editor.isActive({ textAlign: "left" })} title="יישור לשמאל">
              <AlignLeft className="h-4 w-4" />
            </ToolBtn>

            <span className="w-px h-5 bg-gray-300 mx-1" />

            <ToolBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="רשימת נקודות">
              <List className="h-4 w-4" />
            </ToolBtn>
            <ToolBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="רשימה ממוספרת">
              <ListOrdered className="h-4 w-4" />
            </ToolBtn>

            <span className="w-px h-5 bg-gray-300 mx-1" />

            <ToolBtn onClick={addLink} active={editor.isActive("link")} title="קישור">
              <LinkIcon className="h-4 w-4" />
            </ToolBtn>
            <ToolBtn onClick={addImage} title="תמונה">
              <ImageIcon className="h-4 w-4" />
            </ToolBtn>
            <ToolBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="קו מפריד">
              <Minus className="h-4 w-4" />
            </ToolBtn>

            <span className="w-px h-5 bg-gray-300 mx-1" />

            <label className="p-1.5 rounded hover:bg-gray-100 cursor-pointer" title="צבע טקסט">
              <Type className="h-4 w-4" style={{ color: editor.getAttributes("textStyle").color || "#000" }} />
              <input
                type="color"
                className="sr-only"
                onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
              />
            </label>
          </div>

          {/* Variables bar */}
          <div className="border-b bg-orange-50/50 px-2 sm:px-3 py-2 flex flex-wrap gap-1 sm:gap-1.5">
            <span className="text-xs text-muted-foreground ml-2 self-center">משתנים:</span>
            {EMAIL_VARIABLES.map((v) => (
              <button
                key={v.name}
                type="button"
                onClick={() => insertVariable(v.name, v.label)}
                className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-orange-100 text-blue-800 hover:bg-blue-200 transition-colors cursor-pointer border border-blue-200"
              >
                {v.label}
              </button>
            ))}
          </div>

          <EditorContent editor={editor} />
        </>
      )}

      {/* Code mode */}
      {mode === "code" && (
        <>
          {/* Variables bar in code mode too */}
          <div className="border-b bg-orange-50/50 px-2 sm:px-3 py-2 flex flex-wrap gap-1 sm:gap-1.5">
            <span className="text-xs text-muted-foreground ml-2 self-center">הוסף משתנה:</span>
            {EMAIL_VARIABLES.map((v) => (
              <button
                key={v.name}
                type="button"
                onClick={() => insertVariable(v.name, v.label)}
                className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-orange-100 text-blue-800 hover:bg-blue-200 transition-colors cursor-pointer border border-blue-200"
              >
                {v.label}
              </button>
            ))}
          </div>

          <textarea
            value={codeContent}
            onChange={(e) => {
              const val = e.target.value
              setCodeContent(val)
              shellRef.current = val
              onChange(val)
            }}
            className="w-full min-h-[250px] sm:min-h-[400px] p-3 sm:p-4 font-mono text-xs sm:text-sm bg-[#1e1e1e] text-[#d4d4d4] focus:outline-none resize-y"
            dir="ltr"
            spellCheck={false}
            placeholder="הדבק כאן HTML מעוצב או כתוב קוד..."
          />
        </>
      )}

      {/* Preview mode */}
      {mode === "preview" && (
        <div className="bg-gray-100 p-2 sm:p-4 min-h-[250px] sm:min-h-[400px]">
          <div className="bg-white rounded-lg shadow-sm overflow-hidden max-w-[600px] mx-auto">
            <iframe
              ref={iframeRef}
              className="w-full border-0"
              style={{ minHeight: "400px" }}
              title="תצוגה מקדימה"
              sandbox="allow-same-origin"
            />
          </div>
        </div>
      )}
    </div>
  )
}
