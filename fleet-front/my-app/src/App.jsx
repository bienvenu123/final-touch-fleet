import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Home from './pages/Home'
import Contact from './pages/Contact'
import About from './pages/About'
import Fleet from './pages/Fleet'
import FleetDetails from './pages/FleetDetails'
import Services from './pages/Services'
import AdminDashboard from './pages/AdminDashboard'
import Login from './pages/Login'
import OperationsPortal from './pages/OperationsPortal'
import { getSession, hasAdminAccess } from './auth'
import './App.css'
import Footer from './components/Footer'
import WhatsAppButton from './components/WhatsAppButton'

const roleHome = { SUPER_ADMIN: '/super-admin', FLEET_MANAGER: '/fleet-manager', DEPARTMENT_HEAD: '/department-head', STAFF: '/staff' }

function ProtectedRole({ roles, children }) {
  const session = getSession()
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
  const isPortal = ['/admin', '/portal', '/login', '/super-admin', '/fleet-manager', '/department-head', '/staff'].includes(location.pathname)
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
