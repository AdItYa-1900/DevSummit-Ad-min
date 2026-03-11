import React, { useEffect, useMemo, useState, useCallback } from 'react'
import supabase from './config/supabaseConfig'

type Registration = {
  id: string
  event_id: string
  name: string
  email: string
  phone: string
  college: string
  team_name: string | null
  participants_count: number
  transaction_id: string | null
  payment_screenshot_url: string | null
  verified: boolean
  rejected: boolean | null
  created_at: string
}

type EventInfo = { id: string; title: string; slug: string }
type EventMap = Record<string, EventInfo>

const AdminPage: React.FC = () => {
  const [password, setPassword] = useState('')
  const [authed, setAuthed] = useState(false)
  const [rows, setRows] = useState<Registration[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [eventMap, setEventMap] = useState<EventMap>({})
  const [selectedEvent, setSelectedEvent] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'verified' | 'rejected'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})
  const [screenshotModal, setScreenshotModal] = useState<string | null>(null)
  const [exportingPdf, setExportingPdf] = useState(false)
  const adminPassword = import.meta.env.VITE_ADMIN_PASSWORD || ''

  const loadRegistrations = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // Try API first, fall back to direct Supabase (works locally)
      const resp = await fetch('/api/get-registrations', {
        headers: { 'x-admin-password': adminPassword },
      })

      const contentType = resp.headers.get('content-type') || ''
      if (resp.ok && contentType.includes('application/json')) {
        const { events, registrations } = await resp.json()

        if (events) {
          const map: EventMap = {}
          for (const e of events as EventInfo[]) {
            map[e.id] = e
          }
          setEventMap(map)
        }

        setRows((registrations as Registration[]) || [])
        setLoading(false)
        return
      }

      // API didn't return valid JSON — fall back to direct Supabase
      throw new Error('API unavailable')
    } catch {
      // Fallback: fetch directly from Supabase (for local dev)
      try {
        const { data: eventsData, error: eventsError } = await supabase
          .from('events')
          .select('id, title, slug')

        if (!eventsError && eventsData) {
          const map: EventMap = {}
          for (const e of eventsData as EventInfo[]) {
            map[e.id] = e
          }
          setEventMap(map)
        }

        const { data, error: regError } = await supabase
          .from('registrations')
          .select('*')
          .order('created_at', { ascending: false })

        if (regError) {
          setError(regError.message)
          setLoading(false)
          return
        }

        setRows((data as Registration[]) || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load registrations')
      }
    }

    setLoading(false)
  }, [adminPassword])

  useEffect(() => {
    if (!authed) return
    loadRegistrations()
  }, [authed, loadRegistrations])

  // Auto-refresh every 30 seconds for live updates
  useEffect(() => {
    if (!authed) return
    const interval = setInterval(loadRegistrations, 30000)
    return () => clearInterval(interval)
  }, [authed, loadRegistrations])

  const filteredRows = useMemo(() => {
    let filtered = rows

    if (selectedEvent !== 'all') {
      filtered = filtered.filter(r => r.event_id === selectedEvent)
    }

    if (filterStatus === 'pending') {
      filtered = filtered.filter(r => !r.verified && !r.rejected)
    } else if (filterStatus === 'verified') {
      filtered = filtered.filter(r => r.verified)
    } else if (filterStatus === 'rejected') {
      filtered = filtered.filter(r => r.rejected)
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(r =>
        r.name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.college.toLowerCase().includes(q) ||
        (r.team_name || '').toLowerCase().includes(q) ||
        (r.transaction_id || '').toLowerCase().includes(q) ||
        r.phone.includes(q)
      )
    }

    return filtered
  }, [rows, selectedEvent, filterStatus, searchQuery])

  const stats = useMemo(() => {
    const total = rows.length
    const verified = rows.filter(r => r.verified).length
    const rejected = rows.filter(r => r.rejected).length
    const pending = total - verified - rejected
    const byEvent = new Map<string, { total: number; verified: number; pending: number; rejected: number }>()
    for (const r of rows) {
      const eid = r.event_id
      const existing = byEvent.get(eid) || { total: 0, verified: 0, pending: 0, rejected: 0 }
      existing.total++
      if (r.verified) existing.verified++
      else if (r.rejected) existing.rejected++
      else existing.pending++
      byEvent.set(eid, existing)
    }
    return { total, verified, pending, rejected, byEvent }
  }, [rows])

  const handleAction = async (registrationId: string, action: 'accept' | 'reject' | 'undo-reject' | 'delete') => {
    if (action === 'reject' && !window.confirm('Reject this registration? The registrant will be notified.')) {
      return
    }
    if (action === 'accept' && !window.confirm('Accept this registration? This will verify it and send the ticket email.')) {
      return
    }
    if (action === 'delete' && !window.confirm('Permanently delete this registration? This cannot be undone.')) {
      return
    }

    setActionLoading(prev => ({ ...prev, [registrationId]: true }))

    try {
      const resp = await fetch('/api/admin-action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': adminPassword,
        },
        body: JSON.stringify({ action, registrationId }),
      })

      const contentType = resp.headers.get('content-type') || ''
      if (!contentType.includes('application/json')) {
        alert('API not available. Please deploy the server to use accept/reject actions.')
        return
      }

      const result = await resp.json()

      if (!resp.ok) {
        alert(`Error: ${result.error || 'Unknown error'}`)
      } else {
        alert(result.message)
        await loadRegistrations()
      }
    } catch (err) {
      alert(`Network error: ${err instanceof Error ? err.message : 'Unknown'}`)
    } finally {
      setActionLoading(prev => ({ ...prev, [registrationId]: false }))
    }
  }

  const handleExportPdf = async (eventId?: string) => {
    setExportingPdf(true)
    try {
      const resp = await fetch('/api/export-registrations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': adminPassword,
        },
        body: JSON.stringify({ eventId: eventId || undefined }),
      })

      if (!resp.ok) {
        const contentType = resp.headers.get('content-type') || ''
        if (contentType.includes('application/json')) {
          const err = await resp.json()
          alert(`Export error: ${err.error || 'Unknown'}`)
        } else {
          alert('Export API not available. Please deploy the server to use PDF export.')
        }
        return
      }

      const contentType = resp.headers.get('content-type') || ''
      if (!contentType.includes('application/pdf')) {
        alert('Export API not available. Please deploy the server to use PDF export.')
        return
      }

      const blob = await resp.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      const eventTitle = eventId ? (eventMap[eventId]?.title || 'Event') : 'All-Events'
      link.download = `DevSummit3-${eventTitle.replace(/\s+/g, '-')}-Registrations.pdf`
      link.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert(`Export error: ${err instanceof Error ? err.message : 'Unknown'}`)
    } finally {
      setExportingPdf(false)
    }
  }

  const exportCsv = () => {
    const header = ['Event', 'Name', 'Email', 'Phone', 'College', 'Team', 'Participants', 'Transaction ID', 'Verified', 'Payment URL', 'Date']
    const lines = [header.join(',')]
    for (const r of filteredRows) {
      const line = [
        eventMap[r.event_id]?.title || r.event_id,
        r.name,
        r.email,
        r.phone,
        r.college,
        r.team_name || '',
        String(r.participants_count),
        r.transaction_id || '',
        r.verified ? 'Yes' : 'No',
        r.payment_screenshot_url || '',
        r.created_at ? new Date(r.created_at).toLocaleString('en-IN') : '',
      ].map(csvEscape).join(',')
      lines.push(line)
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `registrations-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const checkPassword = () => {
    if (!adminPassword) {
      setError('Admin password not set.')
      return
    }
    if (password === adminPassword) {
      setAuthed(true)
      setError(null)
    } else {
      setError('Incorrect password.')
    }
  }

  if (!authed) {
    return (
      <div className="admin-page">
        <div className="login-card">
          <div className="login-icon">🐉</div>
          <h1>Admin Panel</h1>
          <p className="subtitle">DevSummit 3.0 Registration Management</p>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && checkPassword()}
            placeholder="Enter admin password"
            className="input"
            autoFocus
          />
          {error && <div className="error">{error}</div>}
          <button onClick={checkPassword} className="btn btn-primary btn-full">Login</button>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-page">
      {/* Screenshot Modal */}
      {screenshotModal && (
        <div className="modal-overlay" onClick={() => setScreenshotModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setScreenshotModal(null)}>✕</button>
            <img src={screenshotModal} alt="Payment Screenshot" className="modal-image" />
          </div>
        </div>
      )}

      <div className="admin-container">
        {/* Header */}
        <div className="admin-header">
          <div>
            <h1>DevSummit 3.0 — Admin</h1>
            <p className="subtitle">Registration Management</p>
          </div>
          <div className="header-actions">
            <button onClick={() => loadRegistrations()} className="btn btn-secondary" disabled={loading}>
              {loading ? '⟳ Loading...' : '⟳ Refresh'}
            </button>
          </div>
        </div>

        {error && <div className="error">{error}</div>}

        {/* Stats Cards */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-number">{stats.total}</div>
            <div className="stat-label">Total</div>
          </div>
          <div className="stat-card stat-verified">
            <div className="stat-number">{stats.verified}</div>
            <div className="stat-label">Verified</div>
          </div>
          <div className="stat-card stat-pending">
            <div className="stat-number">{stats.pending}</div>
            <div className="stat-label">Pending</div>
          </div>
          <div className="stat-card stat-rejected">
            <div className="stat-number">{stats.rejected}</div>
            <div className="stat-label">Rejected</div>
          </div>
          {Array.from(stats.byEvent.entries()).map(([eid, s]) => (
            <div className="stat-card stat-event" key={eid}>
              <div className="stat-number">{s.total}</div>
              <div className="stat-label">{eventMap[eid]?.title || eid}</div>
              <div className="stat-detail">{s.verified} verified · {s.pending} pending · {s.rejected} rejected</div>
            </div>
          ))}
        </div>

        {/* Filters & Export Bar */}
        <div className="filters-bar">
          <div className="filters-left">
            <select value={selectedEvent} onChange={e => setSelectedEvent(e.target.value)} className="select">
              <option value="all">All Events</option>
              {Object.entries(eventMap).map(([id, info]) => (
                <option key={id} value={id}>{info.title}</option>
              ))}
            </select>

            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value as 'all' | 'pending' | 'verified' | 'rejected')}
              className="select"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="verified">Verified</option>
              <option value="rejected">Rejected</option>
            </select>

            <input
              type="text"
              placeholder="Search name, email, college, team..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="input search-input"
            />
          </div>
          <div className="filters-right">
            <span className="result-count">{filteredRows.length} results</span>
            <button onClick={exportCsv} className="btn btn-secondary">📄 CSV</button>
            <div className="dropdown">
              <button className="btn btn-secondary dropdown-trigger" disabled={exportingPdf}>
                {exportingPdf ? '⟳ Exporting...' : '📋 PDF Export ▾'}
              </button>
              <div className="dropdown-menu">
                <button onClick={() => handleExportPdf()}>All Events</button>
                {Object.entries(eventMap).map(([id, info]) => (
                  <button key={id} onClick={() => handleExportPdf(id)}>{info.title}</button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="table-wrapper">
          <table className="reg-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Event</th>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>College</th>
                <th>Team</th>
                <th>Count</th>
                <th>Txn ID</th>
                <th>Payment</th>
                <th>Status</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 && (
                <tr><td colSpan={13} className="empty-row">No registrations found</td></tr>
              )}
              {filteredRows.map((r, idx) => (
                <tr key={r.id} className={r.rejected ? 'row-rejected' : r.verified ? 'row-verified' : 'row-pending'}>
                  <td>{idx + 1}</td>
                  <td>
                    <span className="event-badge" style={{ background: getEventColor(eventMap[r.event_id]?.slug) }}>
                      {eventMap[r.event_id]?.title || r.event_id}
                    </span>
                  </td>
                  <td className="cell-name">{r.name}</td>
                  <td className="cell-email">{r.email}</td>
                  <td>{r.phone}</td>
                  <td>{r.college}</td>
                  <td>{r.team_name || '-'}</td>
                  <td>{r.participants_count}</td>
                  <td className="cell-txn">{r.transaction_id || '-'}</td>
                  <td>
                    {r.payment_screenshot_url ? (
                      <button
                        className="btn btn-tiny btn-view"
                        onClick={() => setScreenshotModal(r.payment_screenshot_url!)}
                      >
                        🖼 View
                      </button>
                    ) : (
                      <span className="no-screenshot">—</span>
                    )}
                  </td>
                  <td>
                    <span className={`status-badge ${r.rejected ? 'status-rejected' : r.verified ? 'status-verified' : 'status-pending'}`}>
                      {r.rejected ? '✕ Rejected' : r.verified ? '✓ Verified' : '⏳ Pending'}
                    </span>
                  </td>
                  <td className="cell-date">
                    {r.created_at ? new Date(r.created_at).toLocaleString('en-IN', {
                      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                    }) : '-'}
                  </td>
                  <td className="cell-actions">
                    {r.rejected ? (
                      <>
                        <button
                          className="btn btn-tiny btn-undo"
                          onClick={() => handleAction(r.id, 'undo-reject')}
                          disabled={actionLoading[r.id]}
                        >
                          {actionLoading[r.id] ? '...' : '↩ Undo'}
                        </button>
                        <button
                          className="btn btn-tiny btn-delete"
                          onClick={() => handleAction(r.id, 'delete')}
                          disabled={actionLoading[r.id]}
                        >
                          {actionLoading[r.id] ? '...' : '🗑 Delete'}
                        </button>
                      </>
                    ) : !r.verified ? (
                      <>
                        <button
                          className="btn btn-tiny btn-accept"
                          onClick={() => handleAction(r.id, 'accept')}
                          disabled={actionLoading[r.id]}
                        >
                          {actionLoading[r.id] ? '...' : '✓ Accept'}
                        </button>
                        <button
                          className="btn btn-tiny btn-reject"
                          onClick={() => handleAction(r.id, 'reject')}
                          disabled={actionLoading[r.id]}
                        >
                          {actionLoading[r.id] ? '...' : '✕ Reject'}
                        </button>
                      </>
                    ) : (
                      <span className="done-label">✓ Done</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function getEventColor(slug?: string): string {
  const colors: Record<string, string> = {
    'web-hunt': '#d4a373',
    'capture-the-flag': '#a34a4a',
    'web-atelier': '#9baaa6',
    'agentic-ai': '#7b72a8',
  }
  return slug ? (colors[slug] || '#666') : '#666'
}

const csvEscape = (value: string) => {
  const v = value ?? ''
  if (v.includes('"') || v.includes(',') || v.includes('\n')) {
    return `"${v.replace(/"/g, '""')}"`
  }
  return v
}

export default AdminPage
