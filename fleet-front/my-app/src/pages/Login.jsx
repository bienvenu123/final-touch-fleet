import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AUTH_STORAGE_KEY, WEB_AUTH_STORAGE_KEY } from '../auth'
import './Login.css'
import { Localized } from './i18n'

const API_URL = import.meta.env.VITE_FLEETLINK_API_URL || 'http://localhost:3000'

function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const webAuth = Boolean(location.state?.webAuth)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [creatingAccount, setCreatingAccount] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (webAuth && creatingAccount) {
        if (password !== confirmPassword) throw new Error('Passwords do not match.')
        const registration = await fetch(`${API_URL}/auth/customer-signup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password, contact }),
        })
        const registrationData = await registration.json().catch(() => ({}))
        if (!registration.ok) throw new Error(registrationData.message || 'Unable to create your account.')
      }

      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await response.json().catch(() => ({ message: 'The API returned an invalid response.' }))
      if (!response.ok) throw new Error(data.message || 'Unable to sign in.')
      if (webAuth && data.user?.role !== 'CUSTOMER') throw new Error('Use a customer account to book on the website.')

      const session = { ...data, user: { ...data.user, email, ...(webAuth && creatingAccount ? { name, contact } : {}) } }
      localStorage.setItem(webAuth ? WEB_AUTH_STORAGE_KEY : AUTH_STORAGE_KEY, JSON.stringify(session))
      if (!webAuth) localStorage.setItem('fleetlink_admin_token', data.token)
      const defaultPath = ['FLEET_MANAGER', 'SUPER_ADMIN'].includes(data.user?.role) ? '/admin' : '/portal'
      const returnTo = location.state?.returnTo
      navigate(webAuth ? '/customer' : (returnTo || defaultPath), {
        replace: true,
        state: returnTo ? { bookingVehicleId: location.state?.bookingVehicleId, openBooking: true } : undefined,
      })
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  return <Localized><main className="login-page"><section className="login-panel"><a href="/" className="login-brand">Fleet<span>Link</span></a><p className="login-kicker">{webAuth ? 'WEBSITE CUSTOMER ACCOUNT' : 'SECURE OPERATIONS PORTAL'}</p><h1>{creatingAccount ? 'Create your account.' : 'Welcome back.'}</h1><p className="login-copy">{webAuth ? 'Sign in or create a customer account to book a vehicle on the website.' : 'Sign in with your Fleet Manager or Super Admin account to access your tenant’s control centre.'}</p><form onSubmit={handleSubmit}>{webAuth && creatingAccount && <><label>Your name<input type="text" autoComplete="name" value={name} onChange={event => setName(event.target.value)} required placeholder="Your name" /></label><label>Mobile number<input type="tel" autoComplete="tel" value={contact} onChange={event => setContact(event.target.value)} placeholder="Include country code" /></label></>}<label>Email address<input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} required placeholder="name@company.com" /></label><label>Password<input type="password" autoComplete={creatingAccount ? 'new-password' : 'current-password'} minLength={creatingAccount ? 8 : undefined} value={password} onChange={event => setPassword(event.target.value)} required placeholder={creatingAccount ? 'At least 8 characters' : 'Enter your password'} /></label>{webAuth && creatingAccount && <label>Confirm password<input type="password" autoComplete="new-password" minLength={8} value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} required placeholder="Re-enter your password" /></label>}{error && <p className="login-error" role="alert">{error}</p>}<button disabled={loading} type="submit">{loading ? 'Please wait…' : creatingAccount ? 'Create account' : 'Sign in securely'}</button></form>{webAuth && <button type="button" className="login-toggle" onClick={() => { setCreatingAccount(!creatingAccount); setError(''); setConfirmPassword('') }}>{creatingAccount ? 'Already have an account? Sign in' : 'New here? Create a customer account'}</button>}<p className="login-note">{webAuth ? 'Website customer sign-in is kept separate from your operations portal session.' : 'Your access is protected by FleetLink role-based permissions.'}</p></section><aside className="login-aside"><div><p>{webAuth ? 'FLEETLINK WEBSITE' : 'FLEETLINK CONTROL CENTRE'}</p><h2>{webAuth ? 'Book a premium ride with your customer account.' : 'See every vehicle, booking, and rental in one place.'}</h2><span>{webAuth ? 'Your requests stay connected to your customer profile.' : 'Authenticated access · Tenant-isolated data · Full audit visibility'}</span></div></aside></main></Localized>
}

export default Login
