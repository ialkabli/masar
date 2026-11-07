# مسار · MASAR

Team project workspace. A standalone Arabic RTL portfolio application by **Abdulmajeed Hassan Kabli / عبدالمجيد حسن كابلي** (@iprigner).

![Desktop preview](docs/desktop.png)

## العربية

مساحة واحدة تجمع المشاريع والمهام وأحاديث الفريق.

مشروع تجريبي للتعلم والعرض، وليس نظامًا مستخدمًا لدى عميل. يتضمن واجهة React وTypeScript وخادم Fastify وقاعدة بيانات PostgreSQL مضمّنة محليًا بواسطة PGlite. يمكن استخدام PostgreSQL خارجي عبر DATABASE_URL. لا يحتاج التشغيل الافتراضي إلى Docker أو حساب سحابي.

## Features

Workspace creation, owner/member roles, adding existing accounts, task assignment, priority/status board, comments, optimistic version checks, activity history and in-app notifications.

## Run locally

Requires Node.js 24 LTS and npm. Run from this repository directory:

```sh
npm ci
npm run build
npm start
```

Open **http://127.0.0.1:8343**. The server binds to loopback only. Data persists under `data/database` (gitignored).

Demo accounts: `admin@example.test`, `staff@example.test`, `guest@example.test`. Default demo password: `Portfolio!2026`. These are public sample credentials, not personal credentials. DEMO_PASSWORD only affects initial creation; changing it does not reset existing passwords.

### Development

```sh
# terminal 1
npm run dev:server
# terminal 2
npm run dev
```

Open http://127.0.0.1:8443. Vite proxies API requests to the loopback server.

`.env.example` documents environment variables. `.env` is not loaded automatically: set variables in the shell, or use `node --env-file=.env --import tsx server/index.ts`. Never commit a real `.env` or database.

### External PostgreSQL

Use a dedicated empty PostgreSQL 17 database. Set DATABASE_URL before starting (PowerShell example):

```powershell
$env:DATABASE_URL='postgresql://portfolio:portfolio@127.0.0.1:5432/masar'
npm start
```

Schema is created idempotently at startup. Do not point the test suite at real application data; use a disposable empty database. Demo setup is the supported local workflow. User provisioning without demo seeding is outside this version.

## Verification

```sh
npm run check
```

Runs strict TypeScript checking, production bundling and API integration tests against the actual embedded PostgreSQL engine. Tests exercise authentication, authorization and the business rules below. GitHub Actions also defines a PostgreSQL 17 service job; its hosted run occurs only after you choose to push the repository. Local external-PostgreSQL execution is reported separately from embedded-engine results.

1. Admin and staff share the seeded workspace. Guest does not.
2. Assign a task to staff; sign in as staff and update it.
3. Post a comment and inspect notifications and activity.
4. Open the same task in two sessions; a stale update receives HTTP 409.

## Engineering decisions

Membership checks are enforced on every task and comment endpoint. Only workspace owners assign work to other members; members update their own tasks. Row locks plus a version number reject stale concurrent edits instead of silently overwriting them.

See [architecture and tradeoffs](docs/DECISIONS.md). No customer records or cloud credentials are bundled. Bearer tokens are held in memory and invalidated at logout. Refresh the browser to return to login.

## Scope and limitations

Adding members uses existing seeded accounts; no outbound invitations or email service. No public registration, member removal, file attachments, recurring tasks or realtime push. Refresh updates the board. Notifications are in-app only.

These are portfolio implementations, not production deployments. This repository was prepared with AI coding assistance; the author should review the implementation and be able to explain and modify it during interviews. No professional-client or production-usage claim is implied.

## Repository layout

- `client/`: React RTL interface
- `server/`: Fastify routes, authentication, PostgreSQL transactions
- `tests/`: API and business-rule integration tests
- `docs/`: decisions, previews and interview notes
- `.github/workflows/check.yml`: reproducible checks

## Preparing for GitHub

Review the code and choose a license before publishing. `node_modules`, `data`, `dist`, `.env` and test output are ignored. No remote is configured by this preparation. Deployment is not required for reviewing source; screenshots and local setup instructions are provided.

## Browser smoke check

```sh
npx playwright install chromium
npm run test:ui
```

This starts a local server if needed and checks Arabic login, responsive layout and logout. The bundle additionally exercised the domain workflows described in its verification report. See [API contracts](docs/API.md).

## Interview notes بالعربية

اقرأ [شرح المشروع وسيناريو العرض والأسئلة](docs/INTERVIEW-AR.md).

![Mobile preview](docs/mobile.png)
