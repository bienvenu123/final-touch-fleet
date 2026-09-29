import { Link, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Header from '../components/Header'
import { getPublicVehicles } from '../api'
import './Fleet.css'
import { Localized } from './i18n'

const fallbackImage = 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1200&q=80'
const vehicleName = vehicle => [vehicle.make, vehicle.model].filter(Boolean).join(' ') || vehicle.registration

export default function Fleet() {
  const navigate = useNavigate()
  const [vehicles, setVehicles] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const timeout = setTimeout(async () => {
      setLoading(true); setError('')
      try { const data = await getPublicVehicles(search); if (active) setVehicles(data) }
      catch (requestError) { if (active) setError(requestError.message) }
      finally { if (active) setLoading(false) }
    }, 250)
    return () => { active = false; clearTimeout(timeout) }
  }, [search])

  return <Localized><div className="fleet-page page">
    <section className="hero fleet-hero"><div className="hero-overlay" /><Header activePage="fleets" />
      <div className="container hero-content"><nav className="breadcrumb" aria-label="Breadcrumb"><Link to="/">Home</Link><span aria-hidden="true">/</span><span>Fleets</span></nav><span className="badge">Premium Fleet Collection</span><h1 className="hero-title">Our Fleets</h1><p className="hero-desc">Browse our currently listed executive vehicles for airport transfers, corporate travel, and VIP journeys.</p><div className="hero-actions"><Link to="/#booking" className="btn btn--white">Book a Ride</Link><Link to="/about" className="btn btn--ghost">Learn More</Link></div></div>
    </section>
    <section className="fleet-main"><div className="container fleet-layout"><aside className="fleet-sidebar"><div className="fleet-search"><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search vehicles..." aria-label="Search vehicles" /></div><div className="fleet-card-spotlight"><div className="spotlight-content"><h4>Your Trusted Luxury Travel Partner</h4><p>Elegant chauffeur and travel services designed for smooth, comfortable journeys.</p></div><div className="spotlight-meta"><Link to="/contact" className="btn btn--white btn--sm">Contact Us</Link></div></div></aside><div className="fleet-cards" aria-live="polite">{loading && <p>Loading fleet…</p>}{error && <p className="fleet-load-error">{error}</p>}{!loading && !error && vehicles.length === 0 && <p>No vehicles currently match your search.</p>}{vehicles.map(vehicle => <article className="fleet-card" key={vehicle.id}><div className="fleet-card-image"><img src={vehicle.imageUrl || fallbackImage} alt={vehicleName(vehicle)} /><span className="fleet-tag">{vehicle.registration}</span></div><div className="fleet-card-info"><h3>{vehicleName(vehicle)}</h3><p>Maintained and ready for premium chauffeur travel.</p><div className="fleet-card-meta"><strong>{vehicle.registration}</strong><span>{vehicle.odometerCurrent.toLocaleString()} km</span></div><div className="fleet-card-actions"><Link to={`/fleet/${vehicle.id}`} className="btn btn--ghost btn--sm">View Details</Link><button type="button" className="btn btn--navy btn--sm" onClick={() => navigate('/', { state: { bookingVehicleId: vehicle.id, openBooking: true } })}>Book this vehicle</button></div></div></article>)}</div></div></section>
  </div></Localized>
}
