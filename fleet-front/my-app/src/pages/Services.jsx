import { Link } from 'react-router-dom'
import { ArrowIcon } from '../components/Icons'
import Header from '../components/Header'
import { Localized } from './i18n'
import './Services.css'

const services = [
  {
    title: 'Executive Airport Transfers',
    description: 'Punctual, luxury transport for arrivals and departures with VIP welcome service.',
    image: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=80',
    icon: '✈️',
  },
  {
    title: 'Corporate Travel Solutions',
    description: 'Executive chauffeur services for meetings, conferences, and business itineraries.',
    image: 'https://images.unsplash.com/photo-1511919884226-fd3cad34687c?auto=format&fit=crop&w=1200&q=80',
    icon: '🏢',
  },
  {
    title: 'Luxury Vehicle Rentals',
    description: 'A premium fleet of sedans, SUVs, and stretch limousines for every VIP occasion.',
    image: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=1200&q=80',
    icon: '🚘',
  },
  {
    title: 'Event & Gala Transport',
    description: 'Arrive in style for weddings, awards nights, and high-profile events with elegant service.',
    image: 'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?auto=format&fit=crop&w=1200&q=80',
    icon: '🎉',
  },
  {
    title: 'VIP Concierge Travel',
    description: 'Tailored itineraries, private pickups, and white-glove support for premium guests.',
    image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
    icon: '💼',
  },
  {
    title: 'City Tour Chauffeur Service',
    description: 'Explore landmarks and premium districts with a knowledgeable chauffeur at your side.',
    image: 'https://images.unsplash.com/photo-1511919884226-fd3cad34687c?auto=format&fit=crop&w=1200&q=80',
    icon: '🗺️',
  },
]

const faqs = [
  {
    question: 'How do I book a service?',
    answer: 'Choose any service and submit a request through our contact page for a fast confirmation.',
  },
  {
    question: 'Can I request an airport pickup?',
    answer: 'Yes, we provide seamless airport transfers with flight tracking and meet-and-greet service.',
  },
  {
    question: 'Do you offer hourly chauffeur packages?',
    answer: 'We offer flexible hourly and day-rate packages for corporate travel, events, and sightseeing.',
  },
]

export default function Services() {
  return (<Localized>
    <div className="page services-page">
      <section className="hero services-hero">
        <div className="hero-overlay" />
        <Header activePage="services" />

        <div className="container hero-content">
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <a href="/">Home</a>
            <span aria-hidden="true">›</span>
            <span>Services</span>
          </nav>

          <span className="badge">Premium Chauffeur Services</span>
          <h1 className="hero-title">Luxury Transport for Every Occasion</h1>
          <p className="hero-desc">
            Full-service executive travel, airport transfers, VIP events, and bespoke chauffeur support across the city.
          </p>
          <div className="hero-actions">
            <a href="#services" className="btn btn--white">
              Explore Services
              <ArrowIcon />
            </a>
          </div>
        </div>

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
      </section>

      <section className="services-grid" id="services">
        <div className="container">
          <div className="services-list">
            {services.map((service) => (
              <article className="service-card" key={service.title}>
                <div className="service-thumb" style={{ backgroundImage: `url(${service.image})` }}>
                  <span className="service-icon">{service.icon}</span>
                </div>
                <div className="service-copy">
                  <h3>{service.title}</h3>
                  <p>{service.description}</p>
                  <Link to="/contact" className="service-link">
                    Learn More <ArrowIcon />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="services-faq">
        <div className="container faq-panel">
          <div className="faq-heading">
            <span className="badge badge--soft">Need Help?</span>
            <h2>Frequently Asked Questions</h2>
            <p>
              Get answers to common requests so you can book with confidence and enjoy a flawless luxury journey.
            </p>
          </div>

          <div className="faq-grid">
            {faqs.map((item) => (
              <article className="faq-card" key={item.question}>
                <h3>{item.question}</h3>
                <p>{item.answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  </Localized>)
}
