import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Home from './pages/Home'
import Contact from './pages/Contact'
import About from './pages/About'
import Fleet from './pages/Fleet'
import FleetDetails from './pages/FleetDetails'
import Services from './pages/Services'
import AdminDashboard from './pages/AdminDashboard'
import Login from './pages/Login'
import OperationsPortal from './pages/OperationsPortal'
import RolePortal from './pages/RolePortal'
import { getSession, getWebSession, hasAdminAccess } from './auth'
import './App.css'
import './pages/ControlCentreTheme.css'
import Footer from './components/Footer'
import WhatsAppButton from './components/WhatsAppButton'

const roleHome = { SUPER_ADMIN: '/super-admin', FLEET_MANAGER: '/fleet-manager', DEPARTMENT_HEAD: '/department-head', STAFF: '/staff', DRIVER: '/driver', CUSTOMER: '/customer', FINANCE: '/finance', EXECUTIVE: '/finance' }

function useSessionRefresh() {
  const [, setRevision] = useState(0)
  useEffect(() => {
    const refresh = () => setRevision(value => value + 1)
    window.addEventListener('pageshow', refresh)
    window.addEventListener('storage', refresh)
    window.addEventListener('fleetlink:session-change', refresh)
    return () => {
      window.removeEventListener('pageshow', refresh)
      window.removeEventListener('storage', refresh)
      window.removeEventListener('fleetlink:session-change', refresh)
    }
  }, [])
}

function ProtectedRole({ roles, children }) {
  const session = roles.includes('CUSTOMER') ? (getWebSession() || getSession()) : getSession()
  if (!session) return <Navigate to="/login" replace />
  return roles.includes(session.user.role) ? children : <Navigate to={roleHome[session.user.role] || '/login'} replace />
}

function ProtectedAdmin() {
  return hasAdminAccess() ? <Navigate to={roleHome[getSession()?.user?.role]} replace /> : getSession() ? <Navigate to={roleHome[getSession()?.user?.role] || '/login'} replace /> : <Navigate to="/login" replace />
}

function ProtectedPortal() {
  return getSession() ? <Navigate to={roleHome[getSession()?.user?.role] || '/login'} replace /> : <Navigate to="/login" replace />
}

function AppLayout() {
  const location = useLocation()
  useSessionRefresh()
  useEffect(() => {
    const protectedPath = path => /^\/(admin|portal|super-admin|fleet-manager|department-head|staff|driver|customer|finance)(\/|$)/.test(path)
    const sessionForPath = path => path.startsWith('/customer') ? (getWebSession() || getSession()) : getSession()
    const suspendProtectedPage = () => {
      if (protectedPath(window.location.pathname)) document.documentElement.dataset.authSuspended = 'true'
    }
    const restoreOrRedirect = () => {
      const path = window.location.pathname
      if (protectedPath(path) && !sessionForPath(path)) {
        window.location.replace('/login')
        return
      }
      delete document.documentElement.dataset.authSuspended
      window.dispatchEvent(new Event('fleetlink:session-change'))
    }
    window.addEventListener('pagehide', suspendProtectedPage)
    window.addEventListener('pageshow', restoreOrRedirect)
    return () => {
      window.removeEventListener('pagehide', suspendProtectedPage)
      window.removeEventListener('pageshow', restoreOrRedirect)
    }
  }, [])
  const isPortal = ['/admin', '/portal', '/login', '/super-admin', '/fleet-manager', '/department-head', '/staff', '/driver', '/customer', '/finance'].includes(location.pathname)
  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/services" element={<Services />} />
        <Route path="/fleet" element={<Fleet />} />
        <Route path="/fleet/:vehicleId" element={<FleetDetails />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/login" element={<Login />} />
        <Route path="/admin" element={<ProtectedAdmin />} />
        <Route path="/portal" element={<ProtectedPortal />} />
        <Route path="/super-admin" element={<ProtectedRole roles={['SUPER_ADMIN']}><AdminDashboard /></ProtectedRole>} />
        <Route path="/fleet-manager" element={<ProtectedRole roles={['FLEET_MANAGER']}><AdminDashboard /></ProtectedRole>} />
        <Route path="/department-head" element={<ProtectedRole roles={['DEPARTMENT_HEAD']}><OperationsPortal /></ProtectedRole>} />
        <Route path="/staff" element={<ProtectedRole roles={['STAFF']}><OperationsPortal /></ProtectedRole>} />
        <Route path="/driver" element={<ProtectedRole roles={['DRIVER']}><RolePortal type="driver" /></ProtectedRole>} />
        <Route path="/customer" element={<ProtectedRole roles={['CUSTOMER']}><RolePortal type="customer" /></ProtectedRole>} />
        <Route path="/finance" element={<ProtectedRole roles={['FINANCE', 'EXECUTIVE']}><RolePortal type="finance" /></ProtectedRole>} />
      </Routes>
      {!isPortal && <><Footer /><WhatsAppButton /></>}
    </>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  )
}

export default App
