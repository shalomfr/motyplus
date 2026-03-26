import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { blocksToHtml } from "@/components/emails/block-editor/blocks-to-html"
import type { EmailBlock } from "@/components/emails/block-editor/types"

// POST /api/emails/templates/rerender — רינדור מחדש של כל התבניות מהבלוקים
export async function POST() {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "לא מורשה" }, { status: 401 })
    }

    const templates = await prisma.emailTemplate.findMany({
      select: { id: true, name: true, blocks: true },
    })

    let updated = 0
    let skipped = 0

    for (const t of templates) {
      const blocks = t.blocks as EmailBlock[] | null
      if (!blocks || !Array.isArray(blocks) || blocks.length === 0) {
        skipped++
        continue
      }

      const body = blocksToHtml(blocks)
      await prisma.emailTemplate.update({
        where: { id: t.id },
        data: { body },
      })
      updated++
    }

    // עדכון גם emailTemplateMap על updateVersions — שם נשמר עותק של ה-body
    const templateBodyMap = new Map<string, string>()
    for (const t of templates) {
      const blocks = t.blocks as EmailBlock[] | null
      if (blocks && Array.isArray(blocks) && blocks.length > 0) {
        templateBodyMap.set(t.name, blocksToHtml(blocks))
      }
    }

    let versionsUpdated = 0
    const versions = await prisma.updateVersion.findMany({
      where: { emailTemplateMap: { not: Prisma.DbNull } },
      select: { id: true, emailTemplateMap: true },
    })

    for (const v of versions) {
      const map = v.emailTemplateMap as Record<string, Record<string, { templateName?: string; subject?: string; body?: string }>> | null
      if (!map) continue

      let changed = false
      for (const segKey of Object.keys(map)) {
        const seg = map[segKey]
        if (!seg || typeof seg !== "object") continue
        for (const organId of Object.keys(seg)) {
          const entry = seg[organId]
          if (entry?.templateName && templateBodyMap.has(entry.templateName)) {
            entry.body = templateBodyMap.get(entry.templateName)!
            changed = true
          }
        }
      }

      if (changed) {
        await prisma.updateVersion.update({
          where: { id: v.id },
          data: { emailTemplateMap: map, emailBody: null },
        })
        versionsUpdated++
      }
    }

    return NextResponse.json({ success: true, updated, skipped, total: templates.length, versionsUpdated })
  } catch (error) {
    console.error("Error re-rendering templates:", error)
    return NextResponse.json({ error: "שגיאה ברינדור תבניות" }, { status: 500 })
  }
}
