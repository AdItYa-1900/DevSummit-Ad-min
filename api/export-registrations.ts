import type { Request, Response } from 'express'
import { createClient } from '@supabase/supabase-js'
import { jsPDF } from 'jspdf'

export default async function handler(req: Request, res: Response) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-password')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const adminPassword = process.env.VITE_ADMIN_PASSWORD
  const providedPassword = req.headers['x-admin-password'] as string
  if (!adminPassword || providedPassword !== adminPassword) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Database not configured' })
  }

  const { eventId } = req.body as { eventId?: string }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    // Fetch events
    const { data: events } = await supabase.from('events').select('id, title, slug')
    const eventMap: Record<string, string> = {}
    if (events) {
      for (const e of events as Array<{ id: string; title: string }>) {
        eventMap[e.id] = e.title
      }
    }

    // Build query
    let query = supabase
      .from('registrations')
      .select('*')
      .order('created_at', { ascending: false })

    if (eventId) {
      query = query.eq('event_id', eventId)
    }

    const { data: registrations, error: regError } = await query

    if (regError) {
      return res.status(500).json({ error: regError.message })
    }

    const rows = (registrations || []) as Array<Record<string, unknown>>
    const eventTitle = eventId ? (eventMap[eventId] || 'Event') : 'All Events'

    // Generate PDF
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    const pageW = 297
    const margin = 10

    // Title
    doc.setFontSize(18)
    doc.setTextColor(40, 40, 40)
    doc.text(`DevSummit 3.0 — ${eventTitle} Registrations`, margin, 18)

    doc.setFontSize(10)
    doc.setTextColor(100, 100, 100)
    doc.text(`Generated: ${new Date().toLocaleString('en-IN')}  |  Total: ${rows.length}`, margin, 25)

    // Table headers
    const headers = ['#', 'Name', 'Email', 'Phone', 'College', 'Team', 'Count', 'Txn ID', 'Verified', 'Date']
    const colWidths = [8, 30, 50, 28, 40, 30, 12, 35, 16, 28]

    let y = 32

    const drawHeader = () => {
      doc.setFillColor(50, 50, 60)
      doc.rect(margin, y - 4, pageW - margin * 2, 7, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(7.5)
      let x = margin + 1
      for (let i = 0; i < headers.length; i++) {
        doc.text(headers[i], x, y)
        x += colWidths[i]
      }
      y += 5
    }

    drawHeader()

    doc.setTextColor(40, 40, 40)
    doc.setFontSize(7)

    for (let idx = 0; idx < rows.length; idx++) {
      const r = rows[idx]

      if (y > 195) {
        doc.addPage()
        y = 15
        drawHeader()
        doc.setTextColor(40, 40, 40)
        doc.setFontSize(7)
      }

      // Alternating row colors
      if (idx % 2 === 0) {
        doc.setFillColor(245, 245, 248)
        doc.rect(margin, y - 3.5, pageW - margin * 2, 6, 'F')
      }

      let x = margin + 1
      const values = [
        String(idx + 1),
        truncate(String(r.name || ''), 20),
        truncate(String(r.email || ''), 32),
        String(r.phone || ''),
        truncate(String(r.college || ''), 26),
        truncate(String(r.team_name || '-'), 18),
        String(r.participants_count || ''),
        truncate(String(r.transaction_id || '-'), 22),
        r.verified ? 'Yes' : 'No',
        r.created_at ? new Date(r.created_at as string).toLocaleDateString('en-IN') : '-',
      ]

      for (let i = 0; i < values.length; i++) {
        doc.text(values[i], x, y)
        x += colWidths[i]
      }
      y += 6
    }

    // Summary page
    doc.addPage()
    doc.setFontSize(16)
    doc.setTextColor(40, 40, 40)
    doc.text('Registration Summary', margin, 18)

    doc.setFontSize(11)
    let sy = 30

    doc.text(`Total Registrations: ${rows.length}`, margin, sy)
    sy += 8
    doc.text(`Verified: ${rows.filter(r => r.verified).length}`, margin, sy)
    sy += 8
    doc.text(`Pending: ${rows.filter(r => !r.verified).length}`, margin, sy)
    sy += 14

    // By event breakdown
    if (!eventId) {
      doc.setFontSize(13)
      doc.text('By Event:', margin, sy)
      sy += 8
      doc.setFontSize(10)
      const byEvent = new Map<string, number>()
      for (const r of rows) {
        const label = eventMap[r.event_id as string] || (r.event_id as string)
        byEvent.set(label, (byEvent.get(label) || 0) + 1)
      }
      for (const [label, count] of byEvent.entries()) {
        doc.text(`  ${label}: ${count}`, margin, sy)
        sy += 7
      }
      sy += 7
    }

    // By college breakdown
    doc.setFontSize(13)
    doc.text('By College:', margin, sy)
    sy += 8
    doc.setFontSize(10)
    const byCollege = new Map<string, number>()
    for (const r of rows) {
      const key = ((r.college as string) || 'Unknown').trim()
      byCollege.set(key, (byCollege.get(key) || 0) + 1)
    }
    const sortedColleges = Array.from(byCollege.entries()).sort((a, b) => b[1] - a[1])
    for (const [label, count] of sortedColleges) {
      if (sy > 195) {
        doc.addPage()
        sy = 15
      }
      doc.text(`  ${label}: ${count}`, margin, sy)
      sy += 7
    }

    const pdfOutput = doc.output('arraybuffer')
    const buffer = Buffer.from(pdfOutput)

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="DevSummit3-${eventTitle.replace(/\s+/g, '-')}-Registrations.pdf"`)
    return res.status(200).send(buffer)
  } catch (err) {
    console.error('[export-pdf] Error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return res.status(500).json({ error: 'Internal server error', details: message })
  }
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + '…' : str
}
