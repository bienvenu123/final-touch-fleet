import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Location from 'expo-location'
import * as Notifications from 'expo-notifications'
import { endDriverTrip, ingestTelematicsLocation, registerPushToken, startDriverTrip } from './api'

const QUEUE_KEY = 'fleetlink_driver_sync_queue'

async function readQueue() {
  try { return JSON.parse(await AsyncStorage.getItem(QUEUE_KEY) || '[]') } catch { return [] }
}

async function writeQueue(queue) {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-200)))
}

export async function requestDriverPermissions() {
  const location = await Location.requestForegroundPermissionsAsync()
  const notifications = await Notifications.requestPermissionsAsync()
  return { locationGranted: location.status === 'granted', notificationsGranted: notifications.status === 'granted' }
}

export async function registerDeviceForPush(token) {
  const permissions = await Notifications.getPermissionsAsync()
  if (permissions.status !== 'granted') return null
  const deviceToken = await Notifications.getExpoPushTokenAsync()
  return registerPushToken(token, { token: deviceToken.data, platform: Platform.OS })
}

export async function queueTripStart(tripId, payload) {
  const queue = await readQueue()
  queue.push({ id: `${Date.now()}-start-${tripId}`, type: 'TRIP_START', tripId, payload, createdAt: new Date().toISOString() })
  await writeQueue(queue)
}

export async function queueTripEnd(tripId, payload) {
  const queue = await readQueue()
  queue.push({ id: `${Date.now()}-end-${tripId}`, type: 'TRIP_END', tripId, payload, createdAt: new Date().toISOString() })
  await writeQueue(queue)
}

export async function queueVehicleLocation(vehicleId, location) {
  const queue = await readQueue()
  queue.push({
    id: `${Date.now()}-location-${vehicleId}`,
    type: 'LOCATION',
    vehicleId,
    payload: {
      vehicleId,
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracyM: location.coords.accuracy,
      speedKph: location.coords.speed == null ? undefined : Math.max(0, location.coords.speed * 3.6),
      heading: location.coords.heading == null || location.coords.heading < 0 ? undefined : location.coords.heading,
      recordedAt: new Date(location.timestamp || Date.now()).toISOString(),
      source: 'MOBILE_DRIVER',
    },
    createdAt: new Date().toISOString(),
  })
  await writeQueue(queue)
}

export async function syncDriverQueue(token) {
  const queue = await readQueue()
  const remaining = []
  let synced = 0
  for (const item of queue) {
    try {
      if (item.type === 'TRIP_START') await startDriverTrip(token, item.tripId, item.payload)
      else if (item.type === 'TRIP_END') await endDriverTrip(token, item.tripId, item.payload)
      else if (item.type === 'LOCATION') await ingestTelematicsLocation(token, item.payload)
      synced += 1
    } catch {
      remaining.push(item)
    }
  }
  await writeQueue(remaining)
  return { synced, pending: remaining.length }
}

export async function watchActiveTripLocation(vehicleId, onLocation) {
  const permissions = await requestDriverPermissions()
  if (!permissions.locationGranted) throw new Error('Location permission is required to track an active trip')
  return Location.watchPositionAsync(
    { accuracy: Location.Accuracy.Balanced, timeInterval: 30000, distanceInterval: 20 },
    async (location) => {
      await queueVehicleLocation(vehicleId, location)
      if (onLocation) onLocation(location)
    },
  )
}
