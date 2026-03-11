import 'dotenv/config'
import express from 'express'
import path from 'path'
import adminAction from './api/admin-action'
import getRegistrations from './api/get-registrations'
import exportRegistrations from './api/export-registrations'
import sendTicket from './api/send-ticket'
import confirmRegistration from './api/confirm-registration'

process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT]', err)
})
process.on('unhandledRejection', (err) => {
  console.error('[UNHANDLED REJECTION]', err)
})

const app = express()
const PORT = parseInt(process.env.PORT || '3000', 10)

app.use(express.json({ limit: '10mb' }))

// Wrap async handlers so Express catches rejections
function asyncHandler(fn: (req: express.Request, res: express.Response, next: express.NextFunction) => Promise<unknown>) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    fn(req, res, next).catch(next)
  }
}

// API routes
app.all('/api/admin-action', asyncHandler(adminAction as Parameters<typeof asyncHandler>[0]))
app.all('/api/get-registrations', asyncHandler(getRegistrations as Parameters<typeof asyncHandler>[0]))
app.all('/api/export-registrations', asyncHandler(exportRegistrations as Parameters<typeof asyncHandler>[0]))
app.all('/api/send-ticket', asyncHandler(sendTicket as Parameters<typeof asyncHandler>[0]))
app.all('/api/confirm-registration', asyncHandler(confirmRegistration as Parameters<typeof asyncHandler>[0]))

// Serve static frontend build
app.use(express.static(path.join(__dirname, 'dist')))

// SPA fallback
app.get('/{*splat}', (_req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'))
})

// Global error handler
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[express-error]', err)
  const message = err instanceof Error ? err.message : 'Unknown error'
  res.status(500).json({ error: 'Internal server error', details: message })
})

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
