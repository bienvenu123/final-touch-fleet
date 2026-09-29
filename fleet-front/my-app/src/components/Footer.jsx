import React, { useState } from 'react'
import './Footer.css'

import { Localized } from '../pages/i18n'
import { API_URL } from '../api'

export default function Footer() {
  const [email, setEmail] = useState('')
  const [consent, setConsent] = useState(false)
  const [status, setStatus] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function subscribe(event) {
    event.preventDefault()
    setStatus('')
    setSubmitting(true)
    try {
      const response = await fetch(`${API_URL}/api/newsletter/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, consent }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || 'Unable to subscribe right now. Please try again.')
      setStatus(data.message || 'You’re subscribed to FleetLink email updates.')
      setEmail('')
      setConsent(false)
    } catch (error) {
      setStatus(error.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (<Localized>
    <footer className="site-footer">
      <div className="footer-hero">
        <div className="hero-left">
          <div className="brand">Fleet-Link</div>
          <h1>Premium Travel. Executive Comfort.</h1>
          <p className="sub">Luxury transportation solutions for airport transfers, business trips, and VIP travel experiences.</p>
        </div>
        <div className="hero-right">
          <p>Professional chauffeur services and premium vehicles crafted for elegant modern journeys.</p>
          <form className="subscribe-form" onSubmit={subscribe}>
            <div className="subscribe">
              <input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="Enter your email address" aria-label="Email address for FleetLink updates" />
              <button type="submit" aria-label="Subscribe to FleetLink email updates" disabled={submitting}>{submitting ? '…' : '→'}</button>
            </div>
            <label className="subscribe-consent"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} required />I agree to receive FleetLink email updates. Contact support to unsubscribe.</label>
            {status && <p className="subscribe-status" role="status">{status}</p>}
          </form>
        </div>
      </div>

      <div className="footer-main">
        <div className="col">
          <h4>QUICK LINKS</h4>
          <ul>
            <li>Home</li>
            <li>About Us</li>
            <li>Our Fleet</li>
            <li>Services</li>
            <li>Pricing</li>
            <li>Blogs</li>
          </ul>
        </div>

        <div className="col">
          <h4>OUR SERVICES</h4>
          <ul>
            <li>Executive Chauffeur</li>
            <li>Airport Transfer</li>
            <li>Luxury Car Rental</li>
            <li>Corporate Travel</li>
            <li>Event Transportation</li>
            <li>VIP Travel Service</li>
          </ul>
        </div>

        <div className="col social">
          <h4>FOLLOW US ON</h4>
          <ul>
            <li className="icon">f <span>Facebook</span></li>
            <li className="icon">ig <span>Instagram</span></li>
            <li className="icon">x <span>Twitter (x)</span></li>
            <li className="icon">▶ <span>Youtube</span></li>
          </ul>
        </div>

        <div className="col contact">
          <h4>CONTACT INFORMATIONS</h4>
          <ul>
            <li><strong>0785201554</strong><br/><small>24/7 Luxury Travel Assistance</small></li>
            <li><strong>support@limoride.com</strong><br/><small>Premium Customer Support</small></li>
            <li>Kigali-Rwanda</li>
            <li>Mon – Sun: 24 Hours Available</li>
          </ul>
        </div>
      </div>

      <div className="footer-bottom">
        <div className="left">Copyright © 2026 Fleet-Link. All Rights Reserved.</div>
        <div className="right">Privacy & Policy&nbsp;&nbsp; Term's & Condition&nbsp;&nbsp; Cookie Policy</div>
      </div>
    </footer>
  </Localized>)
}
