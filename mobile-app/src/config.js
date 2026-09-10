import { Platform } from 'react-native'

// Override this with EXPO_PUBLIC_FLEETLINK_API_URL in .env.
// A phone cannot reach its development machine through localhost.
const defaultApiUrl = Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000'

export const API_URL = (process.env.EXPO_PUBLIC_FLEETLINK_API_URL || defaultApiUrl).replace(/\/$/, '')
