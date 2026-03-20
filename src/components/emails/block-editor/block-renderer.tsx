"use client"

import type { EmailBlock } from "./types"
import { blocksToHtml } from "./blocks-to-html"
import { useRef, useEffect } from "react"

interface BlockRendererProps {
  blocks: EmailBlock[]
}

export function BlockRenderer({ blocks }: BlockRendererProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const html = blocksToHtml(blocks)

  useEffect(() => {
    if (!iframeRef.current) return
    const doc = iframeRef.current.contentDocument
    if (!doc) return
    doc.open()
    doc.write(html)
    doc.close()

    const resizeObserver = new ResizeObserver(() => {
      if (iframeRef.current && doc.body) {
        iframeRef.current.style.height = `${doc.body.scrollHeight + 40}px`
      }
    })

    if (doc.body) resizeObserver.observe(doc.body)
    return () => resizeObserver.disconnect()
  }, [html])

  return (
    <div className="bg-gray-100 rounded-lg p-4">
      <div className="bg-white rounded-lg shadow-sm overflow-hidden max-w-[680px] mx-auto">
        <iframe
          ref={iframeRef}
          className="w-full border-0"
          style={{ minHeight: "400px" }}
          title="תצוגה מקדימה"
          sandbox="allow-same-origin"
        />
      </div>
    </div>
  )
}
