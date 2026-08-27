export const AUTH_STORAGE_KEY = 'fleetlink_session'

export function getSession() {
  try {
    const session = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || 'null')
    return session?.token && session?.user ? session : null
  } catch {
    return null
  }
}

export function clearSession() {
  localStorage.removeItem(AUTH_STORAGE_KEY)
  localStorage.removeItem('fleetlink_admin_token')
}

export function hasAdminAccess() {
  return ['FLEET_MANAGER', 'SUPER_ADMIN'].includes(getSession()?.user?.role)
}
