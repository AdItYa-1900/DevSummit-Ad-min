import type { Request, Response } from 'express'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { generateTicketPDF } from './ticketPdf'
import type { TicketData } from './ticketPdf'

// ── Event metadata mapping (slug → display data) ──────
// Mirrors src/eventsData.ts for server-side use

interface EventMeta {
  title: string
  subtitle: string
  themeColor: string
  characterImage: string // path relative to public/ OR full cloudinary URL
}

function getEventMeta(slug: string, siteUrl: string, _cloudinaryBase: string): EventMeta | null {
  const events: Record<string, EventMeta> = {
    'web-hunt': {
      title: 'WEB HUNT',
      subtitle: 'Seek and You Shall Find',
      themeColor: '#d4a373',
      characterImage: `${siteUrl}/Kai.png`,
    },
    'capture-the-flag': {
      title: 'CAPTURE THE FLAG',
      subtitle: 'Defend and Conquer',
      themeColor: '#a34a4a',
      characterImage: `${siteUrl}/taiLung-sm.png`,
    },
    'web-atelier': {
      title: 'WEB ATELIER',
      subtitle: 'Craft the Web. Earn the Scroll.',
      themeColor: '#9baaa6',
      characterImage: `${siteUrl}/lordShen-sm.png`,
    },
    'agentic-ai': {
      title: 'AGENTIC AI',
      subtitle: 'Automate the Future',
      themeColor: '#7b72a8',
      characterImage: `${siteUrl}/Chameleon-sm.png`,
    },
  }

  return events[slug] ?? null
}

// ── Supabase webhook payload shape ─────────────────────

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  schema: string
  record: Record<string, unknown>
  old_record: Record<string, unknown>
}

// ── Handler ────────────────────────────────────────────

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Verify webhook secret to prevent unauthorized calls
  const webhookSecret = process.env.SUPABASE_WEBHOOK_SECRET
  if (webhookSecret) {
    const authHeader = req.headers['x-webhook-secret'] ?? req.headers['authorization']
    if (authHeader !== webhookSecret && authHeader !== `Bearer ${webhookSecret}`) {
      console.error('[send-ticket] Unauthorized webhook call')
      return res.status(401).json({ error: 'Unauthorized' })
    }
  }

  const resendApiKey = process.env.RESEND_API_KEY
  if (!resendApiKey) {
    console.error('[send-ticket] RESEND_API_KEY not configured')
    return res.status(500).json({ error: 'Email service not configured' })
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[send-ticket] Supabase credentials not configured')
    return res.status(500).json({ error: 'Database not configured' })
  }

  const siteUrl = process.env.SITE_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000'
  const cloudinaryBase = process.env.CLOUDINARY_BASE || ''

  try {
    const payload = req.body as WebhookPayload

    // Validate it's an UPDATE on the registrations table
    if (payload.type !== 'UPDATE' || payload.table !== 'registrations') {
      console.log(`[send-ticket] Ignoring ${payload.type} on ${payload.table}`)
      return res.status(200).json({ message: 'Ignored — not a registration update' })
    }

    const newRecord = payload.record
    const oldRecord = payload.old_record

    // Ticket email is already sent by admin-action.ts when accepting.
    // This webhook would send a duplicate — skip it.
    console.log('[send-ticket] Skipping — ticket email is handled by admin-action endpoint')
    return res.status(200).json({ message: 'Skipped — admin-action handles ticket emails' })

    // Fetch full registration with event data from Supabase
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: registration, error: regError } = await supabase
      .from('registrations')
      .select('*, events(id, slug, fee)')
      .eq('id', registrationId)
      .single()

    if (regError || !registration) {
      console.error('[send-ticket] Failed to fetch registration:', regError?.message)
      return res.status(404).json({ error: 'Registration not found' })
    }

    const eventSlug = (registration.events as Record<string, unknown>)?.slug as string | undefined
    if (!eventSlug) {
      console.error('[send-ticket] No event slug found for registration', registrationId)
      return res.status(400).json({ error: 'Event not found for registration' })
    }

    const eventMeta = getEventMeta(eventSlug, siteUrl, cloudinaryBase)
    if (!eventMeta) {
      console.error('[send-ticket] Unknown event slug:', eventSlug)
      return res.status(400).json({ error: `Unknown event: ${eventSlug}` })
    }

    // Build ticket data
    const ticketData: TicketData = {
      eventTitle: eventMeta.title,
      eventSubtitle: eventMeta.subtitle,
      themeColor: eventMeta.themeColor,
      name: registration.name as string,
      email: registration.email as string,
      phone: registration.phone as string,
      college: registration.college as string,
      teamName: registration.team_name as string,
      participantsCount: registration.participants_count as number,
      transactionId: registration.transaction_id as string,
      logoUrl: `${siteUrl}/title-sm.png`,
      characterUrl: eventMeta.characterImage,
      gdgLogoUrl: `${siteUrl}/gdg.png`,
    }

    console.log(`[send-ticket] Generating PDF for ${ticketData.name} — ${ticketData.eventTitle}`)

    // Generate PDF
    const pdfBuffer = await generateTicketPDF(ticketData)

    // Send email with Resend
    const resend = new Resend(resendApiKey)
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'DevSummit <tickets@devsummit.dev>'
    const filename = `DevSummit3-${ticketData.eventTitle.replace(/\s+/g, '-')}-Ticket.pdf`

    const { error: emailError } = await resend.emails.send({
      from: fromEmail,
      to: ticketData.email,
      subject: `🐉 The Dragon Scroll Awaits — ${ticketData.eventTitle} | DevSummit 3.0`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0c0c14; color: #ffffff; border-radius: 12px; overflow: hidden;">
          <!-- Top bamboo accent bar -->
          <div style="height: 4px; background: linear-gradient(90deg, #2d5a27, ${ticketData.themeColor}, #2d5a27);"></div>

          <div style="padding: 32px;">
            <!-- Header -->
            <div style="text-align: center; margin-bottom: 28px;">
              <p style="color: #6b8f71; margin: 0 0 4px; font-size: 11px; letter-spacing: 3px; text-transform: uppercase;">The Jade Palace Has Spoken</p>
              <h1 style="color: ${ticketData.themeColor}; margin: 0; font-size: 30px; letter-spacing: 1px;">DevSummit 3.0</h1>
              <p style="color: #4ade80; margin: 10px 0 0; font-size: 14px; font-weight: 600;">✦ Your tribute has been accepted! ✦</p>
            </div>

            <!-- Scroll-style event card -->
            <div style="background: #14141e; border: 1px solid ${ticketData.themeColor}44; border-radius: 8px; padding: 24px; margin-bottom: 20px; position: relative;">
              <div style="position: absolute; top: -1px; left: 20px; right: 20px; height: 2px; background: ${ticketData.themeColor}; opacity: 0.4;"></div>

              <h2 style="color: ${ticketData.themeColor}; margin: 0 0 4px; font-size: 22px; letter-spacing: 1px;">${ticketData.eventTitle}</h2>
              <p style="color: #8a8a9a; margin: 0 0 20px; font-style: italic; font-size: 13px;">"${ticketData.eventSubtitle}"</p>

              <p style="color: #ccc; margin: 0 0 18px; font-size: 15px;">
                Warrior <strong style="color: ${ticketData.themeColor};">${ticketData.name}</strong>, the masters have verified your tribute. You are now chosen for battle! 🥋
              </p>

              <!-- Details table with bamboo-style left border -->
              <div style="border-left: 3px solid #2d5a2744; padding-left: 16px;">
                <table style="width: 100%; color: #ccc; font-size: 14px; border-collapse: collapse;">
                  <tr><td style="padding: 7px 0; color: #6b8f71; width: 130px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Name</td><td style="padding: 7px 0;">${ticketData.name}</td></tr>
                  <tr><td style="padding: 7px 0; color: #6b8f71; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Team</td><td style="padding: 7px 0;">${ticketData.teamName}</td></tr>
                  <tr><td style="padding: 7px 0; color: #6b8f71; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">College</td><td style="padding: 7px 0;">${ticketData.college}</td></tr>
                  <tr><td style="padding: 7px 0; color: #6b8f71; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Participants</td><td style="padding: 7px 0;">${ticketData.participantsCount}</td></tr>
                  <tr><td style="padding: 7px 0; color: #6b8f71; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Transaction ID</td><td style="padding: 7px 0; font-family: monospace;">${ticketData.transactionId}</td></tr>
                </table>
              </div>
            </div>

            <!-- Ticket attachment banner -->
            <div style="background: #101a12; border: 1px solid #2d5a2744; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 20px;">
              <p style="color: #4ade80; margin: 0 0 6px; font-size: 15px; font-weight: 600;">🐉 Your Dragon Scroll Is Attached</p>
              <p style="color: #7a9a7e; margin: 0; font-size: 13px;">Carry this sacred scroll (digital or printed) to the arena on the day of battle.</p>
            </div>

            <!-- Shifu quote -->
            <div style="text-align: center; padding: 12px 20px; margin-bottom: 16px;">
              <p style="color: #6b8f71; margin: 0; font-size: 12px; font-style: italic;">"If you only do what you can do, you will never be more than you are now."</p>
              <p style="color: #4a6b4e; margin: 6px 0 0; font-size: 10px;">— Master Shifu</p>
            </div>

            <!-- Footer -->
            <div style="text-align: center; color: #444; font-size: 10px; border-top: 1px solid #ffffff0a; padding-top: 16px;">
              <p style="margin: 0;">Silicon Institute of Technology · GDG on Campus SIT · DevSummit 3.0</p>
            </div>
          </div>

          <!-- Bottom bamboo accent bar -->
          <div style="height: 4px; background: linear-gradient(90deg, #2d5a27, ${ticketData.themeColor}, #2d5a27);"></div>
        </div>
      `,
      attachments: [
        {
          filename,
          content: pdfBuffer.toString('base64'),
          contentType: 'application/pdf',
        },
      ],
    })

    if (emailError) {
      console.error('[send-ticket] Resend error:', emailError)
      return res.status(500).json({ error: 'Failed to send email', details: emailError.message })
    }

    console.log(`[send-ticket] Ticket email sent to ${ticketData.email}`)
    return res.status(200).json({ message: 'Ticket sent', email: ticketData.email })
  } catch (err) {
    console.error('[send-ticket] Unexpected error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return res.status(500).json({ error: 'Internal server error', details: message })
  }
}
