import { Link, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Header from '../components/Header'
import { getPublicVehicle } from '../api'
import './FleetDetails.css'

const fallbackImage = 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1200&q=80'
const vehicleName = vehicle => [vehicle?.make, vehicle?.model].filter(Boolean).join(' ') || vehicle?.registration

export default function FleetDetails() {
  const { vehicleId } = useParams()
  const [vehicle, setVehicle] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => { let active = true; getPublicVehicle(vehicleId).then(value => active && setVehicle(value)).catch(value => active && setError(value.message)); return () => { active = false } }, [vehicleId])

  if (error) return <div className="page fleet-details-page"><Header activePage="fleets" /><div className="container fleet-details-empty"><h2>Vehicle unavailable</h2><p>{error}</p><Link to="/fleet" className="btn btn--white">Back to Fleet</Link></div></div>
  if (!vehicle) return <div className="page fleet-details-page"><Header activePage="fleets" /><div className="container fleet-details-empty"><p>Loading vehicle…</p></div></div>
  const due = vehicle.nextDueDate ? new Date(vehicle.nextDueDate).toLocaleDateString() : 'Scheduled as needed'
  return <div className="page fleet-details-page"><section className="hero fleet-details-hero"><div className="hero-overlay" /><Header activePage="fleets" /><div className="container"><nav className="breadcrumb" aria-label="Breadcrumb"><Link to="/">Home</Link><span aria-hidden="true">/</span><Link to="/fleet">Fleets</Link><span aria-hidden="true">/</span><span>{vehicleName(vehicle)}</span></nav><div className="hero-content"><span className="badge">{vehicle.registration}</span><h1 className="hero-title">{vehicleName(vehicle)}</h1><p className="hero-desc">A live FleetLink fleet listing, maintained for professional travel.</p><div className="hero-actions"><Link to="/contact" className="btn btn--white">Book This Ride</Link></div></div></div></section><section className="fleet-details-main"><div className="container fleet-details-layout"><div className="fleet-details-main-content"><div className="fleet-details-image"><img src={vehicle.imageUrl || fallbackImage} alt={vehicleName(vehicle)} /></div><div className="fleet-details-content"><div className="fleet-details-info"><div><h2>Vehicle Overview</h2><p>This vehicle is currently listed in the FleetLink operations system. Contact our team to confirm availability for your journey.</p></div><div className="fleet-details-specs"><div><strong>Registration</strong><span>{vehicle.registration}</span></div><div><strong>Make</strong><span>{vehicle.make || 'Not specified'}</span></div><div><strong>Model</strong><span>{vehicle.model || 'Not specified'}</span></div><div><strong>Odometer</strong><span>{vehicle.odometerCurrent.toLocaleString()} km</span></div><div><strong>Next service</strong><span>{due}</span></div></div></div></div></div></div></section></div>
}
