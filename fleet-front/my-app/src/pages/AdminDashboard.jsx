import { useEffect, useMemo, useState } from 'react'
import { clearSession, getSession } from '../auth'
import FleetOperations from './FleetOperations'
import NewsletterCampaignPanel from './NewsletterCampaignPanel'
import { BillingPanel, MonitoringPanel, RecurringSchedulesPanel, TelemetryPanel } from './AdminFeaturePanels'
import { TranslationTree, useLanguage } from './i18n'
import './AdminDashboard.css'
import './AdminDashboardScrollbar.css'
import './FleetCrud.css'
import './BookingDetails.css'
import './BookingEdit.css'

const API_URL = import.meta.env.VITE_FLEETLINK_API_URL || 'http://localhost:3000'

const menu = [
  ['overview', 'Overview'],
  ['tenants', 'Tenant management'],
  ['organization', 'Organisation & departments'], ['users', 'Users & access'],
  ['fleet', 'Fleet & maintenance'], ['availability', 'Vehicle availability'], ['serviceHistory', 'Service history'],
  ['bookings', 'Corporate bookings'],
  ['contactMessages', 'Contact messages'],
  ['newsletter', 'Email campaigns'],
  ['operations', 'Drivers & trips'],
  ['config', 'Tenant configuration'],
  ['customers', 'Rental customers'], ['rentals', 'Rental reservations'], ['inspections', 'Rental inspections'],
  ['analytics', 'Analytics'], ['reports', 'Reports'], ['schedules', 'Report schedules'],
  ['telematics', 'Live locations'], ['monitoring', 'System monitoring'], ['billing', 'Vehicle billing'],
  ['audit', 'Audit log'], ['settings', 'System access'],
]

const superAdminOnlyPages = new Set(['tenants', 'organization', 'users', 'settings', 'billing'])

async function request(path, token, init = {}) {
  const isFormData = init.body instanceof FormData
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.body && !isFormData ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
  })
  const data = await response.json().catch(() => ({ message: response.statusText }))
  if (!response.ok) throw new Error(data.message || data.error || 'FleetLink request failed')
  return data
}

const Metric = ({ label, value, note }) => <article className="admin-metric"><span>{label}</span><strong>{value ?? '—'}</strong>{note && <small>{note}</small>}</article>

function AdminDashboard() {
  const [token, setToken] = useState(() => getSession()?.token || '')
  const activePageStorageKey = `fleetlink_admin_active_page:${getSession()?.user?.id || 'anonymous'}`
  const [active, setActive] = useState(() => {
    const savedPage = sessionStorage.getItem(activePageStorageKey)
    return menu.some(([key]) => key === savedPage) ? savedPage : 'overview'
  })
  const [status, setStatus] = useState('Your authenticated session is loading tenant data.')
  const [dashboard, setDashboard] = useState(null)
  const [maintenance, setMaintenance] = useState(null)
  const [auditLogs, setAuditLogs] = useState([])
  const [report, setReport] = useState(null)
  const [vehicles, setVehicles] = useState([])
  const [bookings, setBookings] = useState([])
  const [selectedBooking, setSelectedBooking] = useState(null)
  const [editingBooking, setEditingBooking] = useState(null)
  const [contactMessages, setContactMessages] = useState([])
  const [reservations, setReservations] = useState([])
  const [customers, setCustomers] = useState([])
  const [tenants, setTenants] = useState([])
  const [departments, setDepartments] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [vehicleForm, setVehicleForm] = useState({ registration: '', make: '', model: '', odometerCurrent: '0', departmentId: '' })
  const [vehicleImage, setVehicleImage] = useState(null)
  const [vehicleImageInputKey, setVehicleImageInputKey] = useState(0)
  const [editingVehicleId, setEditingVehicleId] = useState(null)
  const [entitlement, setEntitlement] = useState(null)
  const [billing, setBilling] = useState(null)
  const [billingDraft, setBillingDraft] = useState({ vehicleLimit: '', vehicleRateCents: '0' })
  const [locationVehicleId, setLocationVehicleId] = useState('')
  const [locations, setLocations] = useState([])
  const [runtimeMetrics, setRuntimeMetrics] = useState(null)
  const [reportSchedules, setReportSchedules] = useState([])
  const [editingScheduleId, setEditingScheduleId] = useState(null)
  const [language, setLanguage] = useLanguage()
  const [locationVehicle, setLocationVehicle] = useState(null)
  const [departmentForm, setDepartmentForm] = useState({ name: '', costCentreCode: '', budgetCode: '' })
  const [editingDepartmentId, setEditingDepartmentId] = useState(null)
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '', role: 'STAFF', departmentId: '', contact: '' })
  const [editingUserId, setEditingUserId] = useState(null)
  const [customerForm, setCustomerForm] = useState({ name: '', email: '', driverLicense: '', contact: '' })
  const [editingCustomerId, setEditingCustomerId] = useState(null)
  const [tenantForm, setTenantForm] = useState({ name: '', sector: '', package: 'Starter', billingStatus: 'ACTIVE' })
  const [editingTenantId, setEditingTenantId] = useState(null)
  const [availabilityForm, setAvailabilityForm] = useState({ start: '', end: '' })
  const [availableVehicles, setAvailableVehicles] = useState([])
  const [serviceVehicleId, setServiceVehicleId] = useState('')
  const [serviceRecords, setServiceRecords] = useState([])
  const [serviceForm, setServiceForm] = useState({ serviceDate: '', odometerMileage: '', description: '', cost: '', nextDueDate: '', nextDueMileage: '' })
  const initialBookingForm = { vehicleId: '', serviceType: 'SELF_DRIVE', start: '', end: '', passengerCount: '1', justification: '', destination: '', pickupLocation: '', guestName: '', guestContact: '', kind: 'CORPORATE' }
  const [bookingForm, setBookingForm] = useState(initialBookingForm)
  const [rentalForm, setRentalForm] = useState({ vehicleId: '', customerId: '', start: '', end: '', agreedRate: '', depositAmount: '', depositPaid: false })
  const [inspectionForm, setInspectionForm] = useState({ reservationId: '', type: 'checkout', odometerReading: '', fuelLevel: '', conditionNotes: '', conditionPhotos: '' })
  const [inspectionMessage, setInspectionMessage] = useState(null)
  const [scheduleForm, setScheduleForm] = useState({ recipient: '', reportType: 'RENTAL_PERFORMANCE', format: 'pdf', start: '', end: '', currency: 'USD', locale: 'en-US', scheduleAt: '', cron: '0 8 * * 1', timezone: 'Africa/Kigali' })
  const [tenantConfig, setTenantConfig] = useState(null)
  const [configDraft, setConfigDraft] = useState({ locale: 'en', currency: 'USD', approvalWorkflow: '{}', notificationSettings: '{}', notificationTemplates: '{}', customFields: '{}', roleConfiguration: '{}', integrationSettings: '{}' })
  const [reportRange, setReportRange] = useState({ start: '', end: '', currency: 'USD', locale: 'en-US' })
  const [reportExportType, setReportExportType] = useState('RENTAL_PERFORMANCE')

  const connected = Boolean(dashboard)
  const isSystemAdmin = getSession()?.user?.role === 'SUPER_ADMIN'
  const recentLogs = useMemo(() => auditLogs.slice(0, 5), [auditLogs])
  const inspectionHistory = useMemo(() => reservations.flatMap(reservation => (reservation.inspections || []).map(inspection => ({ reservation, inspection }))), [reservations])

  useEffect(() => { sessionStorage.setItem(activePageStorageKey, active) }, [active, activePageStorageKey])

  async function loadOverview() {
    if (!token.trim()) return setStatus('Your session has expired. Please sign in again.')
    setLoading(true)
    try {
      const results = await Promise.allSettled([
        request('/fleet/dashboard', token),
        request('/fleet/maintenance/approaching?days=30&mileage=1000', token),
        request('/api/audit-logs?limit=5', token),
        request('/api/reports/performance', token),
        request('/fleet/vehicles?limit=100', token),
        request('/api/bookings?limit=100', token),
        request('/api/rental-reservations?limit=100', token),
        request('/api/customers?limit=100', token),
        request('/api/entitlements', token),
      ])
      const [dashboardResult, maintenanceResult, auditResult, reportResult, vehicleResult, bookingResult, reservationResult, customerResult, entitlementResult] = results
      if (dashboardResult.status === 'rejected') throw dashboardResult.reason
      const dashboardData = dashboardResult.value
      localStorage.setItem('fleetlink_admin_token', token)
      setDashboard(dashboardData)
      if (maintenanceResult.status === 'fulfilled') setMaintenance(maintenanceResult.value)
      if (auditResult.status === 'fulfilled') setAuditLogs(auditResult.value.auditLogs || [])
      if (reportResult.status === 'fulfilled') setReport(reportResult.value.report)
      if (vehicleResult.status === 'fulfilled') setVehicles(vehicleResult.value.vehicles || [])
      if (bookingResult.status === 'fulfilled') setBookings(bookingResult.value.bookings || [])
      if (reservationResult.status === 'fulfilled') setReservations(reservationResult.value.reservations || [])
      if (customerResult.status === 'fulfilled') setCustomers(customerResult.value.customers || [])
      if (entitlementResult.status === 'fulfilled') setEntitlement(entitlementResult.value.entitlement)
      const unavailable = results.filter(result => result.status === 'rejected').length
      setStatus(unavailable ? `Connected to tenant ${dashboardData.tenantId}; ${unavailable} non-critical data section${unavailable === 1 ? ' is' : 's are'} unavailable.` : `Connected to tenant ${dashboardData.tenantId}.`)
    } catch (error) { setDashboard(null); setStatus(error.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { if (token) loadOverview() }, []) // Restore the current admin session after refresh.
  useEffect(() => {
    if (!entitlement) return
    const featureByPage = { analytics: 'advancedAnalytics', reports: 'advancedReports', schedules: 'scheduledExports', telematics: 'gpsTelematics' }
    const requiredFeature = featureByPage[active]
    if (requiredFeature && !entitlement.features?.[requiredFeature]) setActive('overview')
  }, [entitlement, active])

  async function loadAnalytics() {
    setLoading(true)
    try {
      const results = await Promise.allSettled([
        request(`/api/analytics/fuel-efficiency?start=${encodeURIComponent(reportRange.start)}&end=${encodeURIComponent(reportRange.end)}`, token),
        request(`/api/analytics/maintenance-compliance?start=${encodeURIComponent(reportRange.start)}&end=${encodeURIComponent(reportRange.end)}`, token),
        request(`/api/analytics/vehicle-utilization?start=${encodeURIComponent(reportRange.start)}&end=${encodeURIComponent(reportRange.end)}`, token),
        request(`/api/analytics/department-roi?start=${encodeURIComponent(reportRange.start)}&end=${encodeURIComponent(reportRange.end)}`, token),
        request(`/api/analytics/top-requesters?start=${encodeURIComponent(reportRange.start)}&end=${encodeURIComponent(reportRange.end)}`, token),
      ])
      const [fuel, compliance, utilization, departmentRoi, topRequesters] = results.map(result => result.status === 'fulfilled' ? result.value : null)
      if (!fuel || !compliance) throw new Error('Unable to load the core analytics reports.')
      setReport({ ...(report || {}), fuel: fuel.report, compliance: compliance.report, utilization: utilization?.metrics || [], departmentRoi: departmentRoi?.metrics || [], topRequesters: topRequesters?.metrics || [] })
      const unavailable = results.filter(result => result.status === 'rejected').length
      setStatus(unavailable ? `${unavailable} advanced analytics report${unavailable === 1 ? ' is' : 's are'} unavailable for this subscription.` : 'Analytics refreshed.')
    } catch (error) { setStatus(error.message) } finally { setLoading(false) }
  }

  async function loadAudit() {
    setLoading(true)
    try { const data = await request('/api/audit-logs?limit=100', token); setAuditLogs(data.auditLogs || []); setStatus('Audit log refreshed.') }
    catch (error) { setStatus(error.message) } finally { setLoading(false) }
  }

  async function loadSystemAccess() {
    setLoading(true)
    try { const [access, usage] = await Promise.all([request('/api/entitlements', token), request('/api/billing/vehicle-usage', token)]); setEntitlement(access.entitlement); setBilling(usage.billing); setBillingDraft({ vehicleLimit: usage.billing.includedVehicles === null ? '' : String(usage.billing.includedVehicles), vehicleRateCents: String(usage.billing.vehicleRateCents || 0) }); setStatus('System access settings loaded.') }
    catch (error) { setStatus(error.message) } finally { setLoading(false) }
  }
  async function loadTenantConfig() {
    setLoading(true)
    try { const data = await request('/tenants/me/config', token); const config = data.tenant || data; setTenantConfig(config); setLanguage(['fr', 'rw'].includes(config.locale) ? config.locale : 'en'); setConfigDraft({ locale: config.locale || 'en', currency: config.currency || 'USD', approvalWorkflow: JSON.stringify(config.approvalWorkflow || {}, null, 2), notificationSettings: JSON.stringify(config.notificationSettings || {}, null, 2), notificationTemplates: JSON.stringify(config.notificationTemplates || {}, null, 2), customFields: JSON.stringify(config.customFields || {}, null, 2), roleConfiguration: JSON.stringify(config.roleConfiguration || {}, null, 2), integrationSettings: JSON.stringify(config.integrationSettings || {}, null, 2) }); setStatus('Tenant configuration loaded.') }
    catch (error) { setStatus(error.message) } finally { setLoading(false) }
  }
  async function saveTenantConfig(event) {
    event.preventDefault(); setLoading(true)
    try { const payload = { ...configDraft }; ['approvalWorkflow', 'notificationSettings', 'notificationTemplates', 'customFields', 'roleConfiguration', 'integrationSettings'].forEach(key => { payload[key] = JSON.parse(payload[key] || '{}') }); const data = await request('/tenants/me/config', token, { method: 'PATCH', body: JSON.stringify(payload) }); setTenantConfig(data.tenant || data); setStatus('Tenant configuration saved.') }
    catch (error) { setStatus(`Configuration was not saved: ${error.message}`) } finally { setLoading(false) }
  }

  async function updatePackage(packageName) {
    setLoading(true)
    try { const data = await request('/api/entitlements/package', token, { method: 'PATCH', body: JSON.stringify({ package: packageName }) }); setEntitlement(data.entitlement); setStatus(`Subscription changed to ${packageName}.`) }
    catch (error) { setStatus(error.message) } finally { setLoading(false) }
  }
  async function saveVehicleBilling(event) {
    event.preventDefault(); setLoading(true)
    try { const data = await request('/api/billing/vehicle-usage', token, { method: 'PATCH', body: JSON.stringify({ vehicleLimit: billingDraft.vehicleLimit === '' ? null : Number(billingDraft.vehicleLimit), vehicleRateCents: Number(billingDraft.vehicleRateCents) }) }); setBilling(data.billing); setStatus('Vehicle billing settings saved.') }
    catch (error) { setStatus(error.message) } finally { setLoading(false) }
  }
  async function loadLocations() {
    if (!locationVehicleId) return setStatus('Select a vehicle to view its location history.')
    setLoading(true); try { const [history, latest] = await Promise.all([request(`/api/telematics/vehicles/${locationVehicleId}/locations?limit=200`, token), request(`/api/telematics/vehicles/${locationVehicleId}/location`, token)]); setLocations(history.locations || []); setLocationVehicle(latest.location || null); setStatus('Location history loaded.') } catch (error) { setStatus(error.message) } finally { setLoading(false) }
  }
  async function loadMonitoring() {
    setLoading(true); try { const response = await fetch(`${API_URL}/metrics`); if (!response.ok) throw new Error('Monitoring endpoint is unavailable'); setRuntimeMetrics(await response.json()); setStatus('Runtime metrics loaded.') } catch (error) { setStatus(error.message) } finally { setLoading(false) }
  }

  async function loadReportSchedules() {
    setLoading(true); try { const data = await request('/api/reports/schedules', token); setReportSchedules(data.schedules || []); setStatus('Recurring report schedules loaded.') } catch (error) { setStatus(error.message) } finally { setLoading(false) }
  }

  function editSchedule(item) {
    setEditingScheduleId(item.id)
    setScheduleForm({ recipient: item.recipient || '', reportType: item.reportType || 'RENTAL_PERFORMANCE', format: item.format || 'pdf', start: item.start || '', end: item.end || '', currency: item.currency || 'USD', locale: item.locale || 'en-US', cron: item.cron || '0 8 * * 1', timezone: item.timezone || 'UTC', scheduleAt: '' })
  }

  async function cancelSchedule(item) {
    if (!window.confirm(`Cancel the recurring ${item.reportType.replaceAll('_', ' ').toLowerCase()} report?`)) return
    setLoading(true); try { await request(`/api/reports/schedules/${encodeURIComponent(item.id)}`, token, { method: 'DELETE' }); setReportSchedules(current => current.filter(row => row.id !== item.id)); setStatus('Recurring report cancelled.') } catch (error) { setStatus(error.message) } finally { setLoading(false) }
  }

  async function refreshList(key) {
    const endpoints = { tenants: '/tenants', fleet: '/fleet/vehicles?limit=100', bookings: '/api/bookings?limit=100', contactMessages: '/api/contact-messages?limit=100', rentals: '/api/rental-reservations?limit=100', customers: '/api/customers?limit=100', organization: '/api/admin/departments', users: '/api/admin/users?limit=100' }
    setLoading(true)
    try {
      const data = await request(endpoints[key], token)
      if (key === 'fleet') {
        setVehicles(data.vehicles || [])
        if (!departments.length) {
          const departmentData = await request('/api/admin/departments', token)
          setDepartments(departmentData.departments || [])
        }
      }
      if (key === 'bookings') setBookings(data.bookings || [])
      if (key === 'contactMessages') setContactMessages(data.contactMessages || [])
      if (key === 'rentals') setReservations(data.reservations || [])
      if (key === 'customers') setCustomers(data.customers || [])
      if (key === 'tenants') setTenants(data.tenants || [])
      if (key === 'organization') setDepartments(data.departments || [])
      if (key === 'users') {
        setUsers(data.users || [])
        if (!departments.length) {
          const departmentData = await request('/api/admin/departments', token)
          setDepartments(departmentData.departments || [])
        }
      }
      setStatus(`${key[0].toUpperCase()}${key.slice(1)} refreshed.`)
    } catch (error) { setStatus(error.message) } finally { setLoading(false) }
  }
  async function updateContactMessage(message, status) {
    setLoading(true)
    try {
      const data = await request(`/api/contact-messages/${message.id}`, token, { method: 'PATCH', body: JSON.stringify({ status }) })
      setContactMessages(current => current.map(item => item.id === message.id ? data.contactMessage : item))
      setStatus(`Message from ${message.firstName} marked ${status.replace('_', ' ').toLowerCase()}.`)
    } catch (error) { setStatus(error.message) } finally { setLoading(false) }
  }
  function resetTenantForm() { setEditingTenantId(null); setTenantForm({ name: '', sector: '', package: 'Starter', billingStatus: 'ACTIVE' }) }
  function editTenant(tenant) { setEditingTenantId(tenant.id); setTenantForm({ name: tenant.name || '', sector: tenant.sector || '', package: tenant.package || 'Starter', billingStatus: tenant.billingStatus || 'ACTIVE' }) }
  async function saveTenant(event) {
    event.preventDefault(); setLoading(true)
    try { await request(editingTenantId ? `/tenants/${editingTenantId}` : '/tenants', token, { method: editingTenantId ? 'PATCH' : 'POST', body: JSON.stringify(tenantForm) }); const editing = Boolean(editingTenantId); resetTenantForm(); await refreshList('tenants'); setStatus(editing ? 'Tenant updated.' : 'Tenant created.') }
    catch (error) { setStatus(error.message) } finally { setLoading(false) }
  }
  async function removeTenant(tenant) {
    if (!window.confirm(`Delete ${tenant.name}? A tenant with operational data cannot be deleted.`)) return
    setLoading(true)
    try { await request(`/tenants/${tenant.id}`, token, { method: 'DELETE' }); await refreshList('tenants'); setStatus('Tenant deleted.') }
    catch (error) { setStatus(error.message) } finally { setLoading(false) }
  }

  function resetDepartmentForm() { setEditingDepartmentId(null); setDepartmentForm({ name: '', costCentreCode: '', budgetCode: '' }) }
  function editDepartment(department) { setEditingDepartmentId(department.id); setDepartmentForm({ name: department.name || '', costCentreCode: department.costCentreCode || '', budgetCode: department.budgetCode || '' }) }
  async function saveDepartment(event) {
    event.preventDefault(); setLoading(true)
    try { await request(editingDepartmentId ? `/api/admin/departments/${editingDepartmentId}` : '/api/admin/departments', token, { method: editingDepartmentId ? 'PATCH' : 'POST', body: JSON.stringify(departmentForm) }); const editing = Boolean(editingDepartmentId); resetDepartmentForm(); await refreshList('organization'); setStatus(editing ? 'Department updated.' : 'Department created.') }
    catch (error) { setStatus(error.message) } finally { setLoading(false) }
  }
  async function removeDepartment(department) {
    if (!window.confirm(`Delete ${department.name}? Departments with assigned users or vehicles cannot be deleted.`)) return
    setLoading(true)
    try { await request(`/api/admin/departments/${department.id}`, token, { method: 'DELETE' }); await refreshList('organization'); setStatus('Department deleted.') }
    catch (error) { setStatus(error.message) } finally { setLoading(false) }
  }
  function resetUserForm() { setEditingUserId(null); setUserForm({ name: '', email: '', password: '', role: 'STAFF', departmentId: '', contact: '' }) }
  function editUser(user) { setEditingUserId(user.id); setUserForm({ name: user.name || '', email: user.email || '', password: '', role: user.role || 'STAFF', departmentId: user.departmentId || '', contact: user.contact || '' }) }
  async function saveUser(event) {
    event.preventDefault(); setLoading(true)
    try { const payload = { ...userForm, departmentId: userForm.departmentId || null }; if (editingUserId && !payload.password) delete payload.password; await request(editingUserId ? `/api/admin/users/${editingUserId}` : '/api/admin/users', token, { method: editingUserId ? 'PATCH' : 'POST', body: JSON.stringify(payload) }); const editing = Boolean(editingUserId); resetUserForm(); await refreshList('users'); setStatus(editing ? 'User updated.' : 'User created.') }
    catch (error) { setStatus(error.message) } finally { setLoading(false) }
  }
  async function deactivateUser(user) {
    if (!window.confirm(`Deactivate ${user.name}? They will no longer be able to sign in.`)) return
    setLoading(true)
    try { await request(`/api/admin/users/${user.id}`, token, { method: 'DELETE' }); await refreshList('users'); setStatus('User deactivated.') }
    catch (error) { setStatus(error.message) } finally { setLoading(false) }
  }
  function resetCustomerForm() { setEditingCustomerId(null); setCustomerForm({ name: '', email: '', driverLicense: '', contact: '' }) }
  function editCustomer(customer) { setEditingCustomerId(customer.id); setCustomerForm({ name: customer.name || '', email: customer.email || '', driverLicense: customer.driverLicense || '', contact: customer.contact || '' }) }
  async function saveCustomer(event) {
    event.preventDefault(); setLoading(true)
    try { await request(editingCustomerId ? `/api/customers/${editingCustomerId}` : '/api/customers', token, { method: editingCustomerId ? 'PATCH' : 'POST', body: JSON.stringify(customerForm) }); const editing = Boolean(editingCustomerId); resetCustomerForm(); await refreshList('customers'); setStatus(editing ? 'Customer updated.' : 'Customer created.') }
    catch (error) { setStatus(error.message) } finally { setLoading(false) }
  }
  async function removeCustomer(customer) {
    if (!window.confirm(`Delete ${customer.name}? Customers with rental history are retained for audit purposes.`)) return
    setLoading(true)
    try { await request(`/api/customers/${customer.id}`, token, { method: 'DELETE' }); await refreshList('customers'); setStatus('Customer deleted.') }
    catch (error) { setStatus(error.message) } finally { setLoading(false) }
  }
  async function searchAvailability(event) {
    event.preventDefault(); setLoading(true)
    try { const data = await request(`/api/vehicles/available?start=${encodeURIComponent(new Date(availabilityForm.start).toISOString())}&end=${encodeURIComponent(new Date(availabilityForm.end).toISOString())}`, token); setAvailableVehicles(data.vehicles || []); setStatus('Vehicle availability updated.') }
    catch (error) { setStatus(error.message) } finally { setLoading(false) }
  }
  async function loadServiceHistory(vehicleId) {
    setServiceVehicleId(vehicleId); if (!vehicleId) return setServiceRecords([]); setLoading(true)
    try { const data = await request(`/fleet/vehicles/${vehicleId}/service-records`, token); setServiceRecords(data.serviceRecords || []); setStatus('Service history loaded.') }
    catch (error) { setStatus(error.message) } finally { setLoading(false) }
  }
  async function saveServiceRecord(event) {
    event.preventDefault(); if (!serviceVehicleId) return setStatus('Select a vehicle first.'); setLoading(true)
    try { await request(`/fleet/vehicles/${serviceVehicleId}/service-records`, token, { method: 'POST', body: JSON.stringify(serviceForm) }); setServiceForm({ serviceDate: '', odometerMileage: '', description: '', cost: '', nextDueDate: '', nextDueMileage: '' }); await loadServiceHistory(serviceVehicleId); setStatus('Service record created.') }
    catch (error) { setStatus(error.message) } finally { setLoading(false) }
  }
  async function saveBooking(event) {
    event.preventDefault(); setLoading(true)
    try { await request('/api/bookings', token, { method: 'POST', body: JSON.stringify({ ...bookingForm, start: new Date(bookingForm.start).toISOString(), end: new Date(bookingForm.end).toISOString(), passengerCount: Number(bookingForm.passengerCount) }) }); setBookingForm(initialBookingForm); await refreshList('bookings'); setStatus('Booking submitted.') }
    catch (error) { setStatus(error.message) } finally { setLoading(false) }
  }
  async function saveRental(event) {
    event.preventDefault(); setLoading(true)
    try {
      const payload = {
        ...rentalForm,
        start: new Date(rentalForm.start).toISOString(),
        end: new Date(rentalForm.end).toISOString(),
      }
      await request('/api/rental-reservations', token, { method: 'POST', body: JSON.stringify(payload) }); setRentalForm({ vehicleId: '', customerId: '', start: '', end: '', agreedRate: '', depositAmount: '', depositPaid: false }); await refreshList('rentals'); setStatus('Rental reservation created.')
    }
    catch (error) { setStatus(error.message) } finally { setLoading(false) }
  }
  async function extendRental(reservation) {
    const newEnd = window.prompt(`New return time for ${reservation.vehicle?.registration || 'this vehicle'} (YYYY-MM-DDTHH:mm):`, reservation.endAt ? new Date(reservation.endAt).toISOString().slice(0, 16) : '')
    if (!newEnd) return
    setLoading(true)
    try {
      await request(`/api/rental-reservations/${reservation.id}/extend`, token, { method: 'POST', body: JSON.stringify({ newEnd: new Date(newEnd).toISOString() }) })
      await refreshList('rentals')
      setStatus('Rental return time extended.')
    } catch (error) { setStatus(error.message) } finally { setLoading(false) }
  }
  async function saveInspection(event) {
    event.preventDefault(); setLoading(true); setInspectionMessage(null)
    try {
      const payload = { odometerReading: inspectionForm.odometerReading, conditionNotes: inspectionForm.conditionNotes, conditionPhotos: inspectionForm.conditionPhotos.split(',').map(url => url.trim()).filter(Boolean) }
      if (inspectionForm.fuelLevel !== '') payload.fuelLevel = inspectionForm.fuelLevel
      await request(`/api/rental-reservations/${inspectionForm.reservationId}/inspections/${inspectionForm.type}`, token, { method: 'POST', body: JSON.stringify(payload) })
      await refreshList('rentals')
      setInspectionMessage({ type: 'success', text: `Rental ${inspectionForm.type} recorded successfully.` })
      setStatus(`Rental ${inspectionForm.type} recorded.`)
    } catch (error) {
      setInspectionMessage({ type: 'error', text: error.message })
      setStatus(error.message)
    } finally { setLoading(false) }
  }
  async function scheduleReport(event) {
    event.preventDefault(); setLoading(true)
    try {
      const path = editingScheduleId ? `/api/reports/schedules/${encodeURIComponent(editingScheduleId)}` : '/api/reports/schedules'
      const data = await request(path, token, { method: editingScheduleId ? 'PUT' : 'POST', body: JSON.stringify(scheduleForm) })
      setEditingScheduleId(null); await loadReportSchedules(); setStatus(editingScheduleId ? 'Recurring report updated.' : `Recurring report created (${data.schedule?.cron || scheduleForm.cron}).`)
    } catch (error) { setStatus(error.message) } finally { setLoading(false) }
  }

  function editVehicle(vehicle) {
    setEditingVehicleId(vehicle.id)
    setVehicleImage(null)
    setVehicleImageInputKey(key => key + 1)
    setVehicleForm({ registration: vehicle.registration || '', make: vehicle.make || '', model: vehicle.model || '', odometerCurrent: String(vehicle.odometerCurrent ?? 0), departmentId: vehicle.departmentId || '' })
  }

  function resetVehicleForm() {
    setEditingVehicleId(null)
    setVehicleImage(null)
    setVehicleImageInputKey(key => key + 1)
    setVehicleForm({ registration: '', make: '', model: '', odometerCurrent: '0', departmentId: '' })
  }

  async function saveVehicle(event) {
    event.preventDefault()
    setLoading(true)
    try {
      const path = editingVehicleId ? `/fleet/vehicles/${editingVehicleId}` : '/fleet/vehicles'
      const payload = { ...vehicleForm, odometerCurrent: Number(vehicleForm.odometerCurrent), departmentId: vehicleForm.departmentId || null }
      if (editingVehicleId) {
        await request(path, token, { method: 'PATCH', body: JSON.stringify(payload) })
        if (vehicleImage) {
          const imageData = new FormData()
          imageData.append('image', vehicleImage)
          await request(`/fleet/vehicles/${editingVehicleId}/image`, token, { method: 'PATCH', body: imageData })
        }
      } else {
        const formData = new FormData()
        Object.entries(payload).forEach(([key, value]) => { if (value !== null) formData.append(key, value) })
        if (vehicleImage) formData.append('image', vehicleImage)
        await request(path, token, { method: 'POST', body: formData })
      }
      const wasEditing = Boolean(editingVehicleId)
      resetVehicleForm(); await refreshList('fleet'); setStatus(wasEditing ? 'Vehicle updated.' : 'Vehicle registered.')
    } catch (error) { setStatus(error.message) } finally { setLoading(false) }
  }

  async function removeVehicle(vehicle) {
    if (!window.confirm(`Retire ${vehicle.registration}? It will be removed from the active fleet, while its history is retained.`)) return
    setLoading(true)
    try { await request(`/fleet/vehicles/${vehicle.id}`, token, { method: 'DELETE' }); await refreshList('fleet'); setStatus(`${vehicle.registration} retired from the active fleet.`) }
    catch (error) { setStatus(error.message) } finally { setLoading(false) }
  }
  async function updateVehicleOdometer(vehicle) {
    const odometerCurrent = window.prompt(`Current odometer for ${vehicle.registration}:`, vehicle.odometerCurrent)
    if (odometerCurrent === null || odometerCurrent.trim() === '') return
    setLoading(true)
    try {
      await request(`/fleet/vehicles/${vehicle.id}/odometer`, token, { method: 'PATCH', body: JSON.stringify({ odometerCurrent }) })
      await refreshList('fleet')
      setStatus(`${vehicle.registration} odometer updated.`)
    } catch (error) { setStatus(error.message) } finally { setLoading(false) }
  }

  async function actionBooking(booking, action) {
    const isApproval = action === 'approval'
    const comment = window.prompt(isApproval ? 'Approval note:' : 'Reason for rejecting this booking:')
    if (!comment?.trim()) return
    setLoading(true)
    try {
      const result = await request(`/api/bookings/${booking.id}/${action}`, token, { method: 'POST', body: JSON.stringify({ comment: comment.trim() }) })
      setBookings(current => current.map(item => item.id === result.booking.id ? { ...item, ...result.booking } : item))
      setSelectedBooking(current => current?.id === result.booking.id ? { ...current, ...result.booking } : current)
      setStatus(result.booking.status === 'PENDING' && isApproval ? 'Approval recorded; the booking is awaiting the next approver.' : `Booking ${result.booking.status.toLowerCase()}.`)
    } catch (error) { setStatus(error.message) } finally { setLoading(false) }
  }

  async function editBooking(booking, changes) {
    if (!changes) { setEditingBooking(booking); return }
    setLoading(true)
    try {
      const result = await request(`/api/bookings/${booking.id}`, token, { method: 'PATCH', body: JSON.stringify({ ...changes, start: new Date(changes.start).toISOString(), end: new Date(changes.end).toISOString(), passengerCount: Number(changes.passengerCount) }) })
      setBookings(current => current.map(item => item.id === result.booking.id ? { ...item, ...result.booking } : item))
      setSelectedBooking(result.booking); setEditingBooking(null); setStatus('Booking details updated.')
    } catch (error) { setStatus(error.message) } finally { setLoading(false) }
  }

  async function deleteBooking(booking) {
    if (!window.confirm(`Delete the booking for ${booking.requestedBy?.name || 'this requester'}? This cannot be undone.`)) return
    setLoading(true)
    try {
      await request(`/api/bookings/${booking.id}`, token, { method: 'DELETE' })
      setBookings(current => current.filter(item => item.id !== booking.id)); setSelectedBooking(null); setStatus('Booking deleted.')
    } catch (error) { setStatus(error.message) } finally { setLoading(false) }
  }

  async function exportReport(format) {
    if (!token) return setStatus('Connect an admin token before exporting a report.')
    setLoading(true)
    try {
      const reportPath = reportExportType === 'RENTAL_PERFORMANCE' ? '/api/reports/performance/export' : `/api/reports/${reportExportType}/export`
      const response = await fetch(`${API_URL}${reportPath}?format=${format}`, { headers: { Authorization: `Bearer ${token}` } })
      if (!response.ok) { const error = await response.json().catch(() => ({})); throw new Error(error.message || 'Report export failed') }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url; link.download = `fleetlink-${reportExportType.toLowerCase()}.${format}`; link.click()
      URL.revokeObjectURL(url)
      setStatus(`${format.toUpperCase()} report downloaded.`)
    } catch (error) { setStatus(error.message) } finally { setLoading(false) }
  }

  const performance = report?.summary || report || {}
  return <TranslationTree language={language}><main className="admin-shell">
    <aside className="admin-sidebar">
      <a className="admin-brand" href="/">Fleet<span>Link</span><small>CONTROL CENTRE</small></a>
      <nav>{menu.filter(([key]) => isSystemAdmin || !superAdminOnlyPages.has(key)).filter(([key]) => key !== 'analytics' || entitlement?.features?.advancedAnalytics !== false).filter(([key]) => key !== 'reports' || entitlement?.features?.advancedReports !== false).filter(([key]) => key !== 'schedules' || entitlement?.features?.scheduledExports !== false).filter(([key]) => key !== 'telematics' || entitlement?.features?.gpsTelematics !== false).map(([key, label]) => <button key={key} onClick={() => { setActive(key); if (key === 'analytics') loadAnalytics(); if (key === 'audit') loadAudit(); if (key === 'settings') loadSystemAccess(); if (key === 'config') loadTenantConfig(); if (key === 'schedules') loadReportSchedules(); if (key === 'monitoring') loadMonitoring(); if (key === 'telematics') { if (!vehicles.length) refreshList('fleet') } if (['tenants', 'organization', 'users', 'fleet', 'bookings', 'contactMessages', 'rentals', 'customers'].includes(key)) refreshList(key) }} className={active === key ? 'is-active' : ''}>{label}</button>)}</nav>
      <div className="admin-user"><div>{isSystemAdmin ? 'SA' : 'FM'}</div><p>{isSystemAdmin ? 'System administrator' : 'Fleet manager'}<small>{connected ? 'Connected' : 'Not connected'}</small></p></div>
    </aside>
    <section className="admin-content">
      <header className="admin-topbar"><div><p className="eyebrow">FleetLink / Admin</p><h1>{menu.find(([key]) => key === active)?.[1]}</h1></div><div className="topbar-actions"><label className="language-control">Language<select aria-label="Language" value={language} onChange={e => setLanguage(e.target.value)}><option value="en">English</option><option value="fr">Français</option><option value="rw">Kinyarwanda</option></select></label><button className="outline-btn" onClick={() => { clearSession(); window.location.assign('/login') }}>Sign out</button></div></header>
      <section className="connection-card"><div><strong>Authenticated Admin session</strong><p>{status}</p></div><div className="token-row"><button onClick={loadOverview} disabled={loading}>{loading ? 'Loading…' : 'Refresh dashboard'}</button></div></section>
      {active === 'overview' && entitlement && Object.entries({ advancedAnalytics: 'Analytics', advancedReports: 'Report exports', scheduledExports: 'Recurring report schedules', gpsTelematics: 'Live vehicle locations', maintenanceAlerts: 'Automated maintenance alerts' }).some(([feature]) => !entitlement.features?.[feature]) && <section className="panel full upgrade-panel"><div><h2>Unlock more FleetLink features</h2><p>Your {entitlement.package} plan has features that can be added with a higher tier or an entitlement override.</p></div><div className="upgrade-feature-list">{Object.entries({ advancedAnalytics: 'Analytics', advancedReports: 'Report exports', scheduledExports: 'Recurring report schedules', gpsTelematics: 'Live vehicle locations', maintenanceAlerts: 'Automated maintenance alerts' }).filter(([feature]) => !entitlement.features?.[feature]).map(([feature, label]) => <span key={feature}>{label} · {feature === 'gpsTelematics' || feature === 'maintenanceAlerts' ? 'Enterprise' : 'Professional'}</span>)}</div>{isSystemAdmin && <button onClick={() => setActive('settings')}>Manage subscription</button>}</section>}
      {active === 'overview' && <>
        <section className="metrics-grid"><Metric label="Tenant" value={dashboard?.tenantId ? 'Connected' : '—'} note={dashboard?.tenantId || 'Awaiting token'} /><Metric label="Maintenance alerts" value={maintenance?.vehicles?.length} note="Due in 30 days / 1,000 km" /><Metric label="Audit events" value={auditLogs.length} note="Most recent activity" /><Metric label="Rental performance" value={performance.totalReservations ?? performance.reservationCount} note="Current reporting range" /></section>
        <section className="admin-grid"><article className="panel"><div className="panel-heading"><div><h2>Maintenance watch</h2><p>Vehicles approaching their service threshold</p></div><button onClick={() => setActive('fleet')}>Manage fleet</button></div>{maintenance?.vehicles?.length ? <ul className="alert-list">{maintenance.vehicles.slice(0, 5).map((v, i) => <li key={v.id || i}><b>{v.registration || v.make || 'Vehicle'}</b><span>{v.reason || v.status || 'Service attention required'}</span></li>)}</ul> : <p className="empty">No maintenance alerts loaded.</p>}</article><article className="panel"><div className="panel-heading"><div><h2>Recent system activity</h2><p>Tenant-scoped audit trail</p></div><button onClick={() => { setActive('audit'); loadAudit() }}>View all</button></div><ul className="activity-list">{recentLogs.length ? recentLogs.map((log, i) => <li key={log.id || i}><i></i><div><b>{log.action || log.category || 'System event'}</b><span>{log.createdAt ? new Date(log.createdAt).toLocaleString() : 'Recently'}</span></div></li>) : <li className="empty">No activity loaded.</li>}</ul></article></section>
      </>}
      {active === 'tenants' && isSystemAdmin && <section className="panel full"><div className="panel-heading"><div><h2>Tenant management</h2><p>Create, update, and remove empty tenants across FleetLink.</p></div><button onClick={() => refreshList('tenants')}>Refresh</button></div><form className="admin-form" onSubmit={saveTenant}><h3>{editingTenantId ? 'Edit tenant' : 'Add tenant'}</h3><label>Name<input value={tenantForm.name} onChange={e => setTenantForm({ ...tenantForm, name: e.target.value })} required /></label><label>Sector<input value={tenantForm.sector} onChange={e => setTenantForm({ ...tenantForm, sector: e.target.value })} required /></label><label>Package<select value={tenantForm.package} onChange={e => setTenantForm({ ...tenantForm, package: e.target.value })}><option>Starter</option><option>Professional</option><option>Enterprise</option></select></label><label>Status<select value={tenantForm.billingStatus} onChange={e => setTenantForm({ ...tenantForm, billingStatus: e.target.value })}><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option></select></label><div className="form-actions"><button disabled={loading} type="submit">{editingTenantId ? 'Save changes' : 'Create tenant'}</button>{editingTenantId && <button type="button" className="outline-btn" onClick={resetTenantForm}>Cancel</button>}</div></form><div className="table-wrap"><table><thead><tr><th>Name</th><th>Sector</th><th>Package</th><th>Status</th><th>Users</th><th>Actions</th></tr></thead><tbody>{tenants.map(tenant => <tr key={tenant.id}><td>{tenant.name}</td><td>{tenant.sector}</td><td>{tenant.package}</td><td>{tenant.billingStatus}</td><td>{tenant._count?.users ?? 0}</td><td className="table-actions"><button onClick={() => editTenant(tenant)}>Edit</button>{!(tenant._count?.users || tenant._count?.vehicles || tenant._count?.departments) && <button className="danger-btn" onClick={() => removeTenant(tenant)}>Delete</button>}</td></tr>)}</tbody></table></div></section>}
      {active === 'fleet' && <section className="panel full"><div className="panel-heading"><div><h2>Fleet & maintenance</h2><p>Register, edit, retire, assign departments, and update the mileage of vehicles in this tenant.</p></div><button onClick={() => refreshList('fleet')}>Refresh</button></div><form className="admin-form" onSubmit={saveVehicle}><h3>{editingVehicleId ? 'Edit vehicle' : 'Register vehicle'}</h3><label>Registration<input value={vehicleForm.registration} onChange={e => setVehicleForm({ ...vehicleForm, registration: e.target.value })} required placeholder="ABC 123 GP" /></label><label>Make<input value={vehicleForm.make} onChange={e => setVehicleForm({ ...vehicleForm, make: e.target.value })} placeholder="Toyota" /></label><label>Model<input value={vehicleForm.model} onChange={e => setVehicleForm({ ...vehicleForm, model: e.target.value })} placeholder="Corolla" /></label><label>Current odometer<input type="number" min="0" value={vehicleForm.odometerCurrent} onChange={e => setVehicleForm({ ...vehicleForm, odometerCurrent: e.target.value })} required /></label><label>Department<select value={vehicleForm.departmentId} onChange={e => setVehicleForm({ ...vehicleForm, departmentId: e.target.value })}><option value="">Unassigned</option>{departments.map(department => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label><label>{editingVehicleId ? 'Replace vehicle photo' : 'Vehicle photo'}<input key={vehicleImageInputKey} type="file" accept="image/jpeg,image/png,image/webp" onChange={event => setVehicleImage(event.target.files?.[0] || null)} /><small className="field-hint">{editingVehicleId ? 'Optional: choose a new image to replace the existing photo.' : 'Optional JPG, PNG, or WebP image (max 5 MB).'}</small></label><div className="form-actions"><button type="submit" disabled={loading}>{editingVehicleId ? 'Save changes' : 'Add vehicle'}</button>{editingVehicleId && <button type="button" className="outline-btn" onClick={resetVehicleForm}>Cancel</button>}</div></form><div className="table-wrap"><table><thead><tr><th>Photo</th><th>Registration</th><th>Vehicle</th><th>Department</th><th>Odometer</th><th>Service due</th><th>Actions</th></tr></thead><tbody>{vehicles.map(vehicle => <tr key={vehicle.id}><td>{vehicle.imageUrl ? <img className="vehicle-thumbnail" src={vehicle.imageUrl} alt={`${vehicle.registration} vehicle`} /> : '-'}</td><td>{vehicle.registration}</td><td>{[vehicle.make, vehicle.model].filter(Boolean).join(' ') || '-'}</td><td>{vehicle.department?.name || 'Unassigned'}</td><td>{vehicle.odometerCurrent?.toLocaleString()} km</td><td>{vehicle.nextDueDate ? new Date(vehicle.nextDueDate).toLocaleDateString() : '-'}</td><td className="table-actions"><button onClick={() => editVehicle(vehicle)}>Edit</button><button onClick={() => updateVehicleOdometer(vehicle)}>Mileage</button><button className="danger-btn" onClick={() => removeVehicle(vehicle)}>Retire</button></td></tr>)}</tbody></table></div></section>}
      {active === 'bookings' && <section className="panel full"><div className="panel-heading"><div><h2>Booking requests</h2><p>Open a request to review every submitted detail before making a decision.</p></div><button onClick={() => refreshList('bookings')}>Refresh</button></div><form className="admin-form" onSubmit={saveBooking}><label>Vehicle<select value={bookingForm.vehicleId} onChange={e => setBookingForm({ ...bookingForm, vehicleId: e.target.value })} required><option value="">Select vehicle</option>{vehicles.map(vehicle => <option key={vehicle.id} value={vehicle.id}>{vehicle.registration}</option>)}</select></label><label>Booking service<select value={bookingForm.serviceType} onChange={e => setBookingForm({ ...bookingForm, serviceType: e.target.value })}><option value="SELF_DRIVE">Self-drive rental</option><option value="CHAUFFEURED_TRANSFER">Chauffeured transfer</option></select></label><label>Initial status<input value="Pending" readOnly aria-label="Initial booking status" /></label><label>Start<input type="datetime-local" value={bookingForm.start} onChange={e => setBookingForm({ ...bookingForm, start: e.target.value })} required /></label><label>End<input type="datetime-local" value={bookingForm.end} onChange={e => setBookingForm({ ...bookingForm, end: e.target.value })} required /></label><label>Passengers<input type="number" min="1" value={bookingForm.passengerCount} onChange={e => setBookingForm({ ...bookingForm, passengerCount: e.target.value })} required /></label><label>Destination<input value={bookingForm.destination} onChange={e => setBookingForm({ ...bookingForm, destination: e.target.value })} required /></label>{bookingForm.serviceType === 'CHAUFFEURED_TRANSFER' && <><label>Pickup location<input value={bookingForm.pickupLocation} onChange={e => setBookingForm({ ...bookingForm, pickupLocation: e.target.value })} required /></label><label>Guest / client name<input value={bookingForm.guestName} onChange={e => setBookingForm({ ...bookingForm, guestName: e.target.value })} required /></label><label>Guest contact<input value={bookingForm.guestContact} onChange={e => setBookingForm({ ...bookingForm, guestContact: e.target.value })} required /></label></>}<label>Purpose<input value={bookingForm.justification} onChange={e => setBookingForm({ ...bookingForm, justification: e.target.value })} required /></label><div className="form-actions"><button disabled={loading} type="submit">Submit booking</button></div></form><div className="table-wrap"><table><thead><tr><th>Vehicle</th><th>Requester</th><th>Service</th><th>Destination</th><th>Window</th><th>Status</th><th>Actions</th></tr></thead><tbody>{bookings.map(booking => <tr key={booking.id}><td>{booking.vehicle?.registration || '—'}</td><td>{booking.requestedBy?.name || '—'}</td><td>{booking.serviceType === 'CHAUFFEURED_TRANSFER' ? 'Chauffeured' : 'Self-drive'}</td><td>{booking.destination || '—'}</td><td>{new Date(booking.startAt).toLocaleString()}</td><td>{booking.status}</td><td className="table-actions"><button onClick={() => setSelectedBooking(booking)}>View details</button><button onClick={() => editBooking(booking)}>Edit</button><button className="danger-btn" onClick={() => deleteBooking(booking)}>Delete</button>{booking.status === 'PENDING' && <><button onClick={() => actionBooking(booking, 'approval')}>Approve</button><button className="danger-btn" onClick={() => actionBooking(booking, 'rejection')}>Reject</button></>}</td></tr>)}</tbody></table></div></section>}
      {active === 'contactMessages' && <section className="panel full"><div className="panel-heading"><div><h2>Contact messages</h2><p>Messages submitted from the public website and mobile app. Only users in your tenant can see them.</p></div><button onClick={() => refreshList('contactMessages')}>Refresh</button></div><div className="table-wrap"><table><thead><tr><th>Received</th><th>Sender</th><th>Phone</th><th>Message</th><th>Status</th><th>Action</th></tr></thead><tbody>{contactMessages.length ? contactMessages.map(message => <tr key={message.id}><td>{new Date(message.createdAt).toLocaleString()}</td><td><strong>{[message.firstName, message.lastName].filter(Boolean).join(' ')}</strong><br /><small>{message.email}</small></td><td>{message.phone}</td><td>{message.message}</td><td>{message.status.replace('_', ' ')}</td><td><select aria-label={`Status for ${message.firstName}`} value={message.status} onChange={event => updateContactMessage(message, event.target.value)} disabled={loading}><option value="NEW">New</option><option value="IN_PROGRESS">In progress</option><option value="RESOLVED">Resolved</option></select></td></tr>) : <tr><td colSpan="6">No contact messages yet.</td></tr>}</tbody></table></div></section>}
      {active === 'newsletter' && <NewsletterCampaignPanel token={token} />}
      {active === 'config' && <section className="panel full"><div className="panel-heading"><div><h2>Tenant configuration</h2><p>Configure approvals, custom fields, integrations, roles, templates, locale, and currency. JSON fields are stored tenant-scoped.</p></div><button onClick={loadTenantConfig}>Refresh</button></div><form className="admin-form" onSubmit={saveTenantConfig}><label>Language<select value={configDraft.locale} onChange={e => { const locale = e.target.value; setConfigDraft({ ...configDraft, locale }); setLanguage(locale) }}><option value="en">English</option><option value="fr">Français</option><option value="rw">Kinyarwanda</option></select></label><label>Currency<input value={configDraft.currency} onChange={e => setConfigDraft({ ...configDraft, currency: e.target.value.toUpperCase() })} maxLength="3" required /></label>{[['approvalWorkflow', 'Approval workflow'], ['notificationSettings', 'Communication preferences'], ['notificationTemplates', 'Notification templates'], ['customFields', 'Custom fields'], ['roleConfiguration', 'Role permissions'], ['integrationSettings', 'GPS / HR-ERP / billing integrations']].map(([field, label]) => <label className="wide" key={field}>{label}<textarea rows="5" value={configDraft[field]} onChange={e => setConfigDraft({ ...configDraft, [field]: e.target.value })} spellCheck="false" /></label>)}<div className="form-actions"><button disabled={loading} type="submit">Save configuration</button></div></form>{tenantConfig && <p className="field-hint">Editing configuration for {tenantConfig.name}.</p>}</section>}
      {active === 'operations' && <FleetOperations />}
      {active === 'rentals' && <section className="panel full"><div className="panel-heading"><div><h2>Rental reservations</h2><p>Create, manage, and extend tenant rental reservations.</p></div><button onClick={() => refreshList('rentals')}>Refresh</button></div><form className="admin-form" onSubmit={saveRental}><label>Vehicle<select value={rentalForm.vehicleId} onChange={e => setRentalForm({ ...rentalForm, vehicleId: e.target.value })} required><option value="">Select vehicle</option>{vehicles.map(vehicle => <option key={vehicle.id} value={vehicle.id}>{vehicle.registration}</option>)}</select></label><label>Customer<select value={rentalForm.customerId} onChange={e => setRentalForm({ ...rentalForm, customerId: e.target.value })} required><option value="">Select customer</option>{customers.map(customer => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label><label>Start<input type="datetime-local" value={rentalForm.start} onChange={e => setRentalForm({ ...rentalForm, start: e.target.value })} required /></label><label>End<input type="datetime-local" value={rentalForm.end} onChange={e => setRentalForm({ ...rentalForm, end: e.target.value })} required /></label><label>Rate<input type="number" min="0" step="0.01" value={rentalForm.agreedRate} onChange={e => setRentalForm({ ...rentalForm, agreedRate: e.target.value })} required /></label><label>Deposit<input type="number" min="0" step="0.01" value={rentalForm.depositAmount} onChange={e => setRentalForm({ ...rentalForm, depositAmount: e.target.value })} required /></label><label>Deposit paid<input type="checkbox" checked={rentalForm.depositPaid} onChange={e => setRentalForm({ ...rentalForm, depositPaid: e.target.checked })} /></label><div className="form-actions"><button disabled={loading} type="submit">Create reservation</button></div></form><div className="table-wrap"><table><thead><tr><th>Vehicle</th><th>Customer</th><th>Return due</th><th>Status</th><th>Deposit</th><th>Actions</th></tr></thead><tbody>{reservations.map(reservation => <tr key={reservation.id}><td>{reservation.vehicle?.registration || '-'}</td><td>{reservation.customer?.name || '-'}</td><td>{new Date(reservation.endAt).toLocaleString()}</td><td>{reservation.status}</td><td>{reservation.depositPaid ? 'Paid' : 'Outstanding'}</td><td className="table-actions">{!['COMPLETED', 'OVERDUE'].includes(reservation.status) ? <button onClick={() => extendRental(reservation)}>Extend</button> : <><span className="no-action">Completed</span><button onClick={() => setActive('inspections')}>View inspections</button></>}</td></tr>)}</tbody></table></div></section>}
      {active === 'customers' && <section className="panel full"><div className="panel-heading"><div><h2>Rental customers</h2><p>Create, update, and remove customer records without rental history.</p></div><button onClick={() => refreshList('customers')}>Refresh</button></div><form className="admin-form" onSubmit={saveCustomer}><h3>{editingCustomerId ? 'Edit customer' : 'Add customer'}</h3><label>Name<input value={customerForm.name} onChange={e => setCustomerForm({ ...customerForm, name: e.target.value })} required /></label><label>Email<input type="email" value={customerForm.email} onChange={e => setCustomerForm({ ...customerForm, email: e.target.value })} required /></label><label>Driver licence<input value={customerForm.driverLicense} onChange={e => setCustomerForm({ ...customerForm, driverLicense: e.target.value })} required /></label><label>Contact<input value={customerForm.contact} onChange={e => setCustomerForm({ ...customerForm, contact: e.target.value })} /></label><div className="form-actions"><button disabled={loading} type="submit">{editingCustomerId ? 'Save changes' : 'Create customer'}</button>{editingCustomerId && <button type="button" className="outline-btn" onClick={resetCustomerForm}>Cancel</button>}</div></form><div className="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Licence</th><th>Contact</th><th>Rentals</th><th>Actions</th></tr></thead><tbody>{customers.map(customer => <tr key={customer.id}><td>{customer.name}</td><td>{customer.email}</td><td>{customer.driverLicense}</td><td>{customer.contact || '—'}</td><td>{customer._count?.reservations ?? 0}</td><td className="table-actions"><button onClick={() => editCustomer(customer)}>Edit</button>{!customer._count?.reservations && <button className="danger-btn" onClick={() => removeCustomer(customer)}>Delete</button>}</td></tr>)}</tbody></table></div></section>}
      {active === 'organization' && <section className="panel full"><div className="panel-heading"><div><h2>Organisation & departments</h2><p>Create, update, and delete tenant departments.</p></div><button onClick={() => refreshList('organization')}>Refresh</button></div><form className="admin-form" onSubmit={saveDepartment}><h3>{editingDepartmentId ? 'Edit department' : 'Add department'}</h3><label>Name<input value={departmentForm.name} onChange={e => setDepartmentForm({ ...departmentForm, name: e.target.value })} required /></label><label>Cost centre<input value={departmentForm.costCentreCode} onChange={e => setDepartmentForm({ ...departmentForm, costCentreCode: e.target.value })} /></label><label>Budget code<input value={departmentForm.budgetCode} onChange={e => setDepartmentForm({ ...departmentForm, budgetCode: e.target.value })} /></label><div className="form-actions"><button disabled={loading} type="submit">{editingDepartmentId ? 'Save changes' : 'Create department'}</button>{editingDepartmentId && <button type="button" className="outline-btn" onClick={resetDepartmentForm}>Cancel</button>}</div></form><div className="table-wrap"><table><thead><tr><th>Department</th><th>Cost centre</th><th>Budget</th><th>Users</th><th>Vehicles</th><th>Actions</th></tr></thead><tbody>{departments.map(department => <tr key={department.id}><td>{department.name}</td><td>{department.costCentreCode || '—'}</td><td>{department.budgetCode || '—'}</td><td>{department._count?.users ?? 0}</td><td>{department._count?.vehicles ?? 0}</td><td className="table-actions"><button onClick={() => editDepartment(department)}>Edit</button><button className="danger-btn" onClick={() => removeDepartment(department)}>Delete</button></td></tr>)}</tbody></table></div></section>}
      {active === 'users' && <section className="panel full"><div className="panel-heading"><div><h2>Users & access</h2><p>Create, update, and deactivate staff accounts and permissions.</p></div><button onClick={() => refreshList('users')}>Refresh</button></div><form className="admin-form" onSubmit={saveUser}><h3>{editingUserId ? 'Edit user' : 'Add user'}</h3><label>Name<input value={userForm.name} onChange={e => setUserForm({ ...userForm, name: e.target.value })} required /></label><label>Email<input type="email" disabled={Boolean(editingUserId)} value={userForm.email} onChange={e => setUserForm({ ...userForm, email: e.target.value })} required /></label><label>{editingUserId ? 'New password (optional)' : 'Password'}<input type="password" value={userForm.password} onChange={e => setUserForm({ ...userForm, password: e.target.value })} required={!editingUserId} /></label><label>Role<select value={userForm.role} onChange={e => setUserForm({ ...userForm, role: e.target.value })}><option value="STAFF">Staff</option><option value="DEPARTMENT_HEAD">Department head</option><option value="FLEET_MANAGER">Fleet manager</option><option value="SUPER_ADMIN">System administrator</option></select></label><label>Department<select value={userForm.departmentId} onChange={e => setUserForm({ ...userForm, departmentId: e.target.value })}><option value="">Unassigned</option>{departments.map(department => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label><label>Contact<input value={userForm.contact} onChange={e => setUserForm({ ...userForm, contact: e.target.value })} /></label><div className="form-actions"><button disabled={loading} type="submit">{editingUserId ? 'Save changes' : 'Create user'}</button>{editingUserId && <button type="button" className="outline-btn" onClick={resetUserForm}>Cancel</button>}</div></form><div className="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Department</th><th>Status</th><th>Actions</th></tr></thead><tbody>{users.map(user => <tr key={user.id}><td>{user.name}</td><td>{user.email}</td><td>{user.role.replace(/_/g, ' ')}</td><td>{user.department?.name || 'Unassigned'}</td><td>{user.isActive ? 'Active' : 'Inactive'}</td><td className="table-actions"><button onClick={() => editUser(user)}>Edit</button>{user.isActive && <button className="danger-btn" onClick={() => deactivateUser(user)}>Deactivate</button>}</td></tr>)}</tbody></table></div></section>}
      {active === 'availability' && <section className="panel full"><h2>Vehicle availability</h2><p>Search vehicles available for a requested time window.</p><form className="admin-form" onSubmit={searchAvailability}><label>Start<input type="datetime-local" value={availabilityForm.start} onChange={e => setAvailabilityForm({ ...availabilityForm, start: e.target.value })} required /></label><label>End<input type="datetime-local" value={availabilityForm.end} onChange={e => setAvailabilityForm({ ...availabilityForm, end: e.target.value })} required /></label><div className="form-actions"><button disabled={loading} type="submit">Search availability</button></div></form><div className="table-wrap"><table><thead><tr><th>Registration</th><th>Vehicle</th><th>Department</th></tr></thead><tbody>{availableVehicles.map(vehicle => <tr key={vehicle.id}><td>{vehicle.registration}</td><td>{[vehicle.make, vehicle.model].filter(Boolean).join(' ')}</td><td>{vehicle.department?.name || 'Unassigned'}</td></tr>)}</tbody></table></div></section>}
      {active === 'serviceHistory' && <section className="panel full"><div className="panel-heading"><div><h2>Service history</h2><p>Record maintenance events and review the full vehicle history.</p></div><button onClick={() => loadServiceHistory(serviceVehicleId)}>Refresh</button></div><form className="admin-form" onSubmit={saveServiceRecord}><label>Vehicle<select value={serviceVehicleId} onChange={e => loadServiceHistory(e.target.value)} required><option value="">Select vehicle</option>{vehicles.map(vehicle => <option key={vehicle.id} value={vehicle.id}>{vehicle.registration}</option>)}</select></label><label>Service date<input type="date" value={serviceForm.serviceDate} onChange={e => setServiceForm({ ...serviceForm, serviceDate: e.target.value })} required /></label><label>Odometer<input type="number" min="0" value={serviceForm.odometerMileage} onChange={e => setServiceForm({ ...serviceForm, odometerMileage: e.target.value })} required /></label><label>Cost<input type="number" min="0" step="0.01" value={serviceForm.cost} onChange={e => setServiceForm({ ...serviceForm, cost: e.target.value })} required /></label><label>Description<input value={serviceForm.description} onChange={e => setServiceForm({ ...serviceForm, description: e.target.value })} /></label><label>Next due date<input type="date" value={serviceForm.nextDueDate} onChange={e => setServiceForm({ ...serviceForm, nextDueDate: e.target.value })} /></label><label>Next due mileage<input type="number" min="0" value={serviceForm.nextDueMileage} onChange={e => setServiceForm({ ...serviceForm, nextDueMileage: e.target.value })} /></label><div className="form-actions"><button disabled={loading} type="submit">Add service record</button></div></form><div className="table-wrap"><table><thead><tr><th>Date</th><th>Odometer</th><th>Description</th><th>Cost</th><th>Next due</th></tr></thead><tbody>{serviceRecords.map(record => <tr key={record.id}><td>{new Date(record.serviceDate).toLocaleDateString()}</td><td>{record.odometerMileage}</td><td>{record.description || '—'}</td><td>{record.cost}</td><td>{record.nextDueDate ? new Date(record.nextDueDate).toLocaleDateString() : '—'}</td></tr>)}</tbody></table></div></section>}
      {active === 'inspections' && <section className="panel full"><h2>Rental inspections</h2><p>Record checkout and check-in evidence for each rental.</p><form className="admin-form" onSubmit={saveInspection}><label>Reservation<select value={inspectionForm.reservationId} onChange={e => { setInspectionForm({ ...inspectionForm, reservationId: e.target.value }); setInspectionMessage(null) }} required><option value="">Select reservation</option>{reservations.filter(reservation => reservation.status !== 'COMPLETED').map(reservation => <option key={reservation.id} value={reservation.id}>{reservation.vehicle?.registration} — {reservation.customer?.name} ({reservation.status})</option>)}</select></label><label>Inspection<select value={inspectionForm.type} onChange={e => { setInspectionForm({ ...inspectionForm, type: e.target.value }); setInspectionMessage(null) }}><option value="checkout">Checkout</option><option value="checkin">Check-in</option></select></label><label>Odometer<input type="number" min="0" value={inspectionForm.odometerReading} onChange={e => setInspectionForm({ ...inspectionForm, odometerReading: e.target.value })} required /></label><label>Fuel/charge level<input type="number" min="0" step="0.01" value={inspectionForm.fuelLevel} onChange={e => setInspectionForm({ ...inspectionForm, fuelLevel: e.target.value })} /></label><label>Condition notes<input value={inspectionForm.conditionNotes} onChange={e => setInspectionForm({ ...inspectionForm, conditionNotes: e.target.value })} /></label><label>Photo URLs (comma-separated)<input value={inspectionForm.conditionPhotos} onChange={e => setInspectionForm({ ...inspectionForm, conditionPhotos: e.target.value })} required={inspectionForm.type === 'checkout'} /></label><div className="form-actions"><button disabled={loading} type="submit">Save inspection</button></div></form>{inspectionMessage && <p className={`inspection-message ${inspectionMessage.type}`} role={inspectionMessage.type === 'error' ? 'alert' : 'status'}>{inspectionMessage.text}</p>}<div className="table-wrap"><h3>Inspection history</h3><table><thead><tr><th>Vehicle</th><th>Customer</th><th>Type</th><th>Odometer</th><th>Fuel / charge</th><th>Condition</th><th>Recorded</th></tr></thead><tbody>{inspectionHistory.length ? inspectionHistory.map(({ reservation, inspection }) => <tr key={inspection.id}><td>{reservation.vehicle?.registration || '—'}</td><td>{reservation.customer?.name || '—'}</td><td>{inspection.inspectionType}</td><td>{inspection.odometerReading}</td><td>{inspection.fuelLevel ?? inspection.chargeLevel ?? '—'}</td><td>{inspection.conditionNotes || '—'}</td><td>{inspection.createdAt ? new Date(inspection.createdAt).toLocaleString() : '—'}</td></tr>) : <tr><td colSpan="7">No inspections have been recorded yet.</td></tr>}</tbody></table></div></section>}
      {active === 'analytics' && <section className="panel full"><div className="panel-heading"><div><h2>Operational analytics</h2><p>Fleet utilisation, department ROI, requester demand, fuel, energy, and maintenance performance.</p></div><button onClick={loadAnalytics}>Refresh</button></div>{report?.fuel || report?.compliance ? <><section className="metrics-grid analytics-metrics"><Metric label="Vehicles tracked" value={report.fuel?.vehicleTrends?.length ?? 0} note="Completed rental data" /><Metric label="Fuel/energy records" value={report.fuel?.rows?.length ?? 0} note="Check-in inspections" /><Metric label="Maintenance compliance" value={`${Math.round((report.compliance?.overallComplianceRatio || 0) * 100)}%`} note="Recorded service compliance" /><Metric label="Services assessed" value={report.compliance?.serviceRows?.length ?? 0} note="Current reporting range" /></section><div className="admin-grid"><article className="panel"><h2>Vehicle efficiency</h2>{report.fuel?.vehicleTrends?.length ? <div className="table-wrap"><table><thead><tr><th>Vehicle</th><th>Trips</th><th>Fuel / 100 km</th><th>Energy / 100 km</th></tr></thead><tbody>{report.fuel.vehicleTrends.map(row => <tr key={row.vehicleId}><td>{row.vehicleRegistration}</td><td>{row.totalTrips}</td><td>{row.averageFuelLPer100Km || '-'}</td><td>{row.averageEnergykWhPer100Km || '-'}</td></tr>)}</tbody></table></div> : <p className="empty">No completed rental check-ins with fuel or energy data yet.</p>}</article><article className="panel"><h2>Maintenance compliance</h2>{report.compliance?.vehicleCompliance?.length ? <div className="table-wrap"><table><thead><tr><th>Vehicle</th><th>Services</th><th>Compliant</th><th>Rate</th></tr></thead><tbody>{report.compliance.vehicleCompliance.map(row => <tr key={row.vehicleId}><td>{row.registration || '-'}</td><td>{row.totalServices}</td><td>{row.compliantServices}</td><td>{Math.round(row.complianceRatio * 100)}%</td></tr>)}</tbody></table></div> : <p className="empty">No service records have been assessed yet.</p>}</article><article className="panel"><h2>Vehicle utilisation</h2>{report.utilization?.length ? <div className="table-wrap"><table><thead><tr><th>Vehicle</th><th>Trips</th><th>Distance</th><th>Average trip</th></tr></thead><tbody>{report.utilization.map(row => <tr key={row.vehicleId}><td>{row.registration || '-'}</td><td>{row.tripCount}</td><td>{Number(row.totalDistance || 0).toLocaleString()} km</td><td>{Math.round((row.averageTripDurationMs || 0) / 60000)} min</td></tr>)}</tbody></table></div> : <p className="empty">No vehicle-utilisation data is available for this period.</p>}</article><article className="panel"><h2>Department ROI</h2>{report.departmentRoi?.length ? <div className="table-wrap"><table><thead><tr><th>Department</th><th>Bookings</th><th>Revenue</th><th>ROI</th></tr></thead><tbody>{report.departmentRoi.map(row => <tr key={`${row.departmentId}-${row.purpose}`}><td>{row.departmentName}</td><td>{row.totalBookings}</td><td>{Number(row.totalRevenue || 0).toFixed(2)}</td><td>{Math.round((row.roi || 0) * 100)}%</td></tr>)}</tbody></table></div> : <p className="empty">No department ROI data is available for this period.</p>}</article><article className="panel"><h2>Top requesters</h2>{report.topRequesters?.length ? <div className="table-wrap"><table><thead><tr><th>Requester</th><th>Email</th><th>Approved bookings</th></tr></thead><tbody>{report.topRequesters.map(row => <tr key={row.requesterId}><td>{row.requester?.name || 'Unknown'}</td><td>{row.requester?.email || '-'}</td><td>{row.requestCount}</td></tr>)}</tbody></table></div> : <p className="empty">No approved booking requests are available for this period.</p>}</article></div></> : <p className="empty">Select this page to load analytics.</p>}</section>}
      {active === 'reports' && <section className="panel full"><h2>Report exports</h2><p>Generate tenant-scoped PDF or Excel exports for every available report.</p><label>Report<select value={reportExportType} onChange={e => setReportExportType(e.target.value)}>{[['RENTAL_PERFORMANCE','Rental performance'],['FUEL_EFFICIENCY','Fuel and energy efficiency'],['MAINTENANCE_COMPLIANCE','Maintenance compliance'],['VEHICLE_UTILIZATION','Vehicle utilisation'],['DEPARTMENT_ROI','Department ROI'],['TOP_REQUESTERS','Top requesters']].map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label><div className="action-row"><button onClick={() => exportReport('pdf')}>Export PDF</button><button className="outline-btn" onClick={() => exportReport('xlsx')}>Export Excel</button></div></section>}
      {active === 'schedules' && <RecurringSchedulesPanel token={token} language={language} />}
      {active === 'telematics' && <TelemetryPanel token={token} vehicles={vehicles} language={language} />}
      {active === 'monitoring' && <MonitoringPanel token={token} language={language} />}
      {active === 'billing' && isSystemAdmin && <BillingPanel token={token} language={language} />}
      {active === 'audit' && <section className="panel full"><h2>Audit log</h2><div className="table-wrap"><table><thead><tr><th>Event</th><th>Category</th><th>Actor</th><th>Time</th></tr></thead><tbody>{auditLogs.map((log, i) => <tr key={log.id || i}><td>{log.action || '—'}</td><td>{log.category || '—'}</td><td>{log.actorId || 'System'}</td><td>{log.createdAt ? new Date(log.createdAt).toLocaleString() : '—'}</td></tr>)}</tbody></table></div></section>}
      {active === 'settings' && <section className="panel full"><div className="panel-heading"><div><h2>System access & subscription</h2><p>Manage your tenant’s enabled FleetLink capabilities.</p></div><button onClick={loadSystemAccess}>Refresh</button></div>{entitlement ? <><div className="settings-summary"><div><small>Tenant</small><b>{entitlement.tenantName}</b></div><div><small>Package</small><b>{entitlement.package}</b></div>{billing && <div><small>Vehicle billing</small><b>{billing.activeVehicleCount}{billing.includedVehicles === null ? ' vehicles' : ` / ${billing.includedVehicles} vehicles`}</b><small>{(billing.monthlyAmountCents / 100).toLocaleString(undefined, { style: 'currency', currency: billing.currency || 'USD' })} / month</small></div>}</div><div className="feature-grid">{Object.entries(entitlement.features || {}).map(([feature, enabled]) => <div key={feature} className={enabled ? 'feature-on' : 'feature-off'}>{feature.replace(/([A-Z])/g, ' $1')}<b>{enabled ? 'Enabled' : 'Unavailable'}</b></div>)}</div><div className="action-row"><button onClick={() => updatePackage('Professional')}>Use Professional</button><button className="outline-btn" onClick={() => updatePackage('Enterprise')}>Use Enterprise</button></div></> : <p className="empty">Select this page to load the tenant’s package and features.</p>}</section>}
      {active === 'fleet' && vehicles.some(vehicle => vehicle.imageUrl) && <section className="vehicle-photo-gallery"><h3>Vehicle photos</h3><div>{vehicles.filter(vehicle => vehicle.imageUrl).map(vehicle => <figure key={vehicle.id}><img src={vehicle.imageUrl} alt={`${vehicle.registration} vehicle`} /><figcaption>{vehicle.registration}</figcaption></figure>)}</div></section>}
    </section>
    {active === 'fleet' && !editingVehicleId && <section className="vehicle-photo-upload"><label>Vehicle photo<input key={vehicleImageInputKey} type="file" accept="image/jpeg,image/png,image/webp" onChange={event => setVehicleImage(event.target.files?.[0] || null)} /></label><p>{vehicleImage ? `${vehicleImage.name} selected — it will upload when you add the vehicle.` : 'Optional: select a JPG, PNG, or WebP image (maximum 5 MB), then click Add vehicle.'}</p></section>}
    {selectedBooking && <div className="booking-detail-backdrop" role="presentation" onClick={() => setSelectedBooking(null)}><section className="booking-detail-dialog" role="dialog" aria-modal="true" aria-label="Booking request details" onClick={event => event.stopPropagation()}><div className="panel-heading"><div><h2>Booking request details</h2><p>{selectedBooking.serviceType === 'CHAUFFEURED_TRANSFER' ? 'Chauffeured transfer' : 'Self-drive rental'}</p></div><button onClick={() => setSelectedBooking(null)}>Close</button></div><dl className="booking-detail-list"><dt>Vehicle</dt><dd>{selectedBooking.vehicle?.registration || '—'} {[selectedBooking.vehicle?.make, selectedBooking.vehicle?.model].filter(Boolean).join(' ')}</dd><dt>Requester</dt><dd>{selectedBooking.requestedBy?.name || '—'} · {selectedBooking.requestedBy?.email || '—'}</dd><dt>Contact</dt><dd>{selectedBooking.requestedBy?.contact || '—'}</dd><dt>Pickup location</dt><dd>{selectedBooking.pickupLocation || 'Not applicable'}</dd><dt>Guest / client</dt><dd>{selectedBooking.guestName || 'Not applicable'}</dd><dt>Guest contact</dt><dd>{selectedBooking.guestContact || 'Not applicable'}</dd><dt>Destination</dt><dd>{selectedBooking.destination || '—'}</dd><dt>Passengers</dt><dd>{selectedBooking.passengerCount}</dd><dt>Start</dt><dd>{new Date(selectedBooking.startAt).toLocaleString()}</dd><dt>End</dt><dd>{new Date(selectedBooking.endAt).toLocaleString()}</dd><dt>Purpose / notes</dt><dd>{selectedBooking.justification || '—'}</dd><dt>Status</dt><dd>{selectedBooking.status}</dd></dl></section></div>}
    {editingBooking && <BookingEditDialog booking={editingBooking} vehicles={vehicles} loading={loading} onClose={() => setEditingBooking(null)} onSave={changes => editBooking(editingBooking, changes)} />}
  </main></TranslationTree>
 }

function BookingEditDialog({ booking, vehicles, loading, onClose, onSave }) {
  const asInputDate = value => value ? new Date(value).toISOString().slice(0, 16) : ''
  const [form, setForm] = useState({ vehicleId: booking.vehicleId, serviceType: booking.serviceType || 'SELF_DRIVE', status: booking.status || 'PENDING', start: asInputDate(booking.startAt), end: asInputDate(booking.endAt), passengerCount: String(booking.passengerCount || 1), destination: booking.destination || '', justification: booking.justification || '', pickupLocation: booking.pickupLocation || '', guestName: booking.guestName || '', guestContact: booking.guestContact || '' })
  const isChauffeured = form.serviceType === 'CHAUFFEURED_TRANSFER'
  return <div className="booking-detail-backdrop" role="presentation"><section className="booking-detail-dialog" role="dialog" aria-modal="true" aria-label="Edit booking request"><div className="panel-heading"><div><h2>Edit booking request</h2><p>Change the request details or status, then save.</p></div><button type="button" onClick={onClose}>Close</button></div><form className="booking-edit-form" onSubmit={event => { event.preventDefault(); onSave(form) }}><label>Vehicle<select value={form.vehicleId} onChange={event => setForm({ ...form, vehicleId: event.target.value })} required>{vehicles.map(vehicle => <option key={vehicle.id} value={vehicle.id}>{vehicle.registration} — {[vehicle.make, vehicle.model].filter(Boolean).join(' ')}</option>)}</select></label><label>Status<select value={form.status} onChange={event => setForm({ ...form, status: event.target.value })}><option value="PENDING">Pending</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option><option value="CANCELLED">Cancelled</option></select></label><label>Booking service<select value={form.serviceType} onChange={event => setForm({ ...form, serviceType: event.target.value })}><option value="SELF_DRIVE">Self-drive rental</option><option value="CHAUFFEURED_TRANSFER">Chauffeured transfer</option></select></label><label>Start<input type="datetime-local" value={form.start} onChange={event => setForm({ ...form, start: event.target.value })} required /></label><label>End<input type="datetime-local" value={form.end} onChange={event => setForm({ ...form, end: event.target.value })} required /></label><label>Passengers<input type="number" min="1" value={form.passengerCount} onChange={event => setForm({ ...form, passengerCount: event.target.value })} required /></label><label>Destination<input value={form.destination} onChange={event => setForm({ ...form, destination: event.target.value })} required /></label>{isChauffeured && <><label>Pickup location<input value={form.pickupLocation} onChange={event => setForm({ ...form, pickupLocation: event.target.value })} required /></label><label>Guest / client name<input value={form.guestName} onChange={event => setForm({ ...form, guestName: event.target.value })} required /></label><label>Guest contact<input value={form.guestContact} onChange={event => setForm({ ...form, guestContact: event.target.value })} required /></label></>}<label className="booking-edit-wide">Purpose / notes<textarea rows="4" value={form.justification} onChange={event => setForm({ ...form, justification: event.target.value })} required /></label><div className="booking-edit-actions"><button disabled={loading} type="submit">{loading ? 'Saving…' : 'Save changes'}</button><button type="button" className="outline-btn" onClick={onClose}>Cancel</button></div></form></section></div>
}

export default AdminDashboard
