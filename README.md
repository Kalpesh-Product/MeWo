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

## Form delivery

Contact, startup support and newsletter forms POST to `/api/inquiry`. Set `MEWO_INQUIRY_ENDPOINT` in `.env.local` to your trusted HTTPS form delivery service. The server forwards multipart form data, including startup presentation attachments, and reports success only after the service accepts the submission. Without an endpoint, the forms clearly explain that online submissions are unavailable and show the existing email/phone contact details. The original website's PHP handlers are not part of this project.

Presentations are limited to 10 MB. Before public launch, configure your form service's spam protection and delivery rules. Do not place service secrets in `NEXT_PUBLIC_` environment variables.

## Checks

```bash
npm run build
npm run lint
```

Shared components live in `components/`; original page content is in `lib/content.json`.
