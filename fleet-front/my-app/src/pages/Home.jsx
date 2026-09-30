import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { ArrowIcon, CarIcon } from '../components/Icons'
import { Localized } from './i18n'
import { getWebSession } from '../auth'
import '../App.css'

function HeroContent() {
  return (<Localized>
    <div className="hero-content">
      <span className="badge">
        <CarIcon />
        Executive Chauffeur Service
      </span>

      <h1 className="hero-title">
        Executive Chauffeur &amp; Luxury Limousine Services
      </h1>

      <p className="hero-desc">
        Experience first-class transportation with professional chauffeurs, luxury
        vehicles, and seamless booking designed for business, airport, and VIP travel.
      </p>

      <div className="hero-actions">
        <a href="#booking" className="btn btn--white">
          Book Your Ride
          <ArrowIcon dark />
        </a>
        <a href="#fleets" className="btn btn--ghost">
          Explore Fleet
          <ArrowIcon />
        </a>
      </div>
    </div>
  </Localized>)
}

function BookingForm() {
  const location = useLocation()
  const navigate = useNavigate()
  const session = getWebSession()
  const [vehicles, setVehicles] = useState([])
  const [form, setForm] = useState({ name: session?.user?.name || '', email: session?.user?.email || '', contact: session?.user?.contact || '', vehicleId: location.state?.bookingVehicleId || '', serviceType: 'SELF_DRIVE', destination: '', pickupLocation: '', guestName: '', guestContact: '', passengerCount: '1', start: '', end: '' })
  const [status, setStatus] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const selectedVehicle = vehicles.find(vehicle => vehicle.id === form.vehicleId)

  useEffect(() => {
    fetch(`${import.meta.env.VITE_FLEETLINK_API_URL || 'http://localhost:3000'}/api/public/vehicles`)
      .then(response => response.json())
      .then(data => setVehicles(data.vehicles || []))
      .catch(() => setStatus('Vehicles could not be loaded. Please try again shortly.'))
  }, [])

  useEffect(() => {
    if (location.hash !== '#booking' && !location.state?.openBooking) return
    const timeout = window.setTimeout(() => document.getElementById('booking')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    return () => window.clearTimeout(timeout)
  }, [location.key, location.hash, location.state])

  async function submitBooking(event) {
    event.preventDefault()
    setSubmitting(true)
    setStatus('')
    try {
      const response = await fetch(`${import.meta.env.VITE_FLEETLINK_API_URL || 'http://localhost:3000'}/api/customer-portal/my-bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({ ...form, passengerCount: Number(form.passengerCount), start: new Date(form.start).toISOString(), end: new Date(form.end).toISOString() }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || 'Your booking request could not be submitted.')
      setForm({ name: session.user.name || '', email: session.user.email || '', contact: session.user.contact || '', vehicleId: '', serviceType: 'SELF_DRIVE', destination: '', pickupLocation: '', guestName: '', guestContact: '', passengerCount: '1', start: '', end: '' })
      setStatus('Request received. It is pending approval from our booking team.')
    } catch (error) {
      setStatus(error.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (<Localized>
    <section className="booking" id="booking">
      <div className="booking-intro">
        <h2 className="booking-title">Book Your Luxury Ride</h2>
        <p className="booking-subtitle">
          Experience premium chauffeur travel with executive-class comfort.
        </p>
      </div>

      <form className="booking-form" onSubmit={submitBooking}>
        {!session ? <div className="booking-auth-gate"><p>Sign in or create a customer account before booking.</p><button type="button" className="btn btn--navy btn--submit" onClick={() => navigate('/login', { state: { returnTo: '/', webAuth: true, bookingVehicleId: form.vehicleId } })}>Sign in or create account <ArrowIcon /></button></div> : <>
        <div className="form-field">
          <label htmlFor="serviceType">Booking service</label>
          <select id="serviceType" value={form.serviceType} onChange={event => setForm({ ...form, serviceType: event.target.value })}>
            <option value="SELF_DRIVE">Self-drive rental</option>
            <option value="CHAUFFEURED_TRANSFER">Chauffeured transfer</option>
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="name">Name</label>
          <input id="name" type="text" placeholder="Enter Your Name" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} required />
        </div>

        <div className="form-field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" placeholder="Enter Email Address" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} required />
        </div>

        <div className="form-field">
          <label htmlFor="mobile">Mobile Number</label>
          <input id="mobile" type="tel" placeholder="Enter Mobile Number" value={form.contact} onChange={event => setForm({ ...form, contact: event.target.value })} required />
        </div>

        {form.serviceType === 'CHAUFFEURED_TRANSFER' && <><div className="form-field"><label htmlFor="pickup">Pickup location</label><input id="pickup" type="text" placeholder="Where should we collect the guest?" value={form.pickupLocation} onChange={event => setForm({ ...form, pickupLocation: event.target.value })} required /></div><div className="form-field"><label htmlFor="guestName">Guest name</label><input id="guestName" type="text" placeholder="Guest or client name" value={form.guestName} onChange={event => setForm({ ...form, guestName: event.target.value })} required /></div><div className="form-field"><label htmlFor="guestContact">Guest contact</label><input id="guestContact" type="tel" placeholder="Guest phone number" value={form.guestContact} onChange={event => setForm({ ...form, guestContact: event.target.value })} required /></div></>}
        <div className="form-field">
          <label htmlFor="destination">{form.serviceType === 'CHAUFFEURED_TRANSFER' ? 'Destination' : 'Return / destination'}</label>
          <input id="destination" type="text" placeholder="Enter destination" value={form.destination} onChange={event => setForm({ ...form, destination: event.target.value })} required />
        </div>

        <div className="form-field">
          <label htmlFor="vehicle">Vehicle</label>
          <select id="vehicle" value={form.vehicleId} onChange={event => setForm({ ...form, vehicleId: event.target.value })} required>
            <option value="" disabled>Select a vehicle</option>
            {vehicles.map(vehicle => <option key={vehicle.id} value={vehicle.id}>{vehicle.registration} — {[vehicle.make, vehicle.model].filter(Boolean).join(' ')}</option>)}
          </select>
        </div>

        <div className="form-field">
          <label htmlFor="guests">Travel Guest</label>
          <select id="guests" value={form.passengerCount} onChange={event => setForm({ ...form, passengerCount: event.target.value })}>
            <option value="1">1 Guest</option>
            <option value="2">2 Guests</option>
            <option value="3">3 Guests</option>
            <option value="4">4 Guests</option>
          </select>
        </div>

        <div className="form-field">
          <label htmlFor="start">Start</label>
          <input id="start" type="datetime-local" value={form.start} onChange={event => setForm({ ...form, start: event.target.value })} required />
        </div>

        <div className="form-field">
          <label htmlFor="end">End</label>
          <input id="end" type="datetime-local" value={form.end} onChange={event => setForm({ ...form, end: event.target.value })} required />
        </div>

        <button type="submit" className="btn btn--navy btn--submit" disabled={submitting}>
          {submitting ? 'Sending…' : 'Send a Request'}
          <ArrowIcon />
        </button>
        {status && <p className="booking-subtitle" role="status">{status}</p>}
        </>}
      </form>
      {selectedVehicle && <div className="booking-vehicle-preview"><img src={selectedVehicle.imageUrl || 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1200&q=80'} alt={`${selectedVehicle.registration} ${[selectedVehicle.make, selectedVehicle.model].filter(Boolean).join(' ')}`} /><span><b>{selectedVehicle.registration}</b>{[selectedVehicle.make, selectedVehicle.model].filter(Boolean).join(' ') && ` — ${[selectedVehicle.make, selectedVehicle.model].filter(Boolean).join(' ')}`}</span></div>}
      <div className="booking-vehicle-gallery" aria-label="Vehicles available to request">
        <h3>Choose your vehicle</h3>
        <div className="booking-vehicle-grid">
          {vehicles.map(vehicle => <article className={`booking-vehicle-card ${vehicle.id === form.vehicleId ? 'is-selected' : ''}`} key={vehicle.id}>
            <img src={vehicle.imageUrl || 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1200&q=80'} alt={`${vehicle.registration} ${[vehicle.make, vehicle.model].filter(Boolean).join(' ')}`} />
            <div><b>{[vehicle.make, vehicle.model].filter(Boolean).join(' ') || vehicle.registration}</b><small>{vehicle.registration}</small></div>
            <button type="button" onClick={() => setForm({ ...form, vehicleId: vehicle.id })}>{vehicle.id === form.vehicleId ? 'Selected' : 'Book this vehicle'}</button>
          </article>)}
        </div>
      </div>
    </section>
  </Localized>)
}

export default function Home() {
  return (<Localized>
    <div className="page">
      <section className="hero">
        <div className="hero-overlay" />
        <Header activePage="home" />
        <HeroContent />
        <BookingForm />
      </section>
    </div>
  </Localized>)
}
