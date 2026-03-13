import { jsPDF } from 'jspdf'

// jsPDF's GState constructor isn't exposed in its published types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const GState = (doc: InstanceType<typeof jsPDF>) => (doc as any).GState as new (opts: { opacity: number }) => object

export interface TicketData {
  eventTitle: string
  eventSubtitle: string
  themeColor: string
  name: string
  email: string
  phone: string
  college: string
  teamName: string
  participantsCount: number
  transactionId: string
  logoUrl: string
  characterUrl: string
  gdgLogoUrl: string
  ticketId?: string
}

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return [100, 100, 100]
  return [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
}

function darken(r: number, g: number, b: number, amt: number): [number, number, number] {
  return [Math.max(0, r - amt), Math.max(0, g - amt), Math.max(0, b - amt)]
}

function lighten(r: number, g: number, b: number, amt: number): [number, number, number] {
  return [Math.min(255, r + amt), Math.min(255, g + amt), Math.min(255, b + amt)]
}

function generateTicketId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let id = ''
  for (let i = 0; i < 8; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return `DS3-${id}`
}

async function loadAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    const buffer = Buffer.from(await response.arrayBuffer())
    const contentType = response.headers.get('content-type') || 'image/png'
    return `data:${contentType};base64,${buffer.toString('base64')}`
  } catch {
    return null
  }
}

// ── Main generator (server-side) ───────────────────

export async function generateTicketPDF(data: TicketData): Promise<Buffer> {
  const siteUrl = process.env.SITE_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000'
  const ticketTimezone = process.env.TICKET_TIMEZONE || 'Asia/Kolkata'

  const W = 280
  const H = 140
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [W, H] })

  const [cr, cg, cb] = hexToRgb(data.themeColor)
  const [dr, dg, db] = darken(cr, cg, cb, 40)
  const [lr, lg, lb] = lighten(cr, cg, cb, 60)
  const ticketId = data.ticketId || generateTicketId()
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: ticketTimezone,
  })
  const timeStr = now.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: ticketTimezone,
  })

  // Load all assets in parallel
  const bambooVertUrl = `${siteUrl}/bamboo-stalk.png`
  const bambooHorizUrl = `${siteUrl}/bamboo-horizontal.png`
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&bgcolor=121218&color=ffffff&data=${encodeURIComponent(ticketId)}`
  const [logoB64, gdgB64, charB64, bambooVertB64, bambooHorizB64, qrB64] = await Promise.all([
    loadAsBase64(data.logoUrl),
    loadAsBase64(data.gdgLogoUrl),
    loadAsBase64(data.characterUrl),
    loadAsBase64(bambooVertUrl),
    loadAsBase64(bambooHorizUrl),
    loadAsBase64(qrUrl)
  ])

  // Use built-in fonts (custom TTF fonts have widths issues in server-side jsPDF)
  const titleFont = 'helvetica'
  const bodyFont = 'helvetica'

  // ══════════════════════════════════════════════════
  // BACKGROUND
  // ══════════════════════════════════════════════════
  doc.setFillColor(18, 18, 24)
  doc.rect(0, 0, W, H, 'F')

  // Inner body fill
  doc.setFillColor(24, 24, 32)
  doc.roundedRect(3, 3, W - 6, H - 6, 4, 4, 'F')

  // ══════════════════════════════════════════════════
  // BAMBOO DECORATIVE BORDERS — Real PNG images
  // ══════════════════════════════════════════════════
  doc.setGState(new (GState(doc))({ opacity: 0.22 }))

  if (bambooVertB64) {
    try {
      doc.addImage(bambooVertB64, 'PNG', 1, 2, 12, H - 4, undefined, 'FAST')
      doc.addImage(bambooVertB64, 'PNG', W - 13, 2, 12, H - 4, undefined, 'FAST')
    } catch { /* skip */ }
  }
  if (bambooHorizB64) {
    try {
      doc.addImage(bambooHorizB64, 'PNG', 10, 0, W - 20, 10, undefined, 'FAST')
      doc.addImage(bambooHorizB64, 'PNG', 10, H - 10, W - 20, 10, undefined, 'FAST')
    } catch { /* skip */ }
  }

  doc.setGState(new (GState(doc))({ opacity: 1 }))

  // ══════════════════════════════════════════════════
  // DECORATIVE BORDERS — Double border with theme color
  // ══════════════════════════════════════════════════
  doc.setDrawColor(cr, cg, cb)
  doc.setLineWidth(0.8)
  doc.roundedRect(5, 5, W - 10, H - 10, 3, 3, 'S')

  doc.setDrawColor(dr, dg, db)
  doc.setLineWidth(0.3)
  doc.roundedRect(8, 8, W - 16, H - 16, 2, 2, 'S')

  // ══════════════════════════════════════════════════
  // TOP HEADER BAND
  // ══════════════════════════════════════════════════
  doc.setFillColor(cr, cg, cb)
  doc.rect(9, 9, W - 18, 26, 'F')

  doc.setFillColor(dr, dg, db)
  doc.rect(9, 32, W - 18, 3, 'F')

  // ══════════════════════════════════════════════════
  // HEADER LOGOS
  // ══════════════════════════════════════════════════
  const gdgLogoH = 18
  const gdgLogoW = gdgLogoH * 2
  if (gdgB64) {
    try {
      const gdgY = 9 + (26 - gdgLogoH) / 2 - (26 * 0.05)
      doc.addImage(gdgB64, 'PNG', 12, gdgY, gdgLogoW, gdgLogoH, undefined, 'FAST')
    } catch { /* skip */ }
  }

  const dsLogoH = 22
  const dsLogoW = dsLogoH * 1.5
  if (logoB64) {
    try {
      const dsX = (W - dsLogoW) / 2
      const dsY = 9 + (26 - dsLogoH) / 2
      doc.addImage(logoB64, 'PNG', dsX, dsY, dsLogoW, dsLogoH, undefined, 'FAST')
    } catch { /* skip */ }
  }

  // Ticket ID & date — right side of header
  doc.setFont(titleFont, 'normal')
  doc.setFontSize(13.8)
  doc.setTextColor(255, 255, 255)
  doc.text(ticketId, W - 15, 20, { align: 'right' })
  doc.setFont(bodyFont, 'normal')
  doc.setFontSize(8.6)
  doc.text(`${dateStr}  |  ${timeStr}`, W - 15, 28, { align: 'right' })

  // ══════════════════════════════════════════════════
  // CHARACTER IMAGE
  // ══════════════════════════════════════════════════
  const charAreaX = W - 78
  const charAreaY = 36
  const charAreaH = H - 46
  const charImgW = 64
  const charCenterX = charAreaX + charImgW / 2
  const charCenterY = charAreaY + charAreaH / 2

  doc.setFillColor(cr, cg, cb)
  doc.setGState(new (GState(doc))({ opacity: 0.07 }))
  doc.circle(charCenterX, charCenterY, 48, 'F')
  doc.setGState(new (GState(doc))({ opacity: 0.12 }))
  doc.circle(charCenterX, charCenterY, 34, 'F')
  doc.setGState(new (GState(doc))({ opacity: 0.18 }))
  doc.circle(charCenterX, charCenterY, 20, 'F')
  doc.setGState(new (GState(doc))({ opacity: 1 }))

  if (charB64) {
    try {
      doc.addImage(charB64, 'PNG', charAreaX, charAreaY, charImgW, charAreaH, undefined, 'FAST')
    } catch { /* skip */ }
  }

  // ══════════════════════════════════════════════════
  // EVENT TITLE
  // ══════════════════════════════════════════════════
  doc.setFont(titleFont, 'normal')
  doc.setFontSize(21.8)
  doc.setTextColor(255, Math.min(255, cg + 150), Math.min(120, cb + 50))
  doc.text(data.eventTitle, 14, 46)

  doc.setFont(bodyFont, 'normal')
  doc.setFontSize(9.8)
  doc.setTextColor(Math.min(255, lr + 30), Math.min(255, lg + 30), Math.min(255, lb + 30))
  doc.text(`"${data.eventSubtitle}"`, 14, 52)

  doc.setDrawColor(cr, cg, cb)
  doc.setLineWidth(0.5)
  doc.line(14, 54, 95, 54)
  doc.setDrawColor(dr, dg, db)
  doc.setLineWidth(0.2)
  doc.line(14, 55, 75, 55)

  // ══════════════════════════════════════════════════
  // DETAILS GRID
  // ══════════════════════════════════════════════════
  const col1 = 14
  const col2 = 74
  const col3 = 138
  let y = 62

  const drawField = (label: string, value: string, x: number, yPos: number, maxWidth?: number) => {
    doc.setFont(bodyFont, 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(Math.min(255, lr - 20), Math.min(255, lg - 20), Math.min(255, lb - 20))
    doc.text(label.toUpperCase(), x, yPos)

    doc.setFont(titleFont, 'normal')
    doc.setFontSize(11)
    doc.setTextColor(255, 255, 255)
    const mw = maxWidth || 55
    const maxChars = Math.floor(mw / 2)
    const display = value.length > maxChars ? value.slice(0, maxChars - 1) + '…' : value
    doc.text(display, x, yPos + 5.5)
  }

  drawField('NAME', data.name, col1, y)
  drawField('TEAM', data.teamName, col2, y)
  drawField('PARTICIPANTS', String(data.participantsCount), col3, y)
  y += 15
  drawField('EMAIL', data.email, col1, y, 55)
  drawField('COLLEGE', data.college, col2, y, 55)
  drawField('PHONE', data.phone, col3, y)
  y += 15

  // ══════════════════════════════════════════════════
  // BOTTOM SECTION
  // ══════════════════════════════════════════════════
  const contentRight = charAreaX - 8
  doc.setDrawColor(60, 60, 72)
  doc.setLineWidth(0.3)
  doc.line(14, y + 2, contentRight, y + 2)

  const bottomY = y + 6
  const qrSize = 24

  const qrBorderPad = 1.2
  doc.setDrawColor(cr, cg, cb)
  doc.setLineWidth(0.6)
  doc.rect(col1 - qrBorderPad, bottomY - qrBorderPad, qrSize + qrBorderPad * 2, qrSize + qrBorderPad * 2, 'S')
  if (qrB64) {
    try {
      doc.addImage(qrB64, 'PNG', col1, bottomY, qrSize, qrSize, undefined, 'FAST')
    } catch { /* skip */ }
  }

  doc.setFont(bodyFont, 'normal')
  doc.setFontSize(7)
  doc.setTextColor(Math.min(255, lr - 20), Math.min(255, lg - 20), Math.min(255, lb - 20))
  doc.text('Scan to verify', col1 + qrSize / 2, bottomY + qrSize + 4, { align: 'center' })

  const infoX = col1 + qrSize + 8
  doc.setFont(bodyFont, 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(Math.min(255, lr - 20), Math.min(255, lg - 20), Math.min(255, lb - 20))
  doc.text('TRANSACTION ID', infoX, bottomY + 2)
  doc.setFont(titleFont, 'normal')
  doc.setFontSize(10.4)
  doc.setTextColor(255, 255, 255)
  doc.text(data.transactionId, infoX, bottomY + 8)

  doc.setFont(bodyFont, 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(Math.min(255, lr - 20), Math.min(255, lg - 20), Math.min(255, lb - 20))
  doc.text('VENUE', infoX, bottomY + 15)
  doc.setFont(titleFont, 'normal')
  doc.setFontSize(10.4)
  doc.setTextColor(255, 255, 255)
  doc.text('Silicon Institute of Technology', infoX, bottomY + 21)

  doc.setFont(bodyFont, 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(Math.min(255, lr - 20), Math.min(255, lg - 20), Math.min(255, lb - 20))
  doc.text('DATE & TIME', col3, bottomY + 2)
  doc.setFont(titleFont, 'normal')
  doc.setFontSize(10.4)
  doc.setTextColor(255, 255, 255)
  doc.text(`${dateStr}  ${timeStr}`, col3, bottomY + 8)

  // ══════════════════════════════════════════════════
  // RETURN PDF AS BUFFER
  // ══════════════════════════════════════════════════
  const arrayBuffer = doc.output('arraybuffer')
  return Buffer.from(arrayBuffer)
}
