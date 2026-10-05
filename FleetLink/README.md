# FleetLink

## Public fleet API

The public React fleet catalogue reads live vehicle data from `GET /api/public/vehicles`
and `GET /api/public/vehicles/:vehicleId`. Set `PUBLIC_TENANT_ID` to the UUID of the
tenant whose active vehicles should be published. The endpoints return only public
vehicle details (registration, make/model, image, odometer, and next service date)
and never cross that tenant boundary.

The frontend API origin is configured with `VITE_FLEETLINK_API_URL` and defaults to
`http://localhost:3000`.

For a deployed web frontend, set `VITE_FLEETLINK_API_URL` to the publicly reachable
backend origin at build time, and set the backend `FRONTEND_URL` to the web app's
origin for CORS. The local example is in `fleet-front/my-app/.env.example`.

Recurring report schedules can be created through the API even when the API does
not run job workers. The API opens a pg-boss producer connection on first schedule
request; run `npm run worker` with the same `DATABASE_URL` to deliver scheduled
reports. If scheduling still reports a database error, check that the API's
`DATABASE_URL` is reachable and that pg-boss has been migrated/initialized.

## Tenant configuration formats

- `approvalWorkflow.levels` can be set to an ordered list such as `["DEPARTMENT_HEAD", "FLEET_MANAGER"]`.
- `roleConfiguration.permissions` maps a role name to explicit route permissions, for example `{ "AUDITOR": ["GET:/api/analytics/vehicle-utilization", "GET:/api/audit-logs"] }`. Configure every route the role should access; a configured list replaces that role's normal route allowlist.
- `customFields` maps `booking` and `trip` to field definitions. Each definition has `key`, `label`, and `type` (`string`, `number`, `boolean`, `date`, or `select`), with optional `required: true`; select fields also need string `options`. Booking forms in the web and mobile staff apps load tenant booking fields. Values are validated and stored in each record's `customData` JSON.
- `notificationSettings.enabledChannels` can restrict queued reminders to `EMAIL`, `SMS`, and/or `PUSH`. Alert lead times use `maintenanceLeadDays`, `maintenanceLeadMileage`, and `licenceWarningDays`.

Completed trips may include a `businessBenefit` amount in tenant currency. Department ROI is reported as `(recorded benefit - fuel, energy, and allocated maintenance costs) / costs * 100`; it remains unavailable when benefits or costs are missing.

`businessBenefit` is an explicitly recorded value, not an automatically inferred monetary benefit. Capture it at trip completion in the driver workflow when the tenant has a defensible savings or benefit amount; confirm a consistent accounting policy before using ROI for decisions. Rental reservations accept an optional `addOns` array of `{ "name": "Child seat", "quantity": 1, "unitPrice": 5 }` items. Customer records can retain an optional `identityVerificationReference` supplied by the tenant's identity verification process.

Notification adapters record provider message IDs. A provider or delivery gateway can post `{ "providerMessageId": "...", "status": "DELIVERED" }` or `FAILED` to `/api/notifications/delivery-receipt` with the `x-notification-receipt-secret` header. Set `NOTIFICATION_RECEIPT_SECRET` to enable the endpoint. Provider callbacks must be configured separately; delivery receipts are not polled automatically.

Provider-neutral telematics ingestion and HR/ERP sync contracts are included below. Vendor polling, source-specific field mapping, and the organization-specific data-protection review still require deployment-specific systems and decisions.

## Provider-neutral HR, ERP, and telematics sync

FleetLink exposes tenant-scoped integration API keys so a provider, middleware service, or scheduled customer connector can push records using a stable FleetLink contract. Create keys with an authenticated `FLEET_MANAGER` or `SUPER_ADMIN` session at `POST /api/integrations/keys`, for example `{ "name": "Vehicle provider", "scopes": ["telematics:write", "sync:read"] }`. The response contains the `flk_...` bearer key once; FleetLink stores only its hash. Revoke keys with `DELETE /api/integrations/keys/:keyId`. Available scopes are `telematics:write`, `hr:write`, `erp:write`, `erp:read`, and `sync:read`.

- Map provider vehicle identifiers to existing FleetLink registrations using `POST /api/integrations/telematics/vehicle-mappings` with `{ "mappings": [{ "externalId": "provider-vehicle-19", "registration": "ABC123" }] }`.
- Push normalized GPS/odometer samples to `POST /api/integrations/telematics/locations`. It accepts one sample or `{ "locations": [...] }`; each sample uses `vehicleExternalId` or `registration`, `eventId`, `latitude`, `longitude`, and optional `recordedAt`, `odometer`, `speedKph`, `heading`, and `accuracyM`. Event IDs are idempotent within a tenant.
- Push HR snapshots to `POST /api/integrations/hr/snapshot` with `departments` and `employees` arrays. Department rows use `externalId`, `name`, and optional `costCentreCode`/`budgetCode`. Employee rows use `externalId`, `email`, `name`, and optional `contact`, `departmentExternalId`, and `licenceExpiry`. FleetLink updates matching tenant users by provider ID or email and reports unmatched employees instead of creating passwordless accounts. It does not overwrite user roles or deactivate users omitted from a snapshot.
- Push ERP department cost centres to `POST /api/integrations/erp/cost-centres` as `{ "costCentres": [{ "externalId": "cc-42", "name": "Operations", "costCentreCode": "CC42", "budgetCode": "B17" }] }`. Read department ROI from `GET /api/integrations/erp/department-roi?start=...&end=...` with the `erp:read` scope and an analytics-enabled tenant.
- Inspect recent integration outcomes at `GET /api/integrations/sync-runs?limit=50` using `sync:read`. Each sync records received, processed, skipped, and failed counts.

These endpoints are the provider adapter boundary; they do not poll a named vendor. Configure the vendor or an integration middleware to push the normalized contract above. Vendor polling, source-specific field mapping, and delivery callback setup can be added once the selected vendor API supports them.

Production setup: set `ENCRYPTION_SECRET` to an independently generated secret with at least 32 bytes. Do not use the development fallback or the JWT signing secret. For key rotation, set `ENCRYPTION_SECRET_PREVIOUS` to the old key while writing new ciphertext with the new `ENCRYPTION_SECRET`, keep `PII_HASH_SECRET` fixed at the original hash key, re-encrypt stored personal data, and only then remove the previous key. Restart/redeploy the API after applying Prisma migrations and regenerating the client. Run a persistent worker with the same `DATABASE_URL` using `npm run worker`; the API can enqueue scheduled work while the worker is unavailable, but jobs will not be processed until it connects. Set `VITE_FLEETLINK_API_URL` to the public API origin when building the frontend, and set `FRONTEND_URL` to the deployed frontend origin(s) on the API. Check `/health` for process liveness and `/ready` for database readiness.
