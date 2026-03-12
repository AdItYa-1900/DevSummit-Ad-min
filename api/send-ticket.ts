import type { Request, Response } from 'express'

// ── Handler ────────────────────────────────────────────
// Ticket email is now handled entirely by admin-action.ts.
// This endpoint remains as a no-op webhook receiver to avoid
// Supabase webhook errors if one is still configured.

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

  console.log('[send-ticket] Skipping — ticket email is handled by admin-action endpoint')
  return res.status(200).json({ message: 'Skipped — admin-action handles ticket emails' })
}
