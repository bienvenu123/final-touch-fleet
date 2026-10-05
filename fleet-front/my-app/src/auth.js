export const AUTH_STORAGE_KEY = 'fleetlink_session'
export const WEB_AUTH_STORAGE_KEY = 'fleetlink_web_session'

export function getWebSession() {
  try {
    const session = JSON.parse(localStorage.getItem(WEB_AUTH_STORAGE_KEY) || 'null')
    return session?.token && session?.user?.role === 'CUSTOMER' ? session : null
  } catch {
    return null
  }
}

export function clearWebSession() {
  localStorage.removeItem(WEB_AUTH_STORAGE_KEY)
  window.dispatchEvent(new Event('fleetlink:session-change'))
}

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
  window.dispatchEvent(new Event('fleetlink:session-change'))
}

export function hasAdminAccess() {
  return ['FLEET_MANAGER', 'SUPER_ADMIN'].includes(getSession()?.user?.role)
}
