import { useEffect, useState } from 'react'
import { clearSession, getSession } from '../auth'
import { API_URL } from '../api'
import './FleetOperations.css'

export default function RolePortal({ type }) {
  const session = getSession(); const [data, setData] = useState(null); const [error, setError] = useState('')
  const paths = { driver: '/api/driver-portal/my-trips', customer: '/api/customer-portal/my-reservations', finance: '/api/finance-portal/summary' }
  useEffect(() => { fetch(`${API_URL}${paths[type]}`, { headers: { Authorization: `Bearer ${session?.token}` } }).then(async r => { const body = await r.json(); if (!r.ok) throw new Error(body.message || 'Unable to load portal'); setData(body) }).catch(e => setError(e.message)) }, [type])
  const title = { driver: 'Driver portal', customer: 'Customer portal', finance: 'Finance portal' }[type]
  return <main className="operations" style={{ maxWidth: 1100, margin: '36px auto' }}><div className="operations-head"><div><h1>{title}</h1><p>{session?.user?.name}</p></div><button onClick={() => { clearSession(); window.location.href = '/login' }}>Sign out</button></div>{error && <p className="operations-message">{error}</p>}{!data && !error && <p>Loading…</p>}{type === 'driver' && data && <div className="operations-table"><h3>My trips</h3><table><thead><tr><th>Vehicle</th><th>Purpose</th><th>Status</th><th>Window</th></tr></thead><tbody>{data.trips?.map(t => <tr key={t.id}><td>{t.vehicle?.registration}</td><td>{t.booking?.justification || '—'}</td><td>{t.status}</td><td>{t.booking?.startAt ? new Date(t.booking.startAt).toLocaleString() : '—'}</td></tr>)}</tbody></table></div>}{type === 'customer' && data && <div className="operations-table"><h3>My reservations</h3><table><thead><tr><th>Vehicle</th><th>Start</th><th>Return</th><th>Status</th></tr></thead><tbody>{data.reservations?.map(r => <tr key={r.id}><td>{r.vehicle?.registration}</td><td>{new Date(r.startAt).toLocaleString()}</td><td>{new Date(r.endAt).toLocaleString()}</td><td>{r.status}</td></tr>)}</tbody></table></div>}{type === 'finance' && data && <div className="operations-grid">{Object.entries(data.summary || {}).map(([key, value]) => <article key={key}><h3>{key.replace(/([A-Z])/g, ' $1')}</h3><strong>{String(value)}</strong></article>)}</div>}</main>
}
