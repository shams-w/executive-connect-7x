# Meta WhatsApp Cloud API Configuration

Executive Connect uses only the official Meta WhatsApp Business Platform / Cloud API. It does not use WhatsApp Web automation, unofficial libraries, SIM tricks, spoofing, masking, or number impersonation.

## Modes

- `MOCK`: no real network send; useful for demos.
- `META_TEST`: Meta test environment. Every recipient is blocked unless it is on the test allowlist.
- `META_PRODUCTION`: official corporate WhatsApp Business configuration.

## Server-only variables

Configure these in `backend/.env` or your deployment secret manager:

- `WHATSAPP_MODE`
- `META_GRAPH_API_VERSION`
- `META_ACCESS_TOKEN`
- `META_PHONE_NUMBER_ID`
- `META_WABA_ID`
- `META_WEBHOOK_VERIFY_TOKEN`
- `META_APP_SECRET`

They are never returned in full by the frontend API and are redacted from structured HTTP logs.

## Webhook

Callback URL:

`https://YOUR_API_HOST/api/webhooks/meta/whatsapp`

Use the same value for Meta's verify token and `META_WEBHOOK_VERIFY_TOKEN`. Incoming POST requests are checked using `X-Hub-Signature-256` with `META_APP_SECRET` outside MOCK mode.

Delivery states update `SENT → DELIVERED → READ`, or to `FAILED`. Incoming employee replies are stored in `inbound_messages`. Default policy is `STORE_ONLY`; they are not forwarded to the executive.

## Business display name

The approved WhatsApp Business display name is controlled by Meta/WhatsApp. Executive Connect can send using the configured business number and approved display name, but the application cannot guarantee that the underlying number is hidden in WhatsApp account details.

## Safe production activation

Production activation requires the checklist to pass and the administrator to type exactly `ACTIVATE PRODUCTION`. The system checks credentials, Phone Number ID, WABA, approved templates, webhook configuration, timezone, successful test, and backup confirmation. After readiness is approved, deploy/restart with `WHATSAPP_MODE=META_PRODUCTION`. This changes provider configuration only; employee records, celebration history, deliveries, audit logs, and templates remain in PostgreSQL.
