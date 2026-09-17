import { API_URL } from './config'

async function request(path, options = {}) {
  let response
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    })
  } catch {
    throw new Error('Cannot reach FleetLink. Ensure your phone and computer use the same Wi-Fi network, then restart Expo.')
  }
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.message || `The request failed (HTTP ${response.status}) at ${API_URL}${path}.`)
  return data
}

export const getPublicVehicles = (search = '') =>
  request(`/api/public/vehicles${search ? `?search=${encodeURIComponent(search)}` : ''}`).then(data => data.vehicles || [])

export const getPublicVehicle = vehicleId => request(`/api/public/vehicles/${encodeURIComponent(vehicleId)}`).then(data => data.vehicle)
export const submitCustomerBooking = (token, payload) => request('/api/customer-portal/my-bookings', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) })
export const submitContactMessage = payload => request('/api/public/contact-messages', { method: 'POST', body: JSON.stringify(payload) })
export const login = (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
export const signupCustomer = payload => request('/auth/customer-signup', { method: 'POST', body: JSON.stringify(payload) })
export const getMyBookings = token => request('/api/customer-portal/my-bookings', { headers: { Authorization: `Bearer ${token}` } }).then(data => data.bookings || [])
