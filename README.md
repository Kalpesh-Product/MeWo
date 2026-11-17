# MeWo website

A Next.js App Router recreation of the public MeWo website, styled with Tailwind CSS v4. Original photos, branding, amenity artwork and Poppins fonts are served locally.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3012. Production: `npm run build`, then `npm start` (also port 3012).

## Pages

Home, About, Membership, Gallery, Press, Startup Support and Contact. Original `/about.html`-style URLs and extensionless aliases are supported. Membership dialogs, the hero slideshow, responsive navigation, gallery keyboard navigation and the location map are included.

## Local MongoDB backend

Use Node.js 22+ and MongoDB running at `127.0.0.1:27017`. Local server settings live in the root `.env` file, which is ignored by Git. For a new checkout, copy `.env.example` to `.env` and adjust the values:

```dotenv
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB=mewo
MONGODB_MAX_POOL_SIZE=10
MONGODB_SERVER_SELECTION_TIMEOUT_MS=5000
MONGODB_CONNECT_TIMEOUT_MS=5000
MONGODB_SOCKET_TIMEOUT_MS=15000
MEWO_ALLOWED_ORIGINS=
```

The URI and database name are required; numeric settings have validated defaults matching the example. Configuration errors name the invalid setting without exposing its value. Next.js and the setup/test scripts use the same environment loader: process environment variables take precedence, followed by the applicable `.env.*` overrides and `.env`. An optional `.env.local` can override machine-specific settings. Restart the development server after editing environment values. In production, supply real credentials through the host's environment/secret settings; commit only `.env.example`. All database settings remain server-side. Port 3012 stays configured in the npm scripts because Next.js does not load its listening port from `.env`.

Run `npm run db:setup` to create the database collections, validation rules and indexes. Setup is safe to repeat and does not replace existing records. The application also initializes missing collections/indexes on its first submission. The connection pool is reused between requests and development reloads; failed connections can be retried.

All three existing forms submit multipart data to `POST /api/inquiry`. Their original fields and appearance are preserved. Each form has its own collection. Answers and `sourceCompany: "MeWo"` are stored at the top level; only attachment details are nested.

| Collection | Stored data |
| --- | --- |
| `contact_submissions` | Contact form answers: `name`, `email`, `phone`, `subject`, `message` |
| `startup_submissions` | Startup form answers, including `startupName`, `websiteUrl`, `linkedinProfileUrl` and optional nested `presentation` |
| `newsletter_subscriptions` | Newsletter email |
| `submission_rate_limits` | Temporary hashed abuse counters with an expiring TTL index |

Each record also stores `source`, `status`, `sourceCompany`, `createdAt`, and `updatedAt`. New enquiries have status `new` (other supported workflow values: `in_progress`, `resolved`). Newsletter emails are normalized and unique. Repeated subscriptions succeed without creating duplicate records. MongoDB JSON Schema validators provide a second validation layer.

Run `npm run db:setup` to validate and migrate old combined `submissions` records into the three form collections. The migration makes a private BSON-aware backup in ignored `.reference/mongodb-backups/`, verifies copied records, then removes the old combined collection. It is safe to rerun. Legacy GridFS files were migrated to S3, verified by checksum, privately backed up, and removed with `npx tsx scripts/cleanup-legacy-gridfs.ts`. Keep backups private because they contain submitted personal information and attachments.

The API validates required fields, lengths, email/phone formats and HTTP(S) URLs. Presentations are optional, limited to 10 MB, and checked for PDF/PPT/PPTX extension, MIME and file signature. Files are stored privately in S3 and their links are stored with the submission. A missing/mismatched file or invalid form is rejected before any submission is saved. Request bodies are bounded while reading, even when `Content-Length` is absent. A hidden honeypot and an atomic limit of five accepted attempts per email/form per 15-minute window provide basic spam protection; temporary counters expire automatically. The limit is per email, not per IP and is not a replacement for an edge-level abuse limit on a public deployment.

Browser submissions must be same-origin. For a reverse proxy that changes the server-visible origin, explicitly set `MEWO_ALLOWED_ORIGINS` to a comma-separated allowlist of browser origins. The endpoint accepts only writes; there is no unauthenticated listing or file-download API. Responses include a request ID, and error logs omit submitted personal information and connection strings. A database outage returns 503 rather than a false success. Successful responses mean **stored in MongoDB**, not an email notification: no SMTP, CRM forwarding or newsletter marketing delivery is configured.

To inspect submissions locally, connect MongoDB Compass or `mongosh` to `mongodb://127.0.0.1:27017` and open `mewo`. For example:

```javascript
use mewo
db.contact_submissions.find({}).sort({ createdAt: -1 })
db.startup_submissions.find({}).sort({ createdAt: -1 })
db.newsletter_subscriptions.find({}).sort({ createdAt: -1 })
db.contact_submissions.find({ email: "example@example.com" })
```

For deployment, set an authenticated database URI with access restricted to this app's database, keep credentials server-side, and configure backups. Do not put MongoDB credentials in `NEXT_PUBLIC_` variables. An authenticated staff interface can be added separately.

## Read API for external tables

`GET /api/submissions` provides flat table rows with pagination, source/status filters, text search and sorting. It requires `Authorization: Bearer <MEWO_SUBMISSIONS_API_KEY>`. The private key is configured in `.env`; `.env.example` documents the read API settings. Keep the key in the external project's backend and authorize its dashboard users there. No public read access is enabled. See [API documentation and table adapters](docs/submissions-api.md) for response fields, request examples, deployment access and DataTables/AG Grid mapping.

## Checks

```bash
npm run build
npm run lint
npm test
npm run test:integration
npm run test:http
```

Shared components live in `components/`; original page content is in `lib/content.json`.

`npm test` covers validation and request/upload limits without a database. Integration tests use an isolated `mewo_test_<random-id>` database and remove it afterwards. HTTP tests require the website running on port 3012 and local MongoDB; they create uniquely marked verification submissions and clean up only those records and files afterwards.
