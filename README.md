# Meetxport Website

Marketing website for **Meetxport** — connecting Indian exporters with international buyers through exclusive outreach and verified buyer leads.

Live tagline: *Connecting India to the World*

## Pages

| File            | Description                                                          |
|------------------|-----------------------------------------------------------------------|
| `index.html`     | Home — overview of both services, hero, how-it-works, why Meetxport   |
| `services.html`  | Full pricing: Exclusive Outreach (3/6/12 month plans) + Verified Buyer Leads + add-ons |
| `about.html`     | Company story, operating principles, engagement timeline              |
| `contact.html`   | Inquiry form (Exporter/Buyer toggle) + contact details                |
| `login.html`     | Exporter/Buyer login & signup UI (front-end only, no backend yet)     |

## Structure

```
meetxport/
├── index.html
├── services.html
├── about.html
├── contact.html
├── login.html
├── css/
│   └── styles.css      # shared stylesheet for all pages
├── js/
│   └── script.js        # nav toggle, tabs, form handling, scroll reveal, hero network panel
└── assets/
    └── logo.png          # Meetxport logo
```

No build step, no dependencies — pure HTML/CSS/JS. Open `index.html` directly in a browser, or serve the folder with any static host. The home page hero (India origin node, particle field, animated outreach routes, live activity cards, count-up metrics) is all CSS/SVG/vanilla JS — no external libraries.

## Deploying to Vercel

1. Push this repo to GitHub.
2. In Vercel: **Add New → Project** → import the repo → Deploy.
3. No framework preset or build command needed — this is a static site. Root Directory should be left as `.` (repo root), since `index.html` lives there.
4. Point your domain (e.g. `meetxport.com`) at the Vercel deployment via your DNS provider (Hostinger, GoDaddy, etc.).

## Known placeholders to update before going live

- Phone number in `contact.html` and the footer (`+91 XXXXX XXXXX`)
- Email address `hello@meetxport.com` if that inbox isn't set up yet
- Contact form currently saves submissions to the browser's `localStorage` (key: `meetxport_leads`) — wire it to a real backend (e.g. Supabase, like the UniEDD LMS) to actually receive leads
- `login.html` is a visual shell only — connect real authentication before enabling it publicly

## Brand

- **Colors:** Deep indigo `#180B33`, purple `#7B2FE0`, gold accent `#E7A94C`
- **Fonts:** Space Grotesk (headings), Inter (body), IBM Plex Mono (labels/eyebrows)
