import { useCallback, useEffect, useState } from 'react'

const API_URL = import.meta.env.VITE_FLEETLINK_API_URL || 'http://localhost:3000'

export default function NewsletterCampaignPanel({ token }) {
  const [audience, setAudience] = useState(null)
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const refreshAudience = useCallback(async () => {
    const response = await fetch(`${API_URL}/api/newsletter/audience`, { headers: { Authorization: `Bearer ${token}` } })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.message || 'Could not load newsletter subscribers')
    setAudience(data)
  }, [token])

  useEffect(() => { refreshAudience().catch(reason => setError(reason.message)) }, [refreshAudience])

  async function submit(event) {
    event.preventDefault()
    if (!window.confirm(`Send this campaign to ${audience?.active ?? 0} subscribed email address(es)?`)) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const response = await fetch(`${API_URL}/api/newsletter/campaign`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, message }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || 'Campaign could not be sent')
      setNotice(`Campaign finished: ${data.sent} sent, ${data.failed} failed, from ${data.audience} subscribed address(es).${data.failedRecipients?.length ? ` Failed addresses: ${data.failedRecipients.join(', ')}` : ''}`)
      setSubject('')
      setMessage('')
    } catch (reason) {
      setError(reason.message)
    } finally {
      setBusy(false)
    }
  }

  return <section className="panel full newsletter-campaign-panel">
    <div className="panel-heading"><div><h2>Email campaigns</h2><p>Send an update to customers who explicitly subscribed to FleetLink email updates.</p></div><button type="button" onClick={() => refreshAudience().catch(reason => setError(reason.message))}>Refresh audience</button></div>
    <div className="newsletter-audience-stats"><strong>{audience?.active ?? '—'}</strong><span>active subscribers</span><span>{audience?.unsubscribed ?? 0} unsubscribed</span></div>
    <form className="admin-form" onSubmit={submit}>
      <label>Subject<input value={subject} onChange={event => setSubject(event.target.value)} maxLength={180} required /></label>
      <label>Message<textarea value={message} onChange={event => setMessage(event.target.value)} maxLength={10000} rows={8} required /></label>
      <div className="form-actions"><button disabled={busy || !audience?.active}>{busy ? 'Sending…' : 'Send campaign'}</button></div>
    </form>
    {error && <p role="alert" className="newsletter-campaign-error">{error}</p>}
    {notice && <p role="status" className="newsletter-campaign-notice">{notice}</p>}
    <p className="newsletter-campaign-footnote">Each email includes an unsubscribe link. Campaigns are sent through the configured SMTP server.</p>
  </section>
}
