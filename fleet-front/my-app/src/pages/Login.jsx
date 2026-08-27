import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AUTH_STORAGE_KEY } from '../auth'
import './Login.css'

const API_URL = import.meta.env.VITE_FLEETLINK_API_URL || 'http://localhost:3000'

function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError(''); setLoading(true)
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
      })
      const data = await response.json().catch(() => ({ message: 'The API returned an invalid response.' }))
      if (!response.ok) throw new Error(data.message || 'Unable to sign in.')
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data))
      localStorage.setItem('fleetlink_admin_token', data.token)
      navigate(['FLEET_MANAGER', 'SUPER_ADMIN'].includes(data.user?.role) ? '/admin' : '/portal', { replace: true })
    } catch (requestError) { setError(requestError.message) }
    finally { setLoading(false) }
  }

  return <main className="login-page"><section className="login-panel"><a href="/" className="login-brand">Fleet<span>Link</span></a><p className="login-kicker">SECURE OPERATIONS PORTAL</p><h1>Welcome back.</h1><p className="login-copy">Sign in with your Fleet Manager or Super Admin account to access your tenant’s control centre.</p><form onSubmit={handleSubmit}><label>Email address<input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} required placeholder="name@company.com" /></label><label>Password<input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required placeholder="Enter your password" /></label>{error && <p className="login-error" role="alert">{error}</p>}<button disabled={loading} type="submit">{loading ? 'Signing in…' : 'Sign in securely'}</button></form><p className="login-note">Your access is protected by FleetLink role-based permissions.</p></section><aside className="login-aside"><div><p>FLEETLINK CONTROL CENTRE</p><h2>See every vehicle, booking, and rental in one place.</h2><span>Authenticated access · Tenant-isolated data · Full audit visibility</span></div></aside></main>
}

export default Login
