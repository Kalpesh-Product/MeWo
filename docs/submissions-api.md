# Submissions read API

`GET http://localhost:3012/api/submissions`

Reads all three form sources from `mewo.submissions`. No database credentials are shared. No create, update, delete or attachment-download operations are exposed here.

## Authentication and deployment

Send `Authorization: Bearer <MEWO_SUBMISSIONS_API_KEY>` on every GET. A random read key is configured in the ignored root `.env`. Copy it securely into the **backend environment** of each authorized external project. Do not put it in a URL, a `NEXT_PUBLIC_` variable, or frontend JavaScript. This key grants access to all submissions; distribute it only to trusted projects. Change the value in `.env` to rotate access, then restart the server and update authorized clients. A blank key disables the endpoint (503); missing/invalid credentials return 401.

`localhost` refers to the computer making the request. For a project on another machine or hosting service, use this application's reachable server address; use HTTPS in production. This change does not publish your local server to the internet.

The recommended integration is **table UI → external project's authenticated backend → this API**. That backend must enforce its own user authorization. Browser requests from another origin are blocked by default. If a browser integration is needed, `MEWO_SUBMISSIONS_ALLOWED_ORIGINS` is a separate comma-separated allowlist of exact HTTP(S) origins with no trailing slashes. CORS never replaces the bearer key. Keep the permanent key on the backend even when configuring CORS.

## Parameters

| Parameter | Default | Accepted values |
| --- | --- | --- |
| `page` | `1` | Integer, 1–10000 |
| `pageSize` | `25` | Integer, 1–100 |
| `source` | All | `contact`, `startup`, `subscription` |
| `status` | All | `new`, `in_progress`, `resolved`, `subscribed`, `unsubscribed` |
| `search` | Empty | Literal, case-insensitive text, up to 100 characters; searches form text fields |
| `sortBy` | `createdAt` | `createdAt`, `updatedAt`, `source`, `status`, `name`, `email`, `phone`, `subject`, `startupName` |
| `sortOrder` | `desc` | `asc`, `desc` |

Unknown parameters, duplicate parameters and invalid values return 400. Sorting uses the document ID as a stable tie-breaker. Responses are uncached. Counts and rows are separate database reads, so they can change as new submissions arrive.

Example: `/api/submissions?source=startup&page=1&pageSize=25&sortBy=createdAt&sortOrder=desc`

## Response

```json
{
  "data": [
    {
      "id": "507f1f77bcf86cd799439011",
      "source": "contact",
      "status": "new",
      "name": "Example Name",
      "email": "example@example.com",
      "phone": "+91 80071 26444",
      "subject": "Office enquiry",
      "message": "Please contact me.",
      "startupName": null,
      "websiteUrl": null,
      "linkedinProfileUrl": null,
      "presentation": null,
      "createdAt": "2026-11-03T10:00:00.000Z",
      "updatedAt": "2026-11-03T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 25,
    "total": 1,
    "filteredTotal": 1,
    "totalPages": 1,
    "hasNextPage": false
  }
}
```

All rows have the same keys. Missing source-specific fields are `null`. IDs are strings; dates are UTC ISO strings. A presentation contains `{ "id", "filename", "mimeType", "size" }`, with size in bytes. File contents and private storage checksums are excluded. `total` counts all submissions; `filteredTotal` counts rows matching the current filters. An empty result has `data: []` and `totalPages: 0`.

## Fetch from another project's backend

```javascript
const url = new URL('/api/submissions', process.env.MEWO_API_BASE_URL);
url.search = new URLSearchParams({
  source: 'startup', page: '1', pageSize: '25', sortBy: 'createdAt', sortOrder: 'desc'
}).toString();

const response = await fetch(url, {
  headers: { Authorization: `Bearer ${process.env.MEWO_SUBMISSIONS_API_KEY}` },
  cache: 'no-store',
  signal: AbortSignal.timeout(15000)
});
if (!response.ok) throw new Error(`Submissions API returned ${response.status}`);
const { data, pagination } = await response.json();
// Return only what the current authenticated dashboard user may access.
```

Set the external backend's `MEWO_API_BASE_URL` to `http://localhost:3012` locally, or the deployed application's HTTPS origin. Paginate through results using `hasNextPage` when you need every record; there is no unbounded response option.

## Table adapters

This is a library-independent API; it does not directly implement DataTables' or AG Grid's request protocol. Map their requests through your backend adapter:

- **AG Grid:** row fields use `field: 'name'`, `field: 'email'`, etc. Map `startRow`/`endRow` to `page`/`pageSize` with matching page boundaries. Return `{ rowData: result.data, rowCount: result.pagination.filteredTotal }` to your grid datasource. Map allowed sort fields to `sortBy`/`sortOrder`.
- **DataTables:** map `start`/`length` to `page`/`pageSize`, `search.value` to `search`, and the requested allowed column to `sortBy`. Return `{ draw: Number(request.draw), recordsTotal: result.pagination.total, recordsFiltered: result.pagination.filteredTotal, data: result.data }`. Use a fixed column-name allowlist when translating sort requests; do not forward arbitrary database paths. Disable the “all rows” length option because the API caps pages at 100.

Render submitted text as plain text in table cells, including names, notes and filenames. Do not insert form values as HTML. Only create clickable website links after checking the URL uses HTTP(S).

Errors return `{ "message": "..." }`: 400 invalid query, 401 invalid credentials, 403 rejected browser origin, 503 configuration/database failure. GET responses include `X-Request-Id` for tracing and `Cache-Control: private, no-store`.
