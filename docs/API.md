# Executive Connect API

Base URL in local development: `http://localhost:8000/api`

Authentication uses a short-lived Bearer access token and a rotating HttpOnly refresh cookie.

## Authentication
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me` — current user, including `mustChangePassword`
- `POST /auth/change-password` — `{currentPassword,newPassword}`; returns a fresh access token

While a user still has a default or temporary password, every endpoint outside `/auth/*` returns `403` with `code: "PASSWORD_CHANGE_REQUIRED"`.

## Users (SUPER_ADMIN only)
- `GET /users`
- `POST /users` — `{username,displayName,role,password}`; the user must change the password at first sign-in
- `PATCH /users/:id` — `{displayName?,role?,isActive?}`; you cannot deactivate/demote yourself or the last Super Admin
- `POST /users/:id/reset-password` — `{password}`; signs the user out everywhere

## Dashboard
- `GET /dashboard` — includes `upcoming`: celebrations in the next 30 days computed from employee dates
- `GET /dashboard/alerts` — failed-message count (7 days) and the latest alert, for the banner

## Employees
- `GET /employees?q=`
- `GET /employees/:id/reveal-phone` — audited; SUPER_ADMIN/HR_ADMIN
- `POST /employees` — add one employee; returns `409` with `code: "POSSIBLE_DUPLICATE"` and `duplicates` unless `confirmDuplicates: true`
- `PATCH /employees/:id` — same duplicate check
- `DELETE /employees/:id` — permanent; removes that employee's celebration/message history (audited)
- `GET /employees/export` — `.xlsx` in the import-template format, with full numbers; SUPER_ADMIN/HR_ADMIN, audited

## Excel imports
- `GET /imports/template`
- `POST /imports/detect` — multipart field `file`
- `POST /imports/preview` — multipart fields `file`, optional JSON `mapping`
- `POST /imports/:id/confirm`
- `GET /imports/:id/errors`

## Celebrations
- `GET /celebrations`
- `GET /celebrations/upcoming?days=30`
- `GET /celebrations/preview?employeeId=&eventType=&yearsOfService=&templateId=` — message text for an upcoming celebration
- `GET /celebrations/:id/preview` — message text for an existing celebration
- `POST /celebrations/plan` — `{employeeId,eventType,eventDate,action:'skip'|'unskip'|'template',templateId?}` to skip or pick a template ahead of time
- `POST /celebrations/run/birthday`
- `POST /celebrations/run/anniversary`
- `POST /celebrations/:id/approve`
- `POST /celebrations/:id/reject`
- `POST /celebrations/process`

## Messages
- `GET /messages?status=FAILED`
- `POST /messages/test`
- `POST /messages/:id/retry`
- `POST /messages/:id/cancel`

## Templates
- `GET /templates`
- `POST /templates`
- `PATCH /templates/:id` — partial update; only the fields sent change

Templates have an optional `bodyText` (a copy of the approved Meta text with `{{1}}`, `{{2}}` placeholders) used for previews, and `variables` listing which value fills each placeholder: `firstName`, `lastName`, `fullName` or `yearsOfService`.

## WhatsApp / Admin settings
- `GET /settings/whatsapp`
- `PUT /settings/whatsapp/connection` — SUPER_ADMIN; `{mode?:'MOCK'|'META_TEST',graphApiVersion?,phoneNumberId?,wabaId?,accessToken?,appSecret?,webhookVerifyToken?,clear?:[]}`. Secrets are stored encrypted and never returned; empty values keep the saved ones
- `DELETE /settings/whatsapp/connection` — SUPER_ADMIN; go back to the `.env` values
- `GET /settings/whatsapp/templates-check` — approval status in Meta for each active template
- `PUT /settings/whatsapp/preferences`
- `POST /settings/whatsapp/validate` — real check against Meta (works in MOCK mode too)
- `GET /settings/production-checklist`
- `POST /settings/activate-production` — switches to live sending immediately once the checklist passes
- `GET /admin-settings`
- `PUT /admin-settings`

## Webhooks
- `GET /webhooks/meta/whatsapp` — Meta verification
- `POST /webhooks/meta/whatsapp` — Meta messages and delivery receipts

## Audit
- `GET /audit` — SUPER_ADMIN only
