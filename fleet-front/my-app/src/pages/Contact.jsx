import { Link } from 'react-router-dom'
import { useState } from 'react'
import Header from '../components/Header'
import {
  ArrowIcon,
  CheckIcon,
  MailIcon,
  MapPinIcon,
  PhoneIcon,
} from '../components/Icons'
import '../App.css'
import './Contact.css'
import { Localized } from './i18n'

const contactDetails = [
  {
    icon: PhoneIcon,
    label: 'Phone',
    value: '0785201554',
  },
  {
    icon: MailIcon,
    label: 'Reach out',
    value: 'support@limoride.com',
  },
  {
    icon: MapPinIcon,
    label: 'Location',
    value: 'Kigali-Rwanda',
  },
]

const highlights = [
  'Premium luxury vehicles with modern comfort features',
  'Personalized transportation solutions for business and private travel',
]

export default function Contact() {
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '', email: '', message: '' })
  const [status, setStatus] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submitMessage(event) {
    event.preventDefault()
    setSubmitting(true)
    setStatus('')
    try {
      const response = await fetch(`${import.meta.env.VITE_FLEETLINK_API_URL || 'http://localhost:3000'}/api/public/contact-messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || 'Your message could not be sent.')
      setForm({ firstName: '', lastName: '', phone: '', email: '', message: '' })
      setStatus('Thank you. Your message has been sent to our team.')
    } catch (error) {
      setStatus(error.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (<Localized>
    <div className="page contact-page">
      <section className="contact-hero">
        <div className="contact-hero-overlay" />
        <Header activePage="contact" />

        <div className="contact-hero-content">
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <Link to="/">Home</Link>
            <span aria-hidden="true">&gt;</span>
            <span>Contact Us</span>
          </nav>
          <h1 className="contact-hero-title">Contact Us</h1>
        </div>
      </section>

      <section className="contact-main">
        <div className="contact-grid">
          <div className="contact-info">
            <span className="section-tag">• CONTACT US •</span>

            <h2 className="contact-heading">
              Get in Touch With Our Luxury Travel Team
            </h2>

            <p className="contact-desc">
              Whether you need airport transfers, corporate travel, or VIP
              transportation, our team is ready to assist you with professional
              chauffeur and luxury transportation services tailored to your needs.
            </p>

            <ul className="contact-highlights">
              {highlights.map((item) => (
                <li key={item}>
                  <span className="check-icon">
                    <CheckIcon />
                  </span>
                  {item}
                </li>
              ))}
            </ul>

            <div className="contact-cards">
              {contactDetails.map(({ icon: Icon, label, value }) => (
                <div className="contact-card" key={label}>
                  <span className="contact-card-icon">
                    <Icon />
                  </span>
                  <div>
                    <span className="contact-card-label">{label}</span>
                    <p className="contact-card-value">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="contact-form-panel">
            <h2 className="contact-form-title">Send a Message</h2>
            <p className="contact-form-desc">
              Fill out the form below and our team will get back to you shortly
              with the support you need.
            </p>

            <form className="contact-form" onSubmit={submitMessage}>
              <div className="contact-form-row">
                <input type="text" placeholder="First name" aria-label="First name" value={form.firstName} onChange={event => setForm({ ...form, firstName: event.target.value })} required />
                <input type="text" placeholder="Last name" aria-label="Last name" value={form.lastName} onChange={event => setForm({ ...form, lastName: event.target.value })} />
              </div>
              <input type="tel" placeholder="Phone Number (e.g. +250788123456)" aria-label="Phone Number with country code" value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} required />
              <input type="email" placeholder="Email Address" aria-label="Email Address" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} required />
              <textarea placeholder="Message" rows={5} aria-label="Message" value={form.message} onChange={event => setForm({ ...form, message: event.target.value })} required />

              <button type="submit" className="btn btn--white" disabled={submitting}>
                {submitting ? 'Sending…' : 'Send Message'}
                <ArrowIcon dark />
              </button>
              {status && <p className="contact-form-desc" role="status">{status}</p>}
            </form>
          </div>
        </div>
      </section>
    </div>
  </Localized>)
}
