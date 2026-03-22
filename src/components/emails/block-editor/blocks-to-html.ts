import type { EmailBlock, ButtonConfig } from "./types"

const BUTTON_COLORS: Record<ButtonConfig["color"], { bg: string; border: string }> = {
  gold: { bg: "linear-gradient(145deg,#124F90,#0A3D6E)", border: "#0A3D6E" },
  green: { bg: "linear-gradient(145deg,#43a047,#2e7d32)", border: "#1b5e20" },
  red: { bg: "linear-gradient(145deg,#e53935,#c62828)", border: "#8e0000" },
  blue: { bg: "linear-gradient(145deg,#124F90,#0A3D6E)", border: "#0A3D6E" },
}

const BANNER_STYLES: Record<string, { bg: string; border: string; color: string }> = {
  orange: {
    bg: "linear-gradient(135deg,#124F90,#1A6AB5,#7BADD4)",
    border: "#124F90",
    color: "#ffffff",
  },
  blue: {
    bg: "#EBF1F9",
    border: "#124F90",
    color: "#124F90",
  },
  red: {
    bg: "#fff5f5",
    border: "#e53935",
    color: "#b71c1c",
  },
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\n/g, "<br>")
}

function renderBlockToHtml(block: EmailBlock): string {
  switch (block.type) {
    case "heading":
      if (block.layout === "split" && block.textLeft) {
        return `<table width="100%" cellpadding="0" cellspacing="0" dir="rtl" style="margin-bottom:15px;"><tr><td align="right" style="font-size:24px;font-weight:bold;color:#124F90;width:50%;">${escapeHtml(block.text)}</td><td align="left" style="font-size:24px;font-weight:bold;color:#124F90;width:50%;font-family:Arial;" dir="ltr">${escapeHtml(block.textLeft)}</td></tr></table>`
      }
      return `<div style="font-size:18px;font-weight:bold;text-align:center;color:#124F90;padding:14px;box-sizing:border-box;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(block.text)}</div>`

    case "banner": {
      const style = BANNER_STYLES[block.color] || BANNER_STYLES.orange
      const isGradient = style.bg.includes("gradient")
      return `<div style="margin:24px 0;text-align:center;font-size:18px;font-weight:bold;color:${style.color};border:2px solid ${style.border};border-radius:10px;padding:12px;${isGradient ? `background:${style.bg}` : `background-color:${style.bg}`};box-shadow:0 3px 10px rgba(0,0,0,0.12);">${escapeHtml(block.text)}</div>`
    }

    case "paragraph": {
      // Allow <b>, <i>, <u> tags in paragraphs
      const safeText = block.text
        .replace(/<b>/gi, "%%BOLD_OPEN%%")
        .replace(/<\/b>/gi, "%%BOLD_CLOSE%%")
        .replace(/<i>/gi, "%%ITALIC_OPEN%%")
        .replace(/<\/i>/gi, "%%ITALIC_CLOSE%%")
        .replace(/<u>/gi, "%%UNDER_OPEN%%")
        .replace(/<\/u>/gi, "%%UNDER_CLOSE%%")
      const escaped = escapeHtml(safeText)
        .replace(/%%BOLD_OPEN%%/g, "<b>")
        .replace(/%%BOLD_CLOSE%%/g, "</b>")
        .replace(/%%ITALIC_OPEN%%/g, "<i>")
        .replace(/%%ITALIC_CLOSE%%/g, "</i>")
        .replace(/%%UNDER_OPEN%%/g, "<u>")
        .replace(/%%UNDER_CLOSE%%/g, "</u>")
      const align = block.align || "right"
      return `<p style="margin:0 0 12px 0;text-align:${align};">${escaped}</p>`
    }

    case "folder": {
      const align = block.align || "right"
      const marginMap = { right: "0 0 12px auto", center: "0 auto 12px auto", left: "0 auto 12px 0" }
      const textAlignMap = { right: "right", center: "center", left: "left" }
      const header = `<div style="margin:16px ${marginMap[align]};padding:8px 16px;border-radius:8px;background-color:#EBF1F9;border:1px solid #C5D5EA;font-weight:bold;color:#124F90;text-align:${textAlignMap[align]};display:inline-block;">${escapeHtml(block.name)}</div>`
      const wrapper = `<div style="text-align:${textAlignMap[align]};">${header}</div>`
      if (block.items.length === 0) return wrapper
      const items = block.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("\n")
      return `${wrapper}\n<ul>\n${items}\n</ul>`
    }

    case "list": {
      const tag = block.ordered ? "ol" : "ul"
      const items = block.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("\n")
      return `<${tag}>\n${items}\n</${tag}>`
    }

    case "buttons": {
      const width = `${Math.floor(100 / block.buttons.length)}%`
      const cells = block.buttons
        .map((btn) => {
          const colors = BUTTON_COLORS[btn.color] || BUTTON_COLORS.gold
          return `<td align="center" style="padding:5px;width:${width};"><a href="${escapeHtml(btn.url)}" style="background:${colors.bg};color:#fff;text-decoration:none;border-radius:8px;display:block;font-weight:bold;font-size:15px;border:1px solid ${colors.border};text-align:center;padding:12px 0;box-shadow:0 4px 8px rgba(0,0,0,0.15);">${escapeHtml(btn.label)}</a></td>`
        })
        .join("\n")
      return `<div style="font-size:18px;font-weight:bold;color:#124F90;margin-bottom:16px;">הורדות</div>\n<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="width:100%;table-layout:fixed;"><tr>\n${cells}\n</tr></table>`
    }

    case "promo": {
      const priceHtml = block.price
        ? `<p style="text-align:center;">מחיר לאחר המבצע:<br><b>${escapeHtml(block.price)}</b></p>`
        : ""
      const expiryHtml = block.expiry
        ? `<br>המבצע בתוקף עד <b>${escapeHtml(block.expiry)}</b>.`
        : ""
      return `<div style="margin:20px 0;text-align:center;font-size:16px;font-weight:bold;color:#0A3D6E;border-left:2px solid #124F90;border-right:2px solid #124F90;border-radius:10px;padding:14px;background:linear-gradient(135deg,#EBF1F9,#D6E3F5,#C5D5EA,#EBF1F9);box-shadow:0 2px 6px rgba(0,0,0,0.06);"><div style="height:3px;background:linear-gradient(90deg,#EBF1F9,#124F90,#EBF1F9);margin:-14px -14px 14px -14px;border-top-left-radius:10px;border-top-right-radius:10px;"></div>${escapeHtml(block.text)}${expiryHtml}${priceHtml}<div style="height:3px;background:linear-gradient(90deg,#EBF1F9,#124F90,#EBF1F9);margin:14px -14px -14px -14px;border-bottom-left-radius:10px;border-bottom-right-radius:10px;"></div></div>`
    }

    case "bankTable":
      return `<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:14px;"><tr style="background-color:#F6F9FE;"><td style="border:1px solid #D6E3F5;padding:8px;font-weight:bold;">בנק</td><td style="border:1px solid #D6E3F5;padding:8px;">הפועלים</td></tr><tr><td style="border:1px solid #D6E3F5;padding:8px;font-weight:bold;">סניף</td><td style="border:1px solid #D6E3F5;padding:8px;">446</td></tr><tr style="background-color:#F6F9FE;"><td style="border:1px solid #D6E3F5;padding:8px;font-weight:bold;">חשבון</td><td style="border:1px solid #D6E3F5;padding:8px;">113689</td></tr><tr><td style="border:1px solid #D6E3F5;padding:8px;font-weight:bold;">שם</td><td style="border:1px solid #D6E3F5;padding:8px;">חוה גפנר</td></tr></table>`

    case "warning":
      return `<div style="margin:12px 0;padding:12px 14px;border-radius:8px;background-color:#fff8f8;text-align:center;border:1px solid #f0b5b5;color:#c62828;font-weight:bold;" dir="rtl">${escapeHtml(block.text)}</div>`

    case "signature":
      return `<p style="margin-top:24px;">בברכה,<br>מוטי רוזנפלד<br>עדכוני סאונדים ומקצבים לאורגנים | Yamaha</p>`

    case "image":
      if (!block.url) return ""
      return `<div style="margin:12px 0;text-align:center;"><img src="${escapeHtml(block.url)}" alt="${escapeHtml(block.alt)}" style="max-width:100%;height:auto;border-radius:8px;" /></div>`

    case "divider":
      return `<hr style="border:none;border-top:1px solid #C5D5EA;margin:20px 0;" />`

    case "instructions":
      return `<div style="margin:24px 0;text-align:center;font-size:18px;font-weight:bold;color:#124F90;border:2px solid #124F90;border-radius:10px;padding:12px;background-color:#EBF1F9;">הוראות הורדה והתקנה</div>\n<div style="margin:0 0 12px 0;">${escapeHtml(block.text)}</div>`
  }
}

function wrapEmail(bodyContent: string): string {
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#EEF3FB;font-family:'Assistant',Arial,Helvetica,'Segoe UI',Tahoma,sans-serif;color:#124F90;" dir="rtl">
<table width="100%" cellpadding="0" cellspacing="0" bgcolor="#EEF3FB" dir="rtl">
<tr><td align="center" style="padding:10px;">
<div style="max-width:680px;margin:0 auto;padding:28px;border:1px solid #C5D5EA;border-radius:14px;box-shadow:0 4px 14px rgba(0,0,0,0.08);background-color:#ffffff;font-size:16px;line-height:1.8;color:#124F90;" dir="rtl">
<div style="background-color:#F6F9FE;border-radius:0;padding:20px 20px 0 20px;margin:0;">
<div style="font-size:12px;font-weight:bold;color:#8fa3b9;margin-bottom:10px;text-align:right;">בס&quot;ד</div>
<!-- BODY_START -->
${bodyContent}
<!-- BODY_END -->
</div>
</div>
</td></tr>
</table>
</body>
</html>`
}

export function blocksToHtml(blocks: EmailBlock[]): string {
  const bodyParts = blocks.map(renderBlockToHtml).filter(Boolean)
  return wrapEmail(bodyParts.join("\n\n"))
}

export function blocksToBodyHtml(blocks: EmailBlock[]): string {
  return blocks.map(renderBlockToHtml).filter(Boolean).join("\n\n")
}
