# Security Notes

- Passwords: Argon2id.
- Access token: 15 minutes, kept in browser memory only.
- Refresh token: random opaque token in Secure/HttpOnly/SameSite cookie; server stores only SHA-256 hash; rotated on refresh.
- RBAC roles: SUPER_ADMIN, HR_ADMIN, COMMUNICATIONS_ADMIN, VIEWER.
- HTTP protection: Helmet, CORS allowlist, rate limiting, Zod validation on settings, Prisma parameterization.
- Uploads: memory-only Multer storage, extension/MIME checks, 5 MB limit; no public upload directory.
- Secrets: server environment only; never returned in full or logged.
- Webhooks: Meta signature verification outside MOCK mode.
- Phone privacy: masked in normal responses; reveal endpoint is permission-gated and audited.
- Audit metadata redacts keys matching token/secret/password/mobile/phone.
- Normal UI deactivates employees instead of permanently deleting them.
- Celebration event uniqueness plus one-delivery-per-event prevents duplicate sends across scheduler/server restarts.
- TEST mode has a hard recipient allowlist in both job processing and Meta provider sending.
- `MINIMUM_IMPORT_AGE_MINUTES` prevents immediate sends after a fresh import.
