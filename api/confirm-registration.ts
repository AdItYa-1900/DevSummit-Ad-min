import type { Request, Response } from 'express'
import { Resend } from 'resend'

// ── Event metadata mapping (slug → display data) ──────

interface EventMeta {
  title: string
  subtitle: string
  themeColor: string
}

const EVENT_META: Record<string, EventMeta> = {
  'web-hunt': { title: 'WEB HUNT', subtitle: 'Seek and You Shall Find', themeColor: '#d4a373' },
  'capture-the-flag': { title: 'CAPTURE THE FLAG', subtitle: 'Defend and Conquer', themeColor: '#a34a4a' },
  'web-atelier': { title: 'WEB ATELIER', subtitle: 'Craft the Web. Earn the Scroll.', themeColor: '#9baaa6' },
  'agentic-ai': { title: 'AGENTIC AI', subtitle: 'Automate the Future', themeColor: '#7b72a8' },
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

  // Optional webhook secret check
  const webhookSecret = process.env.SUPABASE_WEBHOOK_SECRET
  if (webhookSecret) {
    const authHeader = req.headers['x-webhook-secret'] ?? req.headers['authorization']
    if (authHeader !== webhookSecret && authHeader !== `Bearer ${webhookSecret}`) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
  }

  const resendApiKey = process.env.RESEND_API_KEY
  if (!resendApiKey) {
    console.error('[confirm-reg] RESEND_API_KEY not configured')
    return res.status(500).json({ error: 'Email service not configured' })
  }

  try {
    const payload = req.body as WebhookPayload

    // Only handle INSERTs on the registrations table
    if (payload.type !== 'INSERT' || payload.table !== 'registrations') {
      return res.status(200).json({ message: 'Ignored — not a registration insert' })
    }

    const rec = payload.record
    const name = rec.name as string
    const email = rec.email as string
    const phone = rec.phone as string
    const college = rec.college as string
    const teamName = rec.team_name as string
    const participantsCount = rec.participants_count as number
    const transactionId = rec.transaction_id as string
    const eventId = rec.event_id as string

    if (!email) {
      console.error('[confirm-reg] No email in record')
      return res.status(400).json({ error: 'No email in registration record' })
    }

    // Try to match event metadata — we look up by event_id in the record
    // Since we don't have the slug directly, we'll use Supabase to fetch it
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    let eventMeta: EventMeta = { title: 'DevSummit 3.0 Event', subtitle: '', themeColor: '#d4a373' }

    if (supabaseUrl && supabaseServiceKey) {
      const { createClient } = await import('@supabase/supabase-js')
      const supabase = createClient(supabaseUrl, supabaseServiceKey)
      const { data: eventData } = await supabase
        .from('events')
        .select('slug')
        .eq('id', eventId)
        .single()

      if (eventData?.slug && EVENT_META[eventData.slug]) {
        eventMeta = EVENT_META[eventData.slug]
      }
    }

    console.log(`[confirm-reg] Sending confirmation to ${email} for ${eventMeta.title}`)

    const resend = new Resend(resendApiKey)
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'DevSummit <tickets@devsummit.dev>'
    const siteUrl = process.env.SITE_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000'

    const { error: emailError } = await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: `🐉 The Scroll Has Recorded Your Name - ${eventMeta.title} | DevSummit 3.0`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0c0c14; color: #ffffff; border-radius: 12px; overflow: hidden;">
          <!-- Top bamboo accent bar -->
          <div style="height: 4px; background: linear-gradient(90deg, #2d5a27, ${eventMeta.themeColor}, #2d5a27);"></div>

          <div style="padding: 32px;">
            <!-- Header -->
            <div style="text-align: center; margin-bottom: 28px;">
              <p style="color: #6b8f71; margin: 0 0 4px; font-size: 11px; letter-spacing: 3px; text-transform: uppercase;">The Valley of Peace Welcomes You</p>
              <img src="${siteUrl}/title-sm.png" alt="DevSummit 3.0" style="max-width: 240px; width: 100%; height: auto; display: inline-block;" />
              <p style="color: #d4a373; margin: 10px 0 0; font-size: 13px; font-style: italic;">"Your story may not have such a happy beginning, but that doesn't make you who you are."</p>
            </div>

            <!-- Scroll-style event card -->
            <div style="background: #14141e; border: 1px solid ${eventMeta.themeColor}44; border-radius: 8px; padding: 24px; margin-bottom: 20px; position: relative;">
              <div style="position: absolute; top: -1px; left: 20px; right: 20px; height: 2px; background: ${eventMeta.themeColor}; opacity: 0.4;"></div>
              
              <h2 style="color: ${eventMeta.themeColor}; margin: 0 0 4px; font-size: 22px; letter-spacing: 1px;">${eventMeta.title}</h2>
              ${eventMeta.subtitle ? `<p style="color: #8a8a9a; margin: 0 0 20px; font-style: italic; font-size: 13px;">"${eventMeta.subtitle}"</p>` : ''}

              <p style="color: #ccc; margin: 0 0 18px; font-size: 15px;">
                Greetings, <strong style="color: ${eventMeta.themeColor};">${name}</strong>! Your scroll of registration has been received at the Jade Palace. 🏯
              </p>

              <!-- Details table with bamboo-style left border -->
              <div style="border-left: 3px solid #2d5a2744; padding-left: 16px;">
                <table style="width: 100%; color: #ccc; font-size: 14px; border-collapse: collapse;">
                  <tr><td style="padding: 7px 0; color: #6b8f71; width: 130px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Name</td><td style="padding: 7px 0;">${name}</td></tr>
                  <tr><td style="padding: 7px 0; color: #6b8f71; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Team</td><td style="padding: 7px 0;">${teamName}</td></tr>
                  <tr><td style="padding: 7px 0; color: #6b8f71; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">College</td><td style="padding: 7px 0;">${college}</td></tr>
                  <tr><td style="padding: 7px 0; color: #6b8f71; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Participants</td><td style="padding: 7px 0;">${participantsCount}</td></tr>
                  <tr><td style="padding: 7px 0; color: #6b8f71; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Phone</td><td style="padding: 7px 0;">${phone}</td></tr>
                  <tr><td style="padding: 7px 0; color: #6b8f71; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Transaction ID</td><td style="padding: 7px 0; font-family: monospace;">${transactionId}</td></tr>
                </table>
              </div>
            </div>

            <!-- Pending verification box -->
            <div style="background: #1a1710; border: 1px solid #d4a37333; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 20px;">
              <p style="color: #d4a373; margin: 0 0 6px; font-size: 14px; font-weight: 600;">⏳ The Masters Are Reviewing Your Tribute</p>
              <p style="color: #8a8272; margin: 0; font-size: 13px;">
                Once your payment is verified, your <strong style="color: #d4a373;">sacred event ticket</strong> shall be delivered to this scroll address.
              </p>
            </div>

            <!-- Oogway quote -->
            <div style="text-align: center; padding: 12px 20px; margin-bottom: 16px;">
              <p style="color: #6b8f71; margin: 0; font-size: 12px; font-style: italic;">"Yesterday is history, tomorrow is a mystery, but today is a gift. That is why it is called the present."</p>
              <p style="color: #4a6b4e; margin: 6px 0 0; font-size: 10px;">— Master Oogway</p>
            </div>

            <!-- Footer -->
            <div style="text-align: center; color: #444; font-size: 10px; border-top: 1px solid #ffffff0a; padding-top: 16px;">
              <p style="margin: 0;">Silicon Institute of Technology · GDG on Campus SIT · DevSummit 3.0</p>
              <p style="margin: 4px 0 0;">If you seek guidance, reply to this scroll.</p>
            </div>
          </div>

          <!-- Bottom bamboo accent bar -->
          <div style="height: 4px; background: linear-gradient(90deg, #2d5a27, ${eventMeta.themeColor}, #2d5a27);"></div>
        </div>
      `,
    })

    if (emailError) {
      console.error('[confirm-reg] Resend error:', emailError)
      return res.status(500).json({ error: 'Failed to send email', details: emailError.message })
    }

    console.log(`[confirm-reg] Confirmation email sent to ${email}`)
    return res.status(200).json({ message: 'Confirmation sent', email })
  } catch (err) {
    console.error('[confirm-reg] Unexpected error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return res.status(500).json({ error: 'Internal server error', details: message })
  }
}
