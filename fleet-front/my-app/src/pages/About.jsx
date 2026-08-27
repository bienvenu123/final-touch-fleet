import React from 'react'
import Header from '../components/Header'
import { CarIcon, CheckIcon } from '../components/Icons'
import heroImg from '../assets/hero.png'
import './About.css'

export default function About(){
  return (
    <div className="about-page page">
      <section className="hero">
        <div className="hero-overlay" />
        <Header activePage="about" />

        <div className="container about-hero">
        <div className="hero-left">
          <img src={heroImg} alt="chauffeur"/>
          <div className="rating">
            <div className="avatars"> 
              <img src={heroImg} alt="a"/>
              <img src={heroImg} alt="b"/>
              <img src={heroImg} alt="c"/>
            </div>
            <div className="meta">★ 4.9 Client Satisfaction Rating<br/><small>Trusted by 12,000+ Luxury Travelers Worldwide</small></div>
          </div>
        </div>

        <aside className="hero-right">
          <div className="tag">ABOUT FLEET-LINK</div>
          <h2>Delivering Premium Chauffeur & Luxury Travel Experiences</h2>
          <p>At Fleet-Link, we provide first-class chauffeur and luxury transportation services designed for business professionals, airport transfers, special events, and VIP travel experiences.</p>

          <div className="features">
            <div className="feature">
              <div className="icon"><CarIcon /></div>
              <div>
                <h4>Premium Booking Made Simple</h4>
                <p>Experience a fast, secure, and elegant reservation process designed to make luxury travel effortless.</p>
              </div>
            </div>

            <div className="feature">
              <div className="icon"><CheckIcon /></div>
              <div>
                <h4>Safe, Reliable & Luxury Transportation</h4>
                <p>Our experienced chauffeurs and executive fleet deliver exceptional travel experiences tailored for professionals.</p>
              </div>
            </div>
          </div>

          <div className="cta-row">
            <button className="btn primary">Discover Fleet</button>
            <div className="support">Support 24/7<br/><strong>0785201554</strong></div>
          </div>
        </aside>
        </div>
      </section>

      <section className="dark-panel">
        <div className="container">
          <h3>Delivering Reliable Chauffeur and Premium Car Rental Services for Every Journey</h3>
          <p className="lead">We are dedicated to providing luxury chauffeur and premium car rental services that combine comfort, safety, and professionalism for every journey.</p>

          <div className="cards">
            <div className="card"> 
              <div className="num">01</div>
              <h4>Professional Chauffeurs</h4>
              <p>Our experienced chauffeurs deliver exceptional travel experiences tailored for business professionals.</p>
              <img src={heroImg} alt="car"/>
            </div>

            <div className="card">
              <div className="num">02</div>
              <h4>Fast & Easy Reservations</h4>
              <p>Reserve your luxury vehicle quickly through our seamless online booking system.</p>
              <img src={heroImg} alt="car"/>
            </div>

            <div className="card">
              <div className="num">03</div>
              <h4>Premium Luxury Fleet</h4>
              <p>Choose from a wide range of luxury sedans, SUVs, limousines, and executive vehicles.</p>
              <img src={heroImg} alt="car"/>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
