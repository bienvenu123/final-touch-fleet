import { useEffect, useState } from 'react'
import Header from '../components/Header'
import { ArrowIcon, CarIcon } from '../components/Icons'
import '../App.css'

function HeroContent() {
  return (
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
  )
}

function BookingForm() {
  const [vehicles, setVehicles] = useState([])
  const [form, setForm] = useState({ name: '', email: '', contact: '', vehicleId: '', destination: '', passengerCount: '1', start: '', end: '' })
  const [status, setStatus] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const selectedVehicle = vehicles.find(vehicle => vehicle.id === form.vehicleId)

  useEffect(() => {
    fetch(`${import.meta.env.VITE_FLEETLINK_API_URL || 'http://localhost:3000'}/api/public/vehicles`)
      .then(response => response.json())
      .then(data => setVehicles(data.vehicles || []))
      .catch(() => setStatus('Vehicles could not be loaded. Please try again shortly.'))
  }, [])

  async function submitBooking(event) {
    event.preventDefault()
    setSubmitting(true)
    setStatus('')
    try {
      const response = await fetch(`${import.meta.env.VITE_FLEETLINK_API_URL || 'http://localhost:3000'}/api/public/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, start: new Date(form.start).toISOString(), end: new Date(form.end).toISOString() }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || 'Your booking request could not be submitted.')
      setForm({ name: '', email: '', contact: '', vehicleId: '', destination: '', passengerCount: '1', start: '', end: '' })
      setStatus('Request received. It is pending approval from our booking team.')
    } catch (error) {
      setStatus(error.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="booking" id="booking">
      <div className="booking-intro">
        <h2 className="booking-title">Book Your Luxury Ride</h2>
        <p className="booking-subtitle">
          Experience premium chauffeur travel with executive-class comfort.
        </p>
      </div>

      <form className="booking-form" onSubmit={submitBooking}>
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

        <div className="form-field">
          <label htmlFor="pickup">Pickup Destination</label>
          <input id="pickup" type="text" placeholder="Enter Pickup Destination" value={form.destination} onChange={event => setForm({ ...form, destination: event.target.value })} required />
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
  )
}

export default function Home() {
  return (
    <div className="page">
      <section className="hero">
        <div className="hero-overlay" />
        <Header activePage="home" />
        <HeroContent />
        <BookingForm />
      </section>
    </div>
  )
}
