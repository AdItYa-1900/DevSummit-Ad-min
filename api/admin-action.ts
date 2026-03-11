import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { generateTicketPDF } from './ticketPdf'
import type { TicketData } from './ticketPdf'

interface EventMeta {
  title: string
  subtitle: string
  themeColor: string
  characterImage: string
}

function getEventMeta(slug: string, siteUrl: string): EventMeta | null {
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-password')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Verify admin password
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

  const { action, registrationId } = req.body as { action: string; registrationId: string }

  if (!action || !registrationId) {
    return res.status(400).json({ error: 'Missing action or registrationId' })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    if (action === 'accept') {
      // Fetch registration with event data
      const { data: registration, error: regError } = await supabase
        .from('registrations')
        .select('*, events(id, slug, fee)')
        .eq('id', registrationId)
        .single()

      if (regError || !registration) {
        return res.status(404).json({ error: 'Registration not found' })
      }

      if (registration.verified === true) {
        return res.status(400).json({ error: 'Already verified' })
      }

      // Update verified to true
      const { error: updateError } = await supabase
        .from('registrations')
        .update({ verified: true })
        .eq('id', registrationId)

      if (updateError) {
        return res.status(500).json({ error: 'Failed to update registration', details: updateError.message })
      }

      // Generate ticket and send email
      const siteUrl = process.env.SITE_URL || `https://${process.env.VERCEL_URL}`
      const eventSlug = (registration.events as Record<string, unknown>)?.slug as string
      const eventMeta = eventSlug ? getEventMeta(eventSlug, siteUrl) : null

      if (!eventMeta) {
        return res.status(200).json({ message: 'Verified but could not send ticket — unknown event' })
      }

      const resendApiKey = process.env.RESEND_API_KEY
      if (!resendApiKey) {
        return res.status(200).json({ message: 'Verified but email service not configured' })
      }

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

      const pdfBuffer = await generateTicketPDF(ticketData)

      const resend = new Resend(resendApiKey)
      const fromEmail = process.env.RESEND_FROM_EMAIL || 'DevSummit <tickets@devsummit.dev>'
      const filename = `DevSummit3-${ticketData.eventTitle.replace(/\s+/g, '-')}-Ticket.pdf`

      const { error: emailError } = await resend.emails.send({
        from: fromEmail,
        to: ticketData.email,
        subject: `🐉 The Dragon Scroll Awaits — ${ticketData.eventTitle} | DevSummit 3.0`,
        html: buildAcceptEmailHtml(ticketData, eventMeta),
        attachments: [{ filename, content: pdfBuffer.toString('base64') }],
      })

      if (emailError) {
        console.error('[admin-action] Email error:', emailError)
        return res.status(200).json({ message: 'Verified but email failed', emailError: emailError.message })
      }

      return res.status(200).json({ message: 'Registration accepted and ticket sent' })
    }

    if (action === 'reject') {
      // Fetch registration with event for email
      const { data: registration, error: regError } = await supabase
        .from('registrations')
        .select('*, events(id, slug)')
        .eq('id', registrationId)
        .single()

      if (regError || !registration) {
        return res.status(404).json({ error: 'Registration not found' })
      }

      // Mark as rejected (not deleted)
      const { error: updateError } = await supabase
        .from('registrations')
        .update({ rejected: true })
        .eq('id', registrationId)

      if (updateError) {
        return res.status(500).json({ error: 'Failed to reject registration', details: updateError.message })
      }

      // Send rejection email
      const resendApiKey = process.env.RESEND_API_KEY
      if (resendApiKey) {
        const eventSlug = (registration.events as Record<string, unknown>)?.slug as string
        const siteUrl = process.env.SITE_URL || `https://${process.env.VERCEL_URL}`
        const eventMeta = eventSlug ? getEventMeta(eventSlug, siteUrl) : null
        const themeColor = eventMeta?.themeColor || '#d4a373'
        const eventTitle = eventMeta?.title || 'DevSummit Event'

        const resend = new Resend(resendApiKey)
        const fromEmail = process.env.RESEND_FROM_EMAIL || 'DevSummit <tickets@devsummit.dev>'

        await resend.emails.send({
          from: fromEmail,
          to: registration.email as string,
          subject: `Registration Update — ${eventTitle} | DevSummit 3.0`,
          html: `
            <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0c0c14; color: #ffffff; border-radius: 12px; overflow: hidden;">
              <div style="height: 4px; background: linear-gradient(90deg, #2d5a27, ${themeColor}, #2d5a27);"></div>
              <div style="padding: 32px;">
                <div style="text-align: center; margin-bottom: 28px;">
                  <h1 style="color: ${themeColor}; margin: 0; font-size: 26px;">DevSummit 3.0</h1>
                </div>
                <div style="background: #14141e; border: 1px solid ${themeColor}44; border-radius: 8px; padding: 24px; margin-bottom: 20px;">
                  <p style="color: #ccc; font-size: 15px;">
                    Dear <strong style="color: ${themeColor};">${registration.name}</strong>,
                  </p>
                  <p style="color: #ccc; font-size: 14px;">
                    We regret to inform you that your registration for <strong>${eventTitle}</strong> could not be verified. This may be due to a payment issue.
                  </p>
                  <p style="color: #ccc; font-size: 14px;">
                    Please re-register with a valid payment, or contact us if you believe this is an error.
                  </p>
                </div>
                <div style="text-align: center; color: #444; font-size: 10px; border-top: 1px solid #ffffff0a; padding-top: 16px;">
                  <p style="margin: 0;">Silicon Institute of Technology · GDG on Campus SIT · DevSummit 3.0</p>
                </div>
              </div>
              <div style="height: 4px; background: linear-gradient(90deg, #2d5a27, ${themeColor}, #2d5a27);"></div>
            </div>
          `,
        }).catch((err) => console.error('[admin-action] Rejection email error:', err))
      }

      return res.status(200).json({ message: 'Registration rejected' })
    }

    if (action === 'undo-reject') {
      const { error: updateError } = await supabase
        .from('registrations')
        .update({ rejected: false })
        .eq('id', registrationId)

      if (updateError) {
        return res.status(500).json({ error: 'Failed to undo rejection', details: updateError.message })
      }

      return res.status(200).json({ message: 'Rejection undone — registration is pending again' })
    }

    if (action === 'delete') {
      const { error: deleteError } = await supabase
        .from('registrations')
        .delete()
        .eq('id', registrationId)

      if (deleteError) {
        return res.status(500).json({ error: 'Failed to delete registration', details: deleteError.message })
      }

      return res.status(200).json({ message: 'Registration permanently deleted' })
    }

    return res.status(400).json({ error: 'Unknown action. Use "accept", "reject", "undo-reject", or "delete".' })
  } catch (err) {
    console.error('[admin-action] Error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return res.status(500).json({ error: 'Internal server error', details: message })
  }
}

function buildAcceptEmailHtml(data: TicketData, eventMeta: EventMeta): string {
  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0c0c14; color: #ffffff; border-radius: 12px; overflow: hidden;">
      <div style="height: 4px; background: linear-gradient(90deg, #2d5a27, ${data.themeColor}, #2d5a27);"></div>
      <div style="padding: 32px;">
        <div style="text-align: center; margin-bottom: 28px;">
          <p style="color: #6b8f71; margin: 0 0 4px; font-size: 11px; letter-spacing: 3px; text-transform: uppercase;">The Jade Palace Has Spoken</p>
          <h1 style="color: ${data.themeColor}; margin: 0; font-size: 30px; letter-spacing: 1px;">DevSummit 3.0</h1>
          <p style="color: #4ade80; margin: 10px 0 0; font-size: 14px; font-weight: 600;">✦ Your tribute has been accepted! ✦</p>
        </div>
        <div style="background: #14141e; border: 1px solid ${data.themeColor}44; border-radius: 8px; padding: 24px; margin-bottom: 20px;">
          <h2 style="color: ${data.themeColor}; margin: 0 0 4px; font-size: 22px;">${eventMeta.title}</h2>
          <p style="color: #8a8a9a; margin: 0 0 20px; font-style: italic; font-size: 13px;">"${eventMeta.subtitle}"</p>
          <p style="color: #ccc; margin: 0 0 18px; font-size: 15px;">
            Warrior <strong style="color: ${data.themeColor};">${data.name}</strong>, the masters have verified your tribute. You are now chosen for battle! 🥋
          </p>
          <div style="border-left: 3px solid #2d5a2744; padding-left: 16px;">
            <table style="width: 100%; color: #ccc; font-size: 14px; border-collapse: collapse;">
              <tr><td style="padding: 7px 0; color: #6b8f71; width: 130px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Name</td><td style="padding: 7px 0;">${data.name}</td></tr>
              <tr><td style="padding: 7px 0; color: #6b8f71; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Team</td><td style="padding: 7px 0;">${data.teamName}</td></tr>
              <tr><td style="padding: 7px 0; color: #6b8f71; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">College</td><td style="padding: 7px 0;">${data.college}</td></tr>
              <tr><td style="padding: 7px 0; color: #6b8f71; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Participants</td><td style="padding: 7px 0;">${data.participantsCount}</td></tr>
              <tr><td style="padding: 7px 0; color: #6b8f71; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Transaction ID</td><td style="padding: 7px 0; font-family: monospace;">${data.transactionId}</td></tr>
            </table>
          </div>
        </div>
        <div style="background: #0f1a10; border: 1px solid #4ade8033; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 20px;">
          <p style="color: #4ade80; margin: 0 0 6px; font-size: 14px; font-weight: 600;">🎫 Your Ticket Is Attached!</p>
          <p style="color: #6b8f71; margin: 0; font-size: 13px;">Download and keep the attached PDF. Present it at the venue.</p>
        </div>
        <div style="text-align: center; color: #444; font-size: 10px; border-top: 1px solid #ffffff0a; padding-top: 16px;">
          <p style="margin: 0;">Silicon Institute of Technology · GDG on Campus SIT · DevSummit 3.0</p>
        </div>
      </div>
      <div style="height: 4px; background: linear-gradient(90deg, #2d5a27, ${data.themeColor}, #2d5a27);"></div>
    </div>
  `
}
