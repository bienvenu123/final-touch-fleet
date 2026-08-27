# FleetLink

## Public fleet API

The public React fleet catalogue reads live vehicle data from `GET /api/public/vehicles`
and `GET /api/public/vehicles/:vehicleId`. Set `PUBLIC_TENANT_ID` to the UUID of the
tenant whose active vehicles should be published. The endpoints return only public
vehicle details (registration, make/model, image, odometer, and next service date)
and never cross that tenant boundary.

The frontend API origin is configured with `VITE_FLEETLINK_API_URL` and defaults to
`http://localhost:3000`.
