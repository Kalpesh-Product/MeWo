# MeWo Website — Developer Documentation

The production website for **MeWo — Meetings & Co-Working**, a serviced work nest in Patto, Panjim, Goa. It is a Next.js App Router application that reproduces the original marketing site while adding a MongoDB-backed inquiry pipeline, private S3 attachment storage and a token-protected read API for external dashboards.

**Stack:** Next.js 16.4 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS v4 · MongoDB 7 driver · AWS SDK v3 (S3) · Zod 4 · Node's built-in test runner

---

## Contents

1. [Features](#1-features)
2. [Quick start](#2-quick-start)
3. [Environment variables](#3-environment-variables)
4. [Repository structure](#4-repository-structure)
5. [Architecture](#5-architecture)
6. [Data model](#6-data-model)
7. [HTTP API](#7-http-api)
8. [Scripts](#8-scripts)
9. [Testing](#9-testing)
10. [Deployment](#10-deployment)
11. [Security and data handling](#11-security-and-data-handling)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Features

**Public Pages**

| Path               | Legacy alias  | Content                                                          |
| ------------------ | ------------- | ---------------------------------------------------------------- |
| `/`                | `/index.html` | Hero slideshow, amenities grid, membership teaser, press marquee |
| `/about.html`      | `/about`      | Company story, goals, three workspace zones                      |
| `/membership.html` | `/membership` | Six membership cards with detail dialogs                         |
| `/gallery.html`    | `/gallery`    | Photo grid with keyboard-accessible lightbox                     |
| `/press.html`      | `/press`      | Press clippings and quotes                                       |
| `/startup.html`    | `/startup`    | Startup support copy and the startup inquiry form                |
| `/contact.html`    | `/contact`    | Contact form, address block, embedded Google Map                 |

**Behaviour**

- Responsive header with mobile menu, scroll state and active-page marking; shared footer with newsletter form.
- Hero carousel with cloned slides for seamless looping, tablet two-up layout, autoplay pause on focus/hover and `prefers-reduced-motion` support.
- Membership dialogs and gallery lightbox built on native `<dialog>` with focus handling and arrow-key navigation.
- Draggable, auto-advancing press strip with click suppression while dragging.
- Page-load overlay that fades out once the document is ready.
- Accessible skip link, labelled controls, `aria-current` navigation and visible focus rings.

**Backend**

- One `POST /api/inquiry` endpoint serving three distinct forms, each stored in its own MongoDB collection.
- Optional PDF/PPT/PPTX presentation upload to a private S3 bucket, verified by extension, MIME type and file signature.
- Honeypot field and per-email rate limiting, plus hard request-size caps.
- `GET /api/submissions` read API for external admin tables, protected by a bearer key.
- Database collections, JSON Schema validators and indexes created idempotently on setup and on first write.

---

## 2. Quick start

### Prerequisites

- **Node.js 22+** and npm (the scripts rely on `tsx` and `node:test`).
- **MongoDB** reachable at `127.0.0.1:27017` for local development.
- **AWS credentials** (optional) only if you want to exercise presentation uploads locally.

### Steps

```bash
npm install
cp .env.example .env       # then set MONGODB_URI and MONGODB_DB
npm run db:setup           # create collections, validators and indexes
npm run dev                # http://localhost:3012
```

Port **3012** is fixed in the npm scripts because Next.js does not read its listening port from `.env`.

For a production-style run:

```bash
npm run build
npm start                  # also port 3012
```

`npm run build` uses webpack (`next build --webpack`); `next dev` uses Turbopack with the Tailwind v4 loader configured in `next.config.ts`.

---

## 3. Environment variables

All settings are **server-side only**. Never prefix them with `NEXT_PUBLIC_`, and never commit a real `.env`.

Copy `.env.example` to `.env` and adjust the values.

| Variable                              | Required    | Default | Purpose                                                                                |
| ------------------------------------- | ----------- | ------- | -------------------------------------------------------------------------------------- |
| `MONGODB_URI`                         | Yes         | —       | Connection string; must start with `mongodb://` or `mongodb+srv://`                    |
| `MONGODB_DB`                          | Yes         | —       | Database name; letters, digits, `_` and `-` only                                       |
| `MONGODB_MAX_POOL_SIZE`               | No          | `10`    | Connection pool size (1–1000)                                                          |
| `MONGODB_SERVER_SELECTION_TIMEOUT_MS` | No          | `5000`  | Server selection timeout (1–300000)                                                    |
| `MONGODB_CONNECT_TIMEOUT_MS`          | No          | `5000`  | Connect timeout (1–300000)                                                             |
| `MONGODB_SOCKET_TIMEOUT_MS`           | No          | `15000` | Socket timeout (1–300000)                                                              |
| `MEWO_ALLOWED_ORIGINS`                | No          | empty   | Extra comma-separated browser origins allowed to POST inquiries (no trailing slash)    |
| `MEWO_SUBMISSIONS_API_KEY`            | No          | empty   | Bearer key for `GET /api/submissions`, 32–512 chars; blank disables the endpoint (503) |
| `MEWO_SUBMISSIONS_ALLOWED_ORIGINS`    | No          | empty   | Supplementary CORS allowlist for the read API (no trailing slash)                      |
| `AWS_ACCESS_KEY_ID`                   | For uploads | —       | S3 access key (`PROJECT_AWS_ACCESS_KEY` is also accepted)                              |
| `AWS_SECRET_ACCESS_KEY`               | For uploads | —       | S3 secret key (`PROJECT_AWS_SECRET_KEY` is also accepted)                              |
| `AWS_SESSION_TOKEN`                   | No          | —       | Temporary STS session token                                                            |

**Loading order:** process environment variables take precedence, followed by the applicable `.env.*` overrides and `.env` (`@next/env`). An optional `.env.local` overrides machine-specific values. Restart the dev server after editing env values.

`lib/server/env.ts` validates everything with Zod and reports only the _names_ of invalid settings — never their values. A malformed URI produces `Missing or invalid server environment variables: MONGODB_URI`.

---

## 4. Repository structure

```text
mewo/
├─ app/
│  ├─ layout.tsx                 Root layout: metadata, skip link, header, loader, footer
│  ├─ page.tsx                   Home page
│  ├─ globals.css                Tailwind import, @theme tokens, component classes, fonts
│  ├─ not-found.tsx              404 page
│  ├─ about.html/page.tsx        One directory per legacy URL
│  ├─ membership.html/page.tsx
│  ├─ gallery.html/page.tsx
│  ├─ press.html/page.tsx
│  ├─ startup.html/page.tsx
│  ├─ contact.html/page.tsx
│  └─ api/
│     ├─ inquiry/route.ts        POST — all three forms
│     └─ submissions/route.ts    GET/OPTIONS — read API
├─ components/
│  ├─ site-shell.tsx             Header, footer, newsletter form
│  ├─ interactive.tsx            Hero, membership cards, gallery, inquiry forms, press strip
│  ├─ inner-page.tsx             Shared markup for the six inner pages
│  ├─ icon.tsx                   Inline SVG icon set
│  ├─ page-loader.tsx            Load overlay
│  └─ motion.module.css          Keyframes and motion helpers
├─ lib/
│  ├─ content.json               Page copy, gallery list, press quotes, benefits
│  └─ server/
│     ├─ env.ts                  Zod-validated server configuration
│     ├─ mongo-config.ts         URI/database/pool/timeout mapping
│     ├─ mongodb.ts              Cached client + database initialisation
│     ├─ mongo-schema.ts         Collection names, validators, indexes
│     ├─ inquiry-validation.ts   Request reading, Zod form schemas, file checks
│     ├─ inquiry-storage.ts      Rate limiting, inserts, newsletter upsert
│     ├─ submissions-reader.ts   Token comparison, query parsing, paginated reads
│     ├─ migrate-submissions.ts  Legacy `submissions` → per-form collections
│     └─ s3-attachments.mjs      Private S3 upload/delete helpers
├─ scripts/
│  ├─ setup-db.ts                npm run db:setup
│  ├─ migrate-presentations.ts   GridFS → S3 copy (dry run by default)
│  └─ cleanup-legacy-gridfs.ts   Verify S3, back up and drop GridFS collections
├─ tests/                        node:test suites (unit, integration, HTTP)
├─ docs/submissions-api.md       Full read-API reference and table adapters
├─ public/                       Local images, fonts, icon webfonts
├─ next.config.ts                Legacy URL rewrites, Turbopack, cache flags
└─ .env.example                  Documented, value-free configuration template
```

---

## 5. Architecture

### 5.1 Rendering and routing

- **Server Components by default.** Pages under `app/` are async-free server components; only interactive islands (`site-shell.tsx`, `interactive.tsx`, `page-loader.tsx`) opt into `"use client"`.
- **Legacy URLs are first-class routes.** Each page lives in a directory named after its original file (`app/about.html/page.tsx`), so `/about.html` renders directly. `next.config.ts` rewrites the extensionless aliases (`/about` → `/about.html`) and `/index.html` → `/`.
- **One markup source per page type.** `components/inner-page.tsx` renders the shell for about, membership, gallery, press, startup and contact from a `page` key, and calls `notFound()` for unknown keys.
- **Copy lives in `lib/content.json`** (intro, goals, zone paragraphs, membership benefits, gallery image paths, press quotes) so text edits do not touch JSX.
- **Next config flags:** `cacheComponents`, `partialPrefetching`, a Turbopack rule that runs `@tailwindcss/turbopack` over CSS, and `experimental.agentFeedback` (this writes the Next.js agent guidance blocks in `AGENTS.md`).

### 5.2 Styling

- Tailwind CSS v4 is imported in `app/globals.css`; design tokens are declared with `@theme`:
  - `--color-brand: #21507d`, `--color-ink: #051922`
  - `--font-sans: "Poppins", sans-serif`
  - custom breakpoints `md` 48rem, `lg` 62rem, `xl` 75rem
- Reusable component classes: `.site-container` (max widths per breakpoint), `.primary-button`, `.page-heading`, `.inner-page`, `.form-field`.
- Local typography: four Poppins weights plus icon webfonts from `public/`; no external font or asset requests.
- Motion respects `prefers-reduced-motion` globally in CSS and per component in JS.

### 5.3 Server layer

```text
Request
  └─ app/api/inquiry/route.ts
       ├─ origin check ............... serverEnv().MEWO_ALLOWED_ORIGINS
       ├─ readFormData() ............. content-type + streamed size cap
       ├─ honeypot ................... 202 without touching the database
       ├─ parseInquiry() ............. Zod discriminated union on `kind`
       ├─ parsePresentation() ........ extension + MIME + magic bytes + sha256
       ├─ getDatabase() .............. cached MongoClient, schema bootstrap
       ├─ checkSubmissionRate() ...... atomic counter, TTL document
       └─ saveInquiry() .............. insert, or upsert newsletter + S3 upload
```

`getDatabase()` caches the connected `Db` on `globalThis`, keyed by the URI, database name, options and a schema version string, so development reloads and concurrent requests reuse one pool. A failed connection clears the cache and can be retried.

### 5.4 Route handlers

- `POST /api/inquiry` is the only write endpoint. It accepts `multipart/form-data` or `application/x-www-form-urlencoded`.
- `GET /api/submissions` is the only read endpoint and fails closed before opening MongoDB.
- There is no unauthenticated listing, update or file-download route.

---

## 6. Data model

Collections are created with strict JSON Schema validators (`validationLevel: "strict"`, `validationAction: "error"`, `additionalProperties: false`) and indexes. Setup is safe to repeat and never replaces existing records.

| Collection                 | Contents                                                                                                        |
| -------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `contact_submissions`      | `name`, `email`, `phone`, `subject`, `message`                                                                  |
| `startup_submissions`      | `name`, `email`, `phone`, `message`, `startupName`, `websiteUrl`, `linkedinProfileUrl`, optional `presentation` |
| `newsletter_subscriptions` | `email` only                                                                                                    |
| `submission_rate_limits`   | Hashed abuse counters with an expiring TTL index                                                                |

Every record also carries `_id`, `source`, `sourceCompany: "MeWo"`, `status`, `createdAt` and `updatedAt`. Contact and startup rows start at status `new` (workflow values `new`, `in_progress`, `resolved`); newsletter rows use `subscribed` / `unsubscribed`.

**Attachment shape** (nested, never at the top level):

```json
{
  "fileId": "ObjectId",
  "filename": "deck.pdf",
  "mimeType": "application/pdf",
  "size": 1048576,
  "sha256": "…",
  "presentationLink": "https://wonov-aws-s3-storage.s3.ap-south-1.amazonaws.com/…"
}
```

**Indexes**

| Collection                 | Index                                     |
| -------------------------- | ----------------------------------------- |
| `contact_submissions`      | `createdAt` desc; `email`                 |
| `startup_submissions`      | `createdAt` desc; `email`                 |
| `newsletter_subscriptions` | `createdAt` desc; unique `email`          |
| `submission_rate_limits`   | `expiresAt` TTL (`expireAfterSeconds: 0`) |

**Legacy migration.** `npm run db:setup` also migrates old combined `submissions` documents (with a nested `fields` object) into the three form collections. It writes a private EJSON/NDJSON backup into the Git-ignored `.reference/mongodb-backups/`, verifies every copied document, then drops the obsolete combined collection. Old per-form collections are retained for rollback.

---

## 7. HTTP API

### 7.1 `POST /api/inquiry`

The browser posts `FormData`; the framework sets the multipart boundary. Fields per `kind`:

| `kind`         | Fields                                                                                                              | Success |
| -------------- | ------------------------------------------------------------------------------------------------------------------- | ------- |
| `contact`      | `name`, `email`, `phone`, `subject`, `message`                                                                      | 201     |
| `startup`      | `name`, `email`, `phone`, `message`, `startup_name`, `website_url`, `linkedin_profile_url`, optional `presentation` | 201     |
| `subscription` | `email`                                                                                                             | 200     |

`fax_number` is a hidden honeypot; a filled value returns 202 with a success message and writes nothing.

**Validation and limits**

- Email is trimmed, lower-cased and format-checked; phone allows `+ ( ) digits space . -` with 7–15 digits; message is 1–10,000 characters; names up to 200.
- URLs must be absolute HTTP(S).
- Presentations must be PDF, PPT or PPTX, at most **10 MB**, with extension, MIME type and file signature agreeing. Scripts compute a SHA-256 checksum before upload.
- Duplicate form fields are rejected; request bodies are capped at 10 MB + 128 KB **while streaming**, so a missing `Content-Length` cannot bypass the limit.
- A fixed 15-minute window allows **5 accepted attempts per email per form**. Counters are SHA-256 hashed and expire automatically.

**Responses**

| Status    | Meaning                              |
| --------- | ------------------------------------ |
| 200 / 201 | Stored (newsletter / enquiry)        |
| 202       | Honeypot hit — accepted silently     |
| 400       | Malformed form data                  |
| 403       | Browser `Origin` not allowed         |
| 413       | Body or attachment too large         |
| 415       | Wrong content type or file signature |
| 422       | Field validation failed              |
| 429       | Rate limit — includes `Retry-After`  |
| 503       | Database or storage unavailable      |

Every response carries `Cache-Control: no-store` and `X-Request-Id`. Error logs include the request ID and error type only — never submitted values, attachment bytes or connection strings.

Successful responses mean **stored in MongoDB**. No SMTP, CRM forwarding or newsletter delivery is configured.

### 7.2 `GET /api/submissions`

Requires `Authorization: Bearer <MEWO_SUBMISSIONS_API_KEY>`. Returns flat, uniformly shaped rows across the three collections with pagination, filtering, search and sorting.

```bash
curl "http://localhost:3012/api/submissions?kind=startup&page=1&pageSize=25&sortBy=createdAt&sortOrder=desc" \
  -H "Authorization: Bearer $MEWO_SUBMISSIONS_API_KEY"
```

Query parameters: `page` (1–10000), `pageSize` (1–100), `kind`/`source` (`contact`, `startup`, `subscription`), `status`, `search` (literal, ≤100 chars), `sortBy`, `sortOrder`. Unknown, duplicate or invalid parameters return 400.

Errors: 400 invalid query, 401 missing/invalid key, 403 rejected origin, 503 unconfigured or database failure. Responses are `private, no-store`, carry `X-Request-Id` and `Vary: Origin`, and `OPTIONS` handles CORS preflight for allowlisted origins.

> Full reference — field list, pagination semantics, AG Grid and DataTables adapters, presentation links and CORS setup: **[docs/submissions-api.md](docs/submissions-api.md)**.

---

## 8. Scripts

| Command                                            | Description                                                                   |
| -------------------------------------------------- | ----------------------------------------------------------------------------- |
| `npm run dev`                                      | Next.js dev server on port 3012 (Turbopack)                                   |
| `npm run build`                                    | Production build with webpack                                                 |
| `npm start`                                        | Serve the production build on port 3012                                       |
| `npm run lint`                                     | ESLint 9 flat config (`eslint-config-next` core-web-vitals + TypeScript)      |
| `npm run db:setup`                                 | Create collections/validators/indexes and migrate legacy submissions          |
| `npm test`                                         | Unit tests: validation, env, read-API query parsing                           |
| `npm run test:integration`                         | MongoDB integration tests against an isolated throwaway database              |
| `npm run test:http`                                | HTTP smoke tests against a running server on port 3012                        |
| `npx tsx scripts/migrate-presentations.ts`         | Count startup records still needing an S3 copy                                |
| `npx tsx scripts/migrate-presentations.ts --apply` | Copy verified GridFS files to S3 and save links                               |
| `npx tsx scripts/cleanup-legacy-gridfs.ts`         | Re-verify every S3 object, back up GridFS privately, drop the old collections |

---

## 9. Testing

| File                               | Coverage                                                                             | Requirements                                                  |
| ---------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| `tests/env.test.ts`                | Defaults, overrides, rejects invalid limits/origins, error messages hide credentials | none                                                          |
| `tests/inquiry-validation.test.ts` | Form schemas, duplicate fields, size caps, file signature checks                     | none                                                          |
| `tests/submissions-reader.test.ts` | Bearer token comparison, query bounds, `kind`/`source` alias rules                   | none                                                          |
| `tests/inquiry-storage.test.ts`    | Persistence, rate limiting, newsletter uniqueness, read queries                      | MongoDB (`mewo_test_<random>` database, dropped afterwards)   |
| `tests/inquiry-http.test.ts`       | Live endpoint statuses, read-API auth/CORS/pagination, cleanup of created records    | Running server on 3012 + MongoDB + `MEWO_SUBMISSIONS_API_KEY` |

Set `TEST_S3_UPLOAD=1` when running the integration or HTTP suites to exercise real S3 uploads.

```bash
npm test
npm run test:integration
npm run dev          # in another terminal
npm run test:http
```

The HTTP suite asserts that the database URI points at `127.0.0.1`/`localhost:27017`, tags its submissions with a unique email, and removes only the records and objects it created.

---

## 10. Deployment

1. **Build and start** with `npm run build` then `npm start`, or use a host that supports a long-running Next.js server. The app needs a persistent Node process — it cannot be a static export, because the API routes use MongoDB and S3.
2. **Provide secrets through the platform** (environment or secret manager): MongoDB URI/database, `MEWO_SUBMISSIONS_API_KEY`, S3 credentials and any allowed origins. Commit only `.env.example`.
3. **Database**: use an authenticated URI scoped to this application's database, enable backups, and keep credentials server-side.
4. **HTTPS and proxies**: browser submissions must be same-origin. If a reverse proxy rewrites the server-visible origin, list the browser origins explicitly in `MEWO_ALLOWED_ORIGINS` (exact origins, no trailing slash, no paths). Configure TLS termination at the proxy.
5. **CORS for the read API**: leave `MEWO_SUBMISSIONS_ALLOWED_ORIGINS` empty unless a browser must call it. The recommended pattern is _table UI → external project's authenticated backend → this API_; CORS never replaces the bearer key.
6. **Storage**: uploads go to bucket `wonov-aws-s3-storage`, region `ap-south-1`, prefix `wono/BizNest/New MeWo Website/Attachments/`. Objects are private; the API returns the object URL for authorised consumers.
7. **Spam controls**: the per-email limiter is not an edge guarantee. Add rate limiting/WAF at the proxy or CDN for a public deployment.

---

## 11. Security and data handling

- Configuration is server-only; `lib/server/env.ts` never echoes values, and the schema rejects `NEXT_PUBLIC_`-style exposure.
- Read-API keys are compared in constant time by SHA-256 digest; a blank key disables the endpoint instead of allowing anonymous access.
- Browser origin checks apply to both endpoints; CORS is opt-in and per-endpoint.
- Uploads are validated three ways (extension, declared MIME, magic bytes), capped at 10 MB, checksummed and stored privately.
- If a startup insert fails after an upload, the object is deleted only after confirming the document does not exist — a timeout cannot leave an orphaned or a wrongly deleted file.
- Honeypot, atomic rate counters and a streaming size cap limit abuse without storing raw email hashes beyond the window.
- Logs contain request IDs and error types only; responses never include database internals.
- Backups written by migration scripts land in `.reference/mongodb-backups/` (Git-ignored, mode `0600`) and contain personal data — keep them private and purge them on your retention schedule.
- There is no unauthenticated listing or download route; a staff-facing UI must be built and authorised separately.

---

## 12. Troubleshooting

| Symptom                                              | Likely cause                                                                                        | Fix                                                                                                                             |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Forms return 503                                     | MongoDB or S3 unreachable, or credentials invalid                                                   | Check `MONGODB_URI`, network access and the server log's `X-Request-Id`; the app deliberately distinguishes outage from success |
| `Missing or invalid server environment variables: …` | Missing/blank setting, bad URI scheme, database name with `/`, origin with a path or trailing slash | Fix the named variable and restart                                                                                              |
| `GET /api/submissions` returns 503                   | `MEWO_SUBMISSIONS_API_KEY` blank                                                                    | Set a 32+ character key and restart                                                                                             |
| 401 from the read API                                | Key mismatch, missing `Bearer ` prefix, or key longer than 512 chars                                | Re-copy the key; rotate by changing `.env` and updating clients                                                                 |
| 403 on a form POST                                   | Origin not in the allowlist                                                                         | Add the exact browser origin to `MEWO_ALLOWED_ORIGINS`                                                                          |
| 413 / 415 on the startup form                        | File over 10 MB, wrong extension, or contents not matching the extension                            | Re-export as PDF/PPT/PPTX under the size limit                                                                                  |
| 429 on repeated tests                                | Per-email limit of 5 per 15 minutes                                                                 | Wait for `Retry-After` or use a different test email                                                                            |
| First request is slow                                | Cold connection pool plus schema bootstrap                                                          | Expected; subsequent requests reuse the cached client                                                                           |
| Next dev rewrites `AGENTS.md`                        | `experimental.agentFeedback` is enabled and `next dev` regenerates its guidance blocks              | Commit the file with your changes                                                                                               |

---

## Documentation

- Read-API reference and table adapters: [`docs/submissions-api.md`](docs/submissions-api.md)
- Environment template: [`.env.example`](.env.example)
- Next.js 16 notes for automated agents: [`AGENTS.md`](AGENTS.md) — this project runs a Next.js version whose APIs may differ from older conventions; consult `node_modules/next/dist/docs/` before large changes.
