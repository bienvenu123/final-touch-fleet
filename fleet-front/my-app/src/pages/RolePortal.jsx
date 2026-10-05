import { useCallback, useEffect, useState } from 'react'
import { clearSession, clearWebSession, getSession, getWebSession } from '../auth'
import { API_URL } from '../api'
import './FleetOperations.css'
import { Localized } from './i18n'

const paths = {
  driver: '/api/driver-portal/my-trips',
  customer: '/api/customer-portal/my-reservations',
  finance: '/api/finance-portal/summary',
}

async function portalRequest(token, path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...(options.headers || {}) },
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.message || 'Unable to load portal')
  return body
}

export default function RolePortal({ type }) {
  const session = type === 'customer' ? (getWebSession() || getSession()) : getSession()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)
  const [extensionEnds, setExtensionEnds] = useState({})
  const [showVehicleBrowser, setShowVehicleBrowser] = useState(false)
  const [vehicles, setVehicles] = useState([])
  const [vehicleLoading, setVehicleLoading] = useState(false)
  const [selectedVehicle, setSelectedVehicle] = useState(null)
  const [bookingSubmitting, setBookingSubmitting] = useState(false)
  const [bookingDraft, setBookingDraft] = useState({ serviceType: 'SELF_DRIVE', start: '', end: '', destination: '', purpose: '', passengerCount: '1', pickupLocation: '', guestName: '', guestContact: '' })

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      if (type === 'customer') {
        const [reservations, bookings, inspections, preferences] = await Promise.all([
          portalRequest(session?.token, paths.customer),
          portalRequest(session?.token, '/api/customer-portal/my-bookings'),
          portalRequest(session?.token, '/api/customer-portal/my-inspections'),
          portalRequest(session?.token, '/api/notifications/preferences'),
        ])
        setData({
          reservations: reservations.reservations || [],
          bookings: bookings.bookings || [],
          inspections: inspections.inspections || [],
          notificationPreferences: preferences.notificationPreferences || {},
        })
      } else if (type === 'finance') {
        const [summary, roi] = await Promise.all([
          portalRequest(session?.token, paths.finance),
          portalRequest(session?.token, '/api/finance-portal/roi'),
        ])
        setData({ summary: summary.summary || {}, roi: roi.roi || [] })
      } else {
        setData(await portalRequest(session?.token, paths[type]))
      }
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }, [session?.token, type])

  useEffect(() => { loadData() }, [loadData])

  async function browseVehicles() {
    setShowVehicleBrowser(true)
    if (vehicles.length) return
    setVehicleLoading(true)
    setError('')
    try {
      const response = await fetch(`${API_URL}/api/public/vehicles`)
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.message || 'Unable to load vehicles')
      setVehicles(body.vehicles || [])
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setVehicleLoading(false)
    }
  }

  async function submitCustomerBooking(event) {
    event.preventDefault()
    if (!selectedVehicle) return
    setBookingSubmitting(true)
    setError('')
    setNotice('')
    try {
      await portalRequest(session.token, '/api/customer-portal/my-bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleId: selectedVehicle.id,
          serviceType: bookingDraft.serviceType,
          start: new Date(bookingDraft.start).toISOString(),
          end: new Date(bookingDraft.end).toISOString(),
          destination: bookingDraft.destination,
          purpose: bookingDraft.purpose,
          passengerCount: Number(bookingDraft.passengerCount),
          pickupLocation: bookingDraft.pickupLocation,
          guestName: bookingDraft.guestName,
          guestContact: bookingDraft.guestContact,
        }),
      })
      setNotice('Booking request submitted. Its status is shown below.')
      setSelectedVehicle(null)
      setBookingDraft({ serviceType: 'SELF_DRIVE', start: '', end: '', destination: '', purpose: '', passengerCount: '1', pickupLocation: '', guestName: '', guestContact: '' })
      await loadData()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBookingSubmitting(false)
    }
  }

  async function requestExtension(reservation) {
    const newEnd = extensionEnds[reservation.id]
    if (!newEnd) return
    setLoading(true)
    setNotice('')
    setError('')
    try {
      await portalRequest(session.token, `/api/customer-portal/my-reservations/${reservation.id}/extend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newEnd: new Date(newEnd).toISOString() }),
      })
      setNotice('Rental return time updated.')
      setExtensionEnds(current => ({ ...current, [reservation.id]: '' }))
      await loadData()
    } catch (requestError) {
      setError(requestError.message)
      setLoading(false)
    }
  }

  async function saveNotificationPreferences(patch) {
    const current = data.notificationPreferences || {}
    const updated = { ...current, ...patch }
    setLoading(true)
    setError('')
    setNotice('')
    try {
      const result = await portalRequest(session.token, '/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      })
      setData(currentData => ({ ...currentData, notificationPreferences: result.notificationPreferences || updated }))
      setNotice('Notification preferences saved.')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  const title = { driver: 'Driver portal', customer: 'Customer dashboard', finance: 'Finance portal' }[type]
  const preferences = data?.notificationPreferences || {}
  const enabledChannels = preferences.enabledChannels || ['EMAIL']

  return <Localized><main className={`operations ${type === 'customer' ? 'customer-portal-page' : ''}`} style={type === 'customer' ? undefined : { maxWidth: 1100, margin: '36px auto' }}>
    <div className={`operations-head ${type === 'customer' ? 'customer-dashboard-header' : ''}`}><div>{type === 'customer' && <span className="customer-dashboard-eyebrow">FLEETLINK CUSTOMER AREA</span>}<h1>{title}</h1><p>{type === 'customer' ? <>Welcome back, <strong>{session?.user?.name}</strong>. Manage your bookings and account here.</> : session?.user?.name}</p></div><div className="customer-dashboard-actions"><button type="button" onClick={loadData} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</button><button type="button" className="customer-signout" onClick={() => { if (type === 'customer' && getWebSession()) { clearWebSession(); window.location.replace('/') } else { clearSession(); window.location.replace('/login') } }}>Sign out</button></div></div>
    {error && <p className="operations-message" role="alert">{error}</p>}
    {notice && <p className="operations-message" role="status">{notice}</p>}
    {!data && !error && <p>Loading…</p>}

    {type === 'driver' && data && <div className="operations-table"><h3>My trips</h3><table><thead><tr><th>Vehicle</th><th>Purpose</th><th>Status</th><th>Window</th></tr></thead><tbody>{data.trips?.map(trip => <tr key={trip.id}><td>{trip.vehicle?.registration}</td><td>{trip.booking?.justification || '—'}</td><td>{trip.status}</td><td>{trip.booking?.startAt ? new Date(trip.booking.startAt).toLocaleString() : '—'}</td></tr>)}</tbody></table></div>}

    {type === 'customer' && data && <>
      <section className="customer-dashboard-stats" aria-label="Account overview">
        <article><span>Booking requests</span><strong>{data.bookings.length}</strong><small>Requests awaiting or completed</small></article>
        <article><span>Rental reservations</span><strong>{data.reservations.length}</strong><small>Your vehicle rentals</small></article>
        <article><span>Inspection records</span><strong>{data.inspections.length}</strong><small>Rental condition reports</small></article>
      </section>
      <section className="customer-services">
        <h2>Vehicle services</h2>
        <p>Browse available vehicles, submit a booking request, and track its approval here.</p>
        <button type="button" className="customer-service-link" onClick={browseVehicles}>Browse vehicles and book</button>
      </section>

      {showVehicleBrowser && <section className="customer-vehicle-browser">
        <div className="customer-browser-heading"><h2>Available vehicles</h2><button type="button" onClick={() => { setShowVehicleBrowser(false); setSelectedVehicle(null) }}>Close</button></div>
        {vehicleLoading && <p>Loading available vehicles…</p>}
        {!vehicleLoading && vehicles.length === 0 && <p>No vehicles are currently available.</p>}
        <div className="customer-vehicle-grid">{vehicles.map(vehicle => <article className="customer-vehicle-card" key={vehicle.id}>
          <img src={vehicle.imageUrl || 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=900&q=80'} alt={`${vehicle.make || ''} ${vehicle.model || ''}`} />
          <div><h3>{[vehicle.make, vehicle.model].filter(Boolean).join(' ') || vehicle.registration}</h3><p>{vehicle.registration}</p><button type="button" onClick={() => setSelectedVehicle(vehicle)}>{selectedVehicle?.id === vehicle.id ? 'Selected' : 'Book this vehicle'}</button></div>
        </article>)}</div>
        {selectedVehicle && <form className="customer-booking-form" onSubmit={submitCustomerBooking}>
          <h2>Request {selectedVehicle.registration}</h2>
          <label>Booking service<select value={bookingDraft.serviceType} onChange={event => setBookingDraft(current => ({ ...current, serviceType: event.target.value }))}><option value="SELF_DRIVE">Self-drive rental</option><option value="CHAUFFEURED_TRANSFER">Chauffeured transfer</option></select></label>
          {bookingDraft.serviceType === 'CHAUFFEURED_TRANSFER' && <><label>Pickup location<input value={bookingDraft.pickupLocation} onChange={event => setBookingDraft(current => ({ ...current, pickupLocation: event.target.value }))} required /></label><label>Guest name<input value={bookingDraft.guestName} onChange={event => setBookingDraft(current => ({ ...current, guestName: event.target.value }))} required /></label><label>Guest contact<input value={bookingDraft.guestContact} onChange={event => setBookingDraft(current => ({ ...current, guestContact: event.target.value }))} required /></label></>}
          <label>Start date and time<input type="datetime-local" value={bookingDraft.start} onChange={event => setBookingDraft(current => ({ ...current, start: event.target.value }))} required /></label>
          <label>Return date and time<input type="datetime-local" value={bookingDraft.end} onChange={event => setBookingDraft(current => ({ ...current, end: event.target.value }))} required /></label>
          <label>Destination<input value={bookingDraft.destination} onChange={event => setBookingDraft(current => ({ ...current, destination: event.target.value }))} required /></label>
          <label>Purpose<input value={bookingDraft.purpose} onChange={event => setBookingDraft(current => ({ ...current, purpose: event.target.value }))} required /></label>
          <label>Passengers<input type="number" min="1" value={bookingDraft.passengerCount} onChange={event => setBookingDraft(current => ({ ...current, passengerCount: event.target.value }))} required /></label>
          <div className="customer-booking-actions"><button type="submit" disabled={bookingSubmitting}>{bookingSubmitting ? 'Submitting…' : 'Submit booking request'}</button><button type="button" onClick={() => setSelectedVehicle(null)}>Cancel</button></div>
        </form>}
      </section>}

      <div className="operations-table"><h3>My booking requests</h3><table><thead><tr><th>Vehicle</th><th>Destination</th><th>Travel dates</th><th>Status</th><th>Decision note</th></tr></thead><tbody>{data.bookings.length ? data.bookings.map(booking => <tr key={booking.id}><td>{booking.vehicle?.registration || '—'}</td><td>{booking.destination || '—'}</td><td>{new Date(booking.startAt).toLocaleString()} – {new Date(booking.endAt).toLocaleString()}</td><td>{booking.status}</td><td>{booking.comment || '—'}</td></tr>) : <tr><td colSpan={5}>No booking requests yet.</td></tr>}</tbody></table></div>

      <div className="operations-table"><h3>My rental reservations</h3><table><thead><tr><th>Vehicle</th><th>Start</th><th>Return</th><th>Status</th><th>Extend rental</th></tr></thead><tbody>{data.reservations.length ? data.reservations.map(reservation => <tr key={reservation.id}><td>{reservation.vehicle?.registration}</td><td>{new Date(reservation.startAt).toLocaleString()}</td><td>{new Date(reservation.endAt).toLocaleString()}</td><td>{reservation.status}</td><td>{['COMPLETED', 'OVERDUE'].includes(reservation.status) ? 'Contact operations' : <form className="customer-extension" onSubmit={event => { event.preventDefault(); requestExtension(reservation) }}><input aria-label="New return time" type="datetime-local" value={extensionEnds[reservation.id] || ''} onChange={event => setExtensionEnds(current => ({ ...current, [reservation.id]: event.target.value }))} required /><button disabled={loading}>Request extension</button></form>}</td></tr>) : <tr><td colSpan={5}>No rental reservations yet.</td></tr>}</tbody></table></div>

      <div className="operations-table"><h3>My rental inspections</h3><table><thead><tr><th>Vehicle</th><th>Inspection</th><th>Odometer</th><th>Condition</th><th>Recorded</th></tr></thead><tbody>{data.inspections.length ? data.inspections.map(inspection => <tr key={inspection.id}><td>{inspection.reservation?.vehicle?.registration || '—'}</td><td>{inspection.inspectionType}</td><td>{inspection.odometerReading}</td><td>{inspection.conditionDiff || inspection.conditionNotes || '—'}</td><td>{new Date(inspection.createdAt).toLocaleString()}</td></tr>) : <tr><td colSpan={5}>No rental inspections yet.</td></tr>}</tbody></table></div>

      <section className="customer-services">
        <h2>Notification preferences</h2>
        <p>Choose how FleetLink sends booking updates and rental return reminders.</p>
        <div className="customer-preference-options">{['EMAIL', 'SMS', 'PUSH'].map(channel => <label key={channel}><input type="checkbox" checked={enabledChannels.includes(channel)} onChange={() => { const next = enabledChannels.includes(channel) ? enabledChannels.filter(item => item !== channel) : [...enabledChannels, channel]; if (!next.length) return; saveNotificationPreferences({ enabledChannels: next, preferredChannel: next.includes(preferences.preferredChannel) ? preferences.preferredChannel : next[0] }) }} />{channel}</label>)}</div>
        <label className="customer-preference-toggle"><input type="checkbox" checked={preferences.bookingUpdates !== false} onChange={event => saveNotificationPreferences({ bookingUpdates: event.target.checked })} />Booking updates</label>
        <label className="customer-preference-toggle"><input type="checkbox" checked={preferences.rentalReminders !== false} onChange={event => saveNotificationPreferences({ rentalReminders: event.target.checked })} />Rental return reminders</label>
      </section>
    </>}

    {type === 'finance' && data && <><div className="operations-grid">{Object.entries(data.summary || {}).map(([key, value]) => <article key={key}><h3>{key.replace(/([A-Z])/g, ' $1')}</h3><strong>{String(value)}</strong></article>)}</div><div className="operations-table"><h2>Department costs and recorded ROI</h2><table><thead><tr><th>Department</th><th>Purpose</th><th>Trips</th><th>Distance (km)</th><th>Fuel + energy</th><th>Maintenance</th><th>Recorded benefit</th><th>ROI</th></tr></thead><tbody>{data.roi.length ? data.roi.map((row, index) => <tr key={`${row.departmentId}-${row.purpose}-${index}`}><td>{row.departmentName}</td><td>{row.purpose}</td><td>{row.totalTrips}</td><td>{row.totalDistanceKm}</td><td>{Number(row.totalFuelCost + row.totalEnergyCost).toFixed(2)}</td><td>{row.allocatedMaintenanceCost}</td><td>{row.recordedBusinessBenefit}</td><td>{row.roi == null ? row.roiUnavailableReason : `${row.roi}%`}</td></tr>) : <tr><td colSpan={8}>No completed corporate trip data for this period.</td></tr>}</tbody></table></div></>}
  </main></Localized>
}
