import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { decideStaffBooking, getAvailableVehicles, getStaffBookings, getStaffBookingCustomFields, getStaffDrivers, submitStaffBooking } from './api'

const blank = { start: '', end: '', destination: '', purposeCategory: '', justification: '', passengerCount: '1' }
const iso = value => new Date(value).toISOString()

export default function StaffWorkflow({ token, role }) {
  const [bookings, setBookings] = useState([]), [vehicles, setVehicles] = useState([]), [form, setForm] = useState(blank)
  const [loading, setLoading] = useState(false), [busy, setBusy] = useState(false), [alternate, setAlternate] = useState({}), [drivers, setDrivers] = useState([]), [alternateDriver, setAlternateDriver] = useState({}), [rejectionReasons, setRejectionReasons] = useState({})
  const [customFields, setCustomFields] = useState([]), [customData, setCustomData] = useState({})
  const canApprove = ['DEPARTMENT_HEAD', 'FLEET_MANAGER', 'SUPER_ADMIN'].includes(role)
  const canRequest = ['STAFF', 'DEPARTMENT_HEAD', 'FLEET_MANAGER', 'SUPER_ADMIN'].includes(role)
  const load = async () => { setLoading(true); try { setBookings(await getStaffBookings(token)); setCustomFields(await getStaffBookingCustomFields(token)); if (canApprove) setDrivers(await getStaffDrivers(token)) } catch (error) { Alert.alert('Bookings unavailable', error.message) } finally { setLoading(false) } }
  useEffect(() => { load() }, [token])
  const change = (key, value) => setForm(current => ({ ...current, [key]: value }))
  const search = async () => {
    if (!form.start || !form.end) return Alert.alert('Dates required', 'Enter the requested start and end date and time first.')
    try { setVehicles(await getAvailableVehicles(token, iso(form.start), iso(form.end))); setForm(current => ({ ...current, vehicleId: '' })) } catch (error) { Alert.alert('Availability unavailable', error.message) }
  }
  const submit = async () => {
    if (!vehicles.length) return Alert.alert('Choose a vehicle', 'Search availability and select a vehicle before submitting.')
    if (!form.destination.trim() || !form.justification.trim() || !form.purposeCategory.trim()) return Alert.alert('Complete the request', 'Destination, purpose category, and justification are required.')
    const selectedVehicleId = form.vehicleId || vehicles[0]?.id
    setBusy(true)
    try {
      await submitStaffBooking(token, { vehicleId: selectedVehicleId, start: iso(form.start), end: iso(form.end), destination: form.destination.trim(), purposeCategory: form.purposeCategory.trim(), justification: form.justification.trim(), passengerCount: Number(form.passengerCount), kind: 'CORPORATE', customData })
      setForm(blank); setCustomData({}); setVehicles([]); await load(); Alert.alert('Request submitted', 'Your request is awaiting approval.')
    } catch (error) { Alert.alert('Request not submitted', error.message) } finally { setBusy(false) }
  }
  const decide = async (booking, decision) => {
    const comment = decision === 'rejection' ? (rejectionReasons[booking.id] || '').trim() : 'Approved in mobile app'
    if (decision === 'rejection' && !comment) return Alert.alert('Reason required', 'Enter a reason before rejecting this request.')
    setBusy(true)
    try { await decideStaffBooking(token, booking.id, decision, { comment, ...(alternate[booking.id] ? { vehicleId: alternate[booking.id] } : {}), ...(alternateDriver[booking.id] ? { driverId: alternateDriver[booking.id] } : {}) }); await load() }
    catch (error) { Alert.alert('Decision not saved', error.message) } finally { setBusy(false) }
  }
  return <ScrollView contentContainerStyle={styles.page}>
    <View style={styles.header}><Text style={styles.title}>{canApprove ? 'Team bookings' : 'My bookings'}</Text><Pressable style={styles.outline} onPress={load}><Text>Refresh</Text></Pressable></View>
    {canRequest && <View style={styles.card}><Text style={styles.heading}>Request a vehicle</Text>
      <Input label="Start date and time (local)" value={form.start} onChangeText={value => change('start', value)} placeholder="2026-10-04T09:00" />
      <Input label="Expected return (local)" value={form.end} onChangeText={value => change('end', value)} placeholder="2026-10-04T17:00" />
      <Pressable style={styles.secondary} onPress={search}><Text style={styles.secondaryText}>Search available vehicles</Text></Pressable>
      {vehicles.map(vehicle => <Pressable key={vehicle.id} style={[styles.vehicle, form.vehicleId === vehicle.id && styles.selected]} onPress={() => change('vehicleId', vehicle.id)}><Text style={styles.vehicleText}>{vehicle.registration} · {[vehicle.make, vehicle.model].filter(Boolean).join(' ')}</Text></Pressable>)}
      <Input label="Destination" value={form.destination} onChangeText={value => change('destination', value)} />
      <Input label="Purpose category" value={form.purposeCategory} onChangeText={value => change('purposeCategory', value)} placeholder="e.g. Client visit" />
      <Input label="Purpose and justification" value={form.justification} onChangeText={value => change('justification', value)} multiline />
      <Input label="Passengers" value={form.passengerCount} onChangeText={value => change('passengerCount', value)} keyboardType="number-pad" />
      {customFields.map(field => <CustomField key={field.key} definition={field} value={customData[field.key]} onChange={value => setCustomData(current => ({ ...current, [field.key]: value }))} />)}
      <Pressable style={styles.primary} disabled={busy} onPress={submit}><Text style={styles.primaryText}>{busy ? 'Submitting…' : 'Submit booking request'}</Text></Pressable>
    </View>}
    <Text style={styles.heading}>{canApprove ? 'Assigned requests' : 'Request history'}</Text>
    {loading ? <ActivityIndicator /> : bookings.length ? bookings.map(booking => <View key={booking.id} style={styles.card}>
      <Text style={styles.vehicleText}>{booking.vehicle?.registration || 'Vehicle'} · {booking.status}</Text>
      <Text style={styles.muted}>{booking.destination || 'No destination'} · {booking.purposeCategory || booking.justification}</Text>
      <Text style={styles.muted}>{new Date(booking.startAt).toLocaleString()} – {new Date(booking.endAt).toLocaleString()}</Text>
      {canApprove && booking.status === 'PENDING' && <><Input label="Rejection reason" value={rejectionReasons[booking.id] || ''} onChangeText={value => setRejectionReasons(current => ({ ...current, [booking.id]: value }))} placeholder="Required if rejecting" multiline /><Input label="Reassign vehicle ID (optional)" value={alternate[booking.id] || ''} onChangeText={value => setAlternate(current => ({ ...current, [booking.id]: value }))} placeholder="Leave blank to keep assigned vehicle" /><Text style={styles.muted}>Assign driver (optional)</Text>{drivers.map(driver => <Pressable key={driver.id} style={[styles.vehicle, alternateDriver[booking.id] === driver.id && styles.selected]} onPress={() => setAlternateDriver(current => ({ ...current, [booking.id]: current[booking.id] === driver.id ? '' : driver.id }))}><Text style={styles.vehicleText}>{driver.name}</Text></Pressable>)}<View style={styles.actions}><Pressable style={styles.primary} disabled={busy} onPress={() => decide(booking, 'approval')}><Text style={styles.primaryText}>Approve</Text></Pressable><Pressable style={styles.reject} disabled={busy} onPress={() => decide(booking, 'rejection')}><Text style={styles.rejectText}>Reject</Text></Pressable></View></>}
    </View>) : <Text style={styles.muted}>No booking requests yet.</Text>}
  </ScrollView>
}

function Input({ label, ...props }) { return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput style={[styles.input, props.multiline && styles.multiline]} placeholderTextColor="#8b98a7" {...props} /></View> }
function CustomField({ definition, value, onChange }) {
  if (definition.type === 'boolean') return <Pressable style={styles.secondary} onPress={() => onChange(!value)}><Text style={styles.secondaryText}>{value ? '✓ ' : '○ '}{definition.label || definition.key}{definition.required ? ' *' : ''}</Text></Pressable>
  if (definition.type === 'select') {
    const options = definition.options || []
    const next = () => { const index = options.indexOf(value); onChange(options[(index + 1) % options.length]) }
    return <View style={styles.field}><Text style={styles.label}>{definition.label || definition.key}{definition.required ? ' *' : ''}</Text><Pressable style={styles.input} onPress={next}><Text>{value || 'Tap to choose'}{options.length ? ` · ${options.join(' / ')}` : ''}</Text></Pressable></View>
  }
  return <Input label={`${definition.label || definition.key}${definition.required ? ' *' : ''}`} value={value == null ? '' : String(value)} onChangeText={onChange} keyboardType={definition.type === 'number' ? 'decimal-pad' : 'default'} placeholder={definition.type} />
}
const styles = StyleSheet.create({ page:{ padding:18, gap:13, backgroundColor:'#f5f7fb', flexGrow:1 }, header:{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' }, title:{ fontSize:24, fontWeight:'900', color:'#102a43' }, heading:{ fontSize:17, fontWeight:'800', color:'#102a43' }, card:{ backgroundColor:'#fff', borderRadius:13, padding:14, gap:10 }, field:{ gap:5 }, label:{ color:'#334e68', fontSize:12, fontWeight:'800' }, input:{ borderWidth:1, borderColor:'#dce4ec', borderRadius:9, padding:10, color:'#102a43' }, multiline:{ minHeight:75, textAlignVertical:'top' }, secondary:{ borderWidth:1, borderColor:'#b7791f', padding:11, borderRadius:9, alignItems:'center' }, secondaryText:{ color:'#8d5e16', fontWeight:'800' }, vehicle:{ padding:10, borderRadius:8, backgroundColor:'#f5f7fb' }, selected:{ borderWidth:1, borderColor:'#b7791f', backgroundColor:'#fff8e9' }, vehicleText:{ color:'#102a43', fontWeight:'800' }, primary:{ backgroundColor:'#09243a', padding:12, borderRadius:9, alignItems:'center' }, primaryText:{ color:'#fff', fontWeight:'800' }, reject:{ backgroundColor:'#fde8e8', padding:12, borderRadius:9, alignItems:'center' }, rejectText:{ color:'#b42318', fontWeight:'800' }, actions:{ flexDirection:'row', gap:8 }, outline:{ borderWidth:1, borderColor:'#b7791f', padding:8, borderRadius:8 }, muted:{ color:'#52606d', lineHeight:20 } })
