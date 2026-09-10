import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowIcon, CarIcon, ChevronDown } from './Icons'

const navItems = [
  { label: 'Home', to: '/', dropdown: true },
  { label: 'Fleets', to: '/fleet', dropdown: true },
  { label: 'About Us', to: '/about' },
  { label: 'Services', to: '/services' },
  { label: 'Blog', to: '#', dropdown: true },
  { label: 'Pages', to: '#', dropdown: true },
  { label: 'Contact Us', to: '/contact' },
]

export default function Header({ activePage = 'home', showBookButton = true }) {
  const [open, setOpen] = useState(false)
  return (
    <header className="header">
      <Link to="/" className="logo">
        <span className="logo-icon">
          <CarIcon />
        </span>
        Fleet-Link
      </Link>

      <nav className="nav-pill" aria-label="Main navigation">
        <ul className="nav-list">
          {navItems.map((item) => {
            const isActive =
              (activePage === 'home' && item.to === '/') ||
              (activePage === 'services' && item.to === '/services') ||
              ((activePage === 'fleet' || activePage === 'fleets') && item.to === '/fleet') ||
              (activePage === 'about' && item.to === '/about') ||
              (activePage === 'contact' && item.to === '/contact')

            return (
              <li key={item.label}>
                {item.to.startsWith('/') ? (
                  <Link
                    to={item.to}
                    className={`nav-link ${isActive ? 'nav-link--active' : ''}`}
                  >
                    {item.label}
                    {item.dropdown && <ChevronDown />}
                  </Link>
                ) : (
                  <a href={item.to} className="nav-link">
                    {item.label}
                    {item.dropdown && <ChevronDown />}
                  </a>
                )}
              </li>
            )
          })}
        </ul>
      </nav>

      <button
        className="menu-btn"
        aria-expanded={open}
        aria-label="Toggle menu"
        onClick={() => setOpen((s) => !s)}
      >
        <span className="hamburger" aria-hidden="true">
          <svg width="20" height="14" viewBox="0 0 20 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="20" height="2" rx="1" fill="currentColor" />
            <rect y="6" width="20" height="2" rx="1" fill="currentColor" />
            <rect y="12" width="20" height="2" rx="1" fill="currentColor" />
          </svg>
        </span>
      </button>

      {open && (
        <div className="mobile-menu" role="menu">
          <ul>
            {navItems.map((it) => (
              <li key={it.label} onClick={() => setOpen(false)}>
                {it.to.startsWith('/') ? (
                  <Link to={it.to} className="mobile-link">
                    {it.label}
                  </Link>
                ) : (
                  <a href={it.to} className="mobile-link">
                    {it.label}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {showBookButton && (
        <a href="/#booking" className="btn btn--white btn--sm">
          Book a Ride
          <ArrowIcon dark />
        </a>
      )}
    </header>
  )
}
