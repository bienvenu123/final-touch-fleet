import { API_URL } from './config'

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.message || 'The request could not be completed.')
  return data
}

export const getPublicVehicles = (search = '') =>
  request(`/api/public/vehicles${search ? `?search=${encodeURIComponent(search)}` : ''}`).then(data => data.vehicles || [])

export const getPublicVehicle = vehicleId => request(`/api/public/vehicles/${encodeURIComponent(vehicleId)}`).then(data => data.vehicle)
export const submitPublicBooking = payload => request('/api/public/bookings', { method: 'POST', body: JSON.stringify(payload) })
export const submitContactMessage = payload => request('/api/public/contact-messages', { method: 'POST', body: JSON.stringify(payload) })
export const login = (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
