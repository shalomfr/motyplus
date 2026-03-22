"use client"

import type { EmailBlock } from "./types"
import { blocksToHtml } from "./blocks-to-html"
import { useRef, useEffect } from "react"

const SAMPLE_VARS: Record<string, string> = {
  fullName: "ישראל ישראלי",
  firstName: "ישראל",
  customerName: "ישראל ישראלי",
  email: "israel@example.com",
  phone: "050-1234567",
  organ: "Genos 2",
  organName: "Genos 2",
  setType: "סט שלם",
  currentVersion: "V3.0",
  updateVersion: "V4.0",
  version: "V4.0",
  releaseDate: "16/03/2026",
  purchaseDate: "01/01/2025",
  updateExpiryDate: "01/01/2026",
  amountPaid: "1,200",
  remainingAmount: "350",
  remainingForFullSet: "₪350",
  samplesLink: "https://drive.google.com/samples",
  rhythmsLink: "https://drive.google.com/rhythms",
  driveLink: "https://drive.google.com/preview",
  youtubeLink: "https://youtube.com/preview",
  customLink: "#",
  customerId: "12345",
  additionalOrganName: "",
  additionalOrganLine: "",
}

const FSI = "\u2068" // First Strong Isolate
const PDI = "\u2069" // Pop Directional Isolate

function replaceVariables(html: string): string {
  let result = html
  for (const [key, value] of Object.entries(SAMPLE_VARS)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), `${FSI}${value}${PDI}`)
  }
  return result
}

interface BlockRendererProps {
  blocks: EmailBlock[]
}

export function BlockRenderer({ blocks }: BlockRendererProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const rawHtml = blocksToHtml(blocks)
  const html = replaceVariables(rawHtml)

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
