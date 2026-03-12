import type { Request, Response } from 'express'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req: Request, res: Response) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const ticketId = (req.query.id as string || '').trim()
  if (!ticketId) {
    return res.status(400).json({ valid: false, error: 'Missing ticket ID' })
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ valid: false, error: 'Database not configured' })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const { data, error } = await supabase
    .from('registrations')
    .select('id, name, email, phone, college, team_name, participants_count, verified, rejected, event_id, events(title, slug)')
    .eq('ticket_id', ticketId)
    .single()

  if (error || !data) {
    return res.status(404).json({ valid: false, error: 'Ticket not found' })
  }

  if (data.rejected) {
    return res.status(200).json({ valid: false, error: 'This registration has been rejected', registration: data })
  }

  if (!data.verified) {
    return res.status(200).json({ valid: false, error: 'This registration is not yet verified', registration: data })
  }

  return res.status(200).json({
    valid: true,
    registration: {
      name: data.name,
      email: data.email,
      phone: data.phone,
      college: data.college,
      team_name: data.team_name,
      participants_count: data.participants_count,
      event: (data.events as unknown as Record<string, unknown>)?.title || data.event_id,
    },
  })
}
