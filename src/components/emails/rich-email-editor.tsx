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
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  AlignRight, AlignCenter, AlignLeft,
  List, ListOrdered, Minus, Link as LinkIcon,
  ImageIcon, Type, Heading1, Heading2, Heading3,
  Undo, Redo,
} from "lucide-react"
import { useEffect, useCallback } from "react"

interface RichEmailEditorProps {
  content: string
  onChange: (html: string) => void
  placeholder?: string
}

export function RichEmailEditor({ content, onChange, placeholder }: RichEmailEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Link.configure({ openOnClick: false }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Underline,
      TextStyle,
      Color,
      Image,
      VariableBadge,
    ],
    content,
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none min-h-[250px] p-4 focus:outline-none [direction:rtl]",
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
  })

  // Sync external content changes
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content, false as unknown as undefined)
    }
  }, [content, editor])

  const insertVariable = useCallback((varName: string, label: string) => {
    if (!editor) return
    editor.chain().focus().insertContent({
      type: "variableBadge",
      attrs: { varName, label },
    }).run()
  }, [editor])

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
        "p-1.5 rounded hover:bg-gray-100 transition-colors",
        active && "bg-gray-200 text-blue-600"
      )}
    >
      {children}
    </button>
  )

  return (
    <div className="border rounded-lg overflow-hidden bg-white">
      {/* Toolbar */}
      <div className="border-b bg-gray-50 px-2 py-1.5 flex flex-wrap items-center gap-0.5">
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

        {/* Color picker */}
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
      <div className="border-b bg-orange-50/50 px-3 py-2 flex flex-wrap gap-1.5">
        <span className="text-xs text-muted-foreground ml-2 self-center">משתנים:</span>
        {EMAIL_VARIABLES.map((v) => (
          <button
            key={v.name}
            type="button"
            onClick={() => insertVariable(v.name, v.label)}
            className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 hover:bg-orange-200 transition-colors cursor-pointer border border-orange-200"
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Editor content */}
      <EditorContent editor={editor} />
    </div>
  )
}
