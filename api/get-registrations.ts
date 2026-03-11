import type { Request, Response } from 'express'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req: Request, res: Response) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-password')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

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

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    const [eventsResult, regsResult] = await Promise.all([
      supabase.from('events').select('id, title, slug'),
      supabase.from('registrations').select('*').order('created_at', { ascending: false }),
    ])

    if (regsResult.error) {
      return res.status(500).json({ error: regsResult.error.message })
    }

    return res.status(200).json({
      events: eventsResult.data || [],
      registrations: regsResult.data || [],
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return res.status(500).json({ error: message })
  }
}
