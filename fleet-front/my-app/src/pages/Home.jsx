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
        <a href="/contact" className="btn btn--white">
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
  return (
    <section className="booking" id="booking">
      <div className="booking-intro">
        <h2 className="booking-title">Book Your Luxury Ride</h2>
        <p className="booking-subtitle">
          Experience premium chauffeur travel with executive-class comfort.
        </p>
      </div>

      <form className="booking-form" onSubmit={(e) => e.preventDefault()}>
        <div className="form-field">
          <label htmlFor="name">Name</label>
          <input id="name" type="text" placeholder="Enter Your Name" />
        </div>

        <div className="form-field">
          <label htmlFor="mobile">Mobile Number</label>
          <input id="mobile" type="tel" placeholder="Enter Mobile Number" />
        </div>

        <div className="form-field">
          <label htmlFor="pickup">Pickup Destination</label>
          <input id="pickup" type="text" placeholder="Enter Pickup Destination" />
        </div>

        <div className="form-field">
          <label htmlFor="guests">Travel Guest</label>
          <select id="guests" defaultValue="">
            <option value="" disabled>
              Enter Travel Guest
            </option>
            <option value="1">1 Guest</option>
            <option value="2">2 Guests</option>
            <option value="3">3 Guests</option>
            <option value="4">4+ Guests</option>
          </select>
        </div>

        <div className="form-field">
          <label htmlFor="date">Date</label>
          <input id="date" type="date" />
        </div>

        <button type="submit" className="btn btn--navy btn--submit">
          Send a Request
          <ArrowIcon />
        </button>
      </form>
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
