export const API_URL = import.meta.env.VITE_FLEETLINK_API_URL || 'http://localhost:3000'

export async function getPublicVehicles(search = '') {
  const query = search ? `?search=${encodeURIComponent(search)}` : ''
  const response = await fetch(`${API_URL}/api/public/vehicles${query}`)
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.message || 'Unable to load the fleet right now.')
  return data.vehicles || []
}

export async function getPublicVehicle(vehicleId) {
  const response = await fetch(`${API_URL}/api/public/vehicles/${encodeURIComponent(vehicleId)}`)
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.message || 'Unable to load this vehicle right now.')
  return data.vehicle
}
