# Executive Connect

Production-oriented internal employee celebration messaging platform for birthdays and work anniversaries. It imports HR Excel data, validates/upserts employees, creates deterministic celebration events, selects Meta-approved WhatsApp templates by language/milestone, queues controlled sends, receives Meta delivery receipts, stores inbound replies, and preserves an audit trail.

## Project layout

```text
executive-connect/
  frontend/                 React + TypeScript + Vite + Tailwind
  backend/                  Node + TypeScript + Express + Prisma
    prisma/                 PostgreSQL schema, migration, seed
    tests/                  unit + API + DB acceptance tests
  docs/                     API, Excel, Meta, security guides
  docker-compose.yml        PostgreSQL 16 for local development
  .env.example              placeholders only
```

## 1. Prerequisites

Install Node.js 22+, npm, and either Docker Desktop or PostgreSQL 16+.

## 2. Install dependencies

From the project root:

```bash
npm install
```

## 3. Start PostgreSQL

With Docker:

```bash
docker compose up -d postgres
```

Or create a native PostgreSQL database named `executive_connect` and update `DATABASE_URL`.

## 4. Configure environment

```bash
cp .env.example backend/.env
cp frontend/.env.example frontend/.env
```

For the first run, keep `WHATSAPP_MODE=MOCK`. Replace JWT/refresh secrets with long random values before any shared deployment. Do not commit `.env`.

## 5. Create database schema and seed safe demo data

```bash
npm run prisma:generate -w backend
npm run prisma:deploy -w backend
npm run seed -w backend
```

First login:

- Username: `admin`
- Password: `ChangeMe!2026`

You are asked to choose a new password straight away; nothing else works until you do. Re-running the seed never resets a password that was already changed.

### Employee IDs

Employee IDs use the format `EMP001`, `EMP002`, … If you leave the ID empty when adding an employee or importing Excel, the next free EMP number is assigned (Excel rows are first matched by WhatsApp number). If an older database has IDs in another format, list and fix them with:

```bash
npm run fix:employee-ids -w backend              # shows what would change
npm run fix:employee-ids -w backend -- --apply   # renames them
```

Update the Employee ID column in any saved Excel files afterwards (or clear it) so re-uploading doesn't create duplicates.

### Users and roles

Super Admins manage sign-ins under **Users**: add people with a temporary password (they must change it at first sign-in), change roles, deactivate accounts or reset passwords. Everyone can change their own password from the sidebar.

| Role | Can do |
|---|---|
| Super Admin | Everything, including users, settings and audit logs |
| HR Admin | Add, edit, import, export and delete employees |
| Communications Admin | Templates, approvals and sending |
| Viewer | Read-only |

## 6. Start backend

```bash
npm run dev -w backend
```

Backend: `http://localhost:8000`
Health check: `http://localhost:8000/api/health`

## 7. Start frontend

In another terminal:

```bash
npm run dev -w frontend
```

Frontend: `http://localhost:5173`

You can also start both from root:

```bash
npm run dev
```

## 8. Beginner first journey

1. Open `http://localhost:5173` and log in.
2. To add a single employee, open **Employees** → **+ Add employee** and enter name, WhatsApp number, birthday and joining date. Click a row → **Edit** to change any of them. For many employees at once, use **Excel Imports**:
3. Open **Excel Imports**.
4. Click **Download Excel Template**.
5. Fill fake/test data first.
6. Upload the file, confirm detected columns, map any unmatched fields, validate, and inspect New / Updates / Unchanged / Duplicates / Errors.
7. Confirm only when the preview is correct.
8. Open **Celebrations** and run Birthday or Anniversary Check Now.
9. With the default `AUTO` policy, events are approved automatically. (If an admin switches to `REVIEW`, approve each pending event first.)
10. Click **Send approved now** (or wait for the automatic run). In `MOCK`, no real WhatsApp message is sent and delivery is simulated.
11. Open **Delivery History** to see state changes.

The **Dashboard** lists every birthday and work anniversary in the next 30 days. From there you can preview the exact message, **Skip** one person's message, or pick a specific template for them, ahead of time. **Employees → Export to Excel** downloads everyone in the same format as the import template, so you can edit and re-upload it.

## 9. Test Meta WhatsApp account

Read `docs/META_WHATSAPP.md`. The easiest way is from the dashboard: a Super Admin opens **WhatsApp Configuration → Connect WhatsApp** and fills in:

- API version, Phone number ID and WhatsApp Business Account ID
- Access token, App secret and Webhook verify token (stored encrypted, never shown again)

Each field explains where to find the value in Meta. Then:

1. Click **Save connection**, then **Test connection**. Meta answers with your business number and name.
2. Choose **Test** as the sending mode and save.
3. Click **Check templates with Meta** to confirm every active template is approved, with matching names and languages.
4. Add your own number to the test allowlist and send yourself a **test message**.
5. In Meta, set the webhook to the **Callback URL** shown on the page (it only works once the app is on a public HTTPS address).

Values saved in the dashboard take priority over `backend/.env`. **Remove dashboard settings** goes back to the `.env` values. Secrets are encrypted with `SETTINGS_ENCRYPTION_KEY`, or with a key derived from `JWT_SECRET` if that is empty. If you change whichever one is used, re-enter the secrets.

Alternatively, put the same values in `backend/.env`:

```env
WHATSAPP_MODE=META_TEST
META_GRAPH_API_VERSION=<supported version>
META_ACCESS_TOKEN=<secret>
META_PHONE_NUMBER_ID=<test phone number id>
META_WABA_ID=<test waba id>
META_WEBHOOK_VERIFY_TOKEN=<random verify token>
META_APP_SECRET=<meta app secret>
```

Add allowed test recipients in **WhatsApp Configuration** or `TEST_ALLOWED_NUMBERS`. In `META_TEST`, any non-allowlisted recipient is blocked even if that employee exists in the database.

## 10. Birthday template configuration

In Meta WhatsApp Manager, create/approve an English template such as `birthday_greeting_en` with one body variable for the first name. In **Message Templates**, ensure the record uses:

- Event: `BIRTHDAY`
- Language: `EN`
- Meta language code: e.g. `en`
- Variables: first name

Configure Arabic separately (`birthday_greeting_ar`) with `Language=AR` and the matching approved Meta language code.

## 11. Anniversary template configuration

Use an approved template such as `work_anniversary_en` with variables for employee name and years of service. Arabic is configured separately.

For 1, 5, 10, 15, and 20 year milestones, an active internal template whose name contains `milestone` is preferred, e.g. `work_anniversary_milestone_en`. If unavailable, the standard anniversary template is used.

## 12. Scheduler and safety controls

Default runtime settings:

- Timezone: `Asia/Dubai`
- Daily time: `09:00`
- Send policy: `AUTO` (switch to `REVIEW` to require manual approval before each send)
- Inbound policy: `STORE_ONLY`
- Minimum import age: 30 minutes
- Non-leap-year Feb 29 policy: Feb 28

SUPER_ADMIN can change these in **Admin Settings**.

How sending works:

- The scheduler checks every minute. Once the daily send time has passed, it runs that day's job if it hasn't run yet. If the server was down at 09:00, the job runs as soon as it comes back the same day.
- After the daily run, it re-checks every 5 minutes, so employees added later in the day, late approvals and retries still go out the same day.
- Messages are only ever sent on the celebration day itself. Anything not sent by the end of that day is marked **Expired** instead of arriving late.
- Database uniqueness rules guarantee nobody gets the same celebration message twice, however often the job runs.

### Failure alerts

Failed messages, an expired WhatsApp access token, a missing template or a crashed daily run show as a red banner at the top of every page. To also get them by email, set these in `backend/.env` and restart the backend:

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=alerts@example.com
SMTP_PASS=<secret>
ALERT_EMAIL_FROM=alerts@example.com
ALERT_EMAIL_TO=hr-team@example.com
```

Each kind of alert is emailed at most once an hour.

## 13. Switch safely to the corporate WhatsApp Business number

Do not rewrite code or replace employee data. Keep the same PostgreSQL database.

1. Complete testing in `MOCK`, then `META_TEST`.
2. Enter the corporate WABA, Phone Number ID, access token, app secret and webhook verify token under **WhatsApp Configuration → Connect WhatsApp** (or in the server environment), and make sure the templates are approved.
3. Confirm webhook delivery receipts work.
4. Confirm a test message passes.
5. Confirm database backups are configured in **Admin Settings**.
6. Open **Admin Settings → Production Activation**, refresh the checklist, and type `ACTIVATE PRODUCTION`.
7. Live sending starts immediately; no restart is needed. To pause it, choose Test or Simulation under **WhatsApp Configuration** and save.

Only provider configuration changes. Employee records, import history, celebration events, message history, and audit logs remain intact.

## 14. Tests

Pure/unit tests:

```bash
npm run test -w backend
```

Full PostgreSQL acceptance tests (requires migrated test database):

```bash
RUN_DB_TESTS=1 npm run test -w backend
```

The test files map to the 20 critical acceptance requirements in the specification. Use a separate database for them (set `DATABASE_URL` to a test database and run `npx prisma migrate deploy` in `backend` first) so your real data is never touched. Frontend smoke test:

```bash
npm run test -w frontend
```

## 15. Production build

```bash
npm run build          # backend → backend/dist, frontend → frontend/dist
npm run start -w backend
```

Serve `frontend/dist` with any static web server and point `VITE_API_URL` (set at build time) at the backend.

## Important privacy note

Normal tables never expose the full employee phone number. The reveal endpoint is restricted and audited. Birthday dashboards show day/month rather than birth year. Meta credentials never go to the browser.

See `docs/SECURITY.md`, `docs/EXCEL_TEMPLATE.md`, `docs/META_WHATSAPP.md`, and `docs/API.md` for details.
