"use client"

import { useState } from "react"
import { SegmentCard } from "./segment-card"
import { EmailPreviewSheet } from "./email-preview-sheet"

interface SampleCustomer {
  id: number
  fullName: string
  email: string
  organ: string
  setType: string
}

interface Segment {
  key: string
  label: string
  count: number
  templateName: string | null
  previewSubject: string
  previewBody: string
  sampleCustomers: SampleCustomer[]
  canSend: boolean
  color: string
}

interface StepEmailPreviewProps {
  segments: Segment[]
}

export function StepEmailPreview({ segments }: StepEmailPreviewProps) {
  const [previewSegment, setPreviewSegment] = useState<Segment | null>(null)

  const sendableSegments = segments.filter((s) => s.canSend && s.count > 0)
  const infoSegments = segments.filter((s) => !s.canSend || s.count === 0)

  return (
    <div className="space-y-6">
      {/* Sendable segments */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">
          סגמנטים שיקבלו מייל
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sendableSegments.map((seg) => (
            <SegmentCard
              key={seg.key}
              segmentKey={seg.key}
              label={seg.label}
              count={seg.count}
              templateName={seg.templateName}
              canSend={seg.canSend}
              color={seg.color}
              onPreview={() => setPreviewSegment(seg)}
            />
          ))}
        </div>
      </div>

      {/* Info-only segments */}
      {infoSegments.some((s) => s.count > 0) && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">
            לא ישלחו מייל
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {infoSegments
              .filter((s) => s.count > 0)
              .map((seg) => (
                <SegmentCard
                  key={seg.key}
                  segmentKey={seg.key}
                  label={seg.label}
                  count={seg.count}
                  templateName={seg.templateName}
                  canSend={seg.canSend}
                  color={seg.color}
                  onPreview={() => {}}
                />
              ))}
          </div>
        </div>
      )}

      {/* Preview Dialog */}
      {previewSegment && (
        <EmailPreviewSheet
          open={!!previewSegment}
          onClose={() => setPreviewSegment(null)}
          segmentLabel={previewSegment.label}
          segmentColor={previewSegment.color}
          subject={previewSegment.previewSubject}
          body={previewSegment.previewBody}
          sampleCustomers={previewSegment.sampleCustomers}
        />
      )}
    </div>
  )
}
