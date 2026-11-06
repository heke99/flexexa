# Portal → AWS API integration

The company and platform inventory actions now use same-origin server routes forwarding only the current caller JWT to the fixed staging AWS charging API. The AWS API retains live session/RLS enforcement and audited MFA-protected platform reads. There is no service-role fallback, permission cache, arbitrary upstream URL, cookie forwarding or simulated inventory fallback.

Server routes bound response size to 256 KiB, request time to six seconds, reject redirects and non-JSON responses, and parse the canonical response contracts before returning data. Every response is no-store. The portal invalidates old session responses, disables company switching during an inventory request and rechecks the session epoch after parsing responses.

Verified pre-release: web API-boundary tests, lint, typecheck and production build. The existing confirmed owner already has superadmin membership; no privileges were changed. Live readback found no MFA factor and no tenant. No BMW/Enode/charger secrets are configured in the AWS region used by this application. Provider-independent linking remains a partial implementation, and physical charging is not ready for release. These are blockers, not successful scenarios.

Official BMW references reviewed 2026-11-05: https://www.bmwgroup.com/en/general/regulations/cardata.html and https://bmw-cardata.bmwgroup.com/customer/public/api-documentation. Customer CarData is personal-use data access and not proof of commercial partner access or charging command support. The commercial connection requires registered provider access and customer consent; no unsupported vehicle controls are advertised.
