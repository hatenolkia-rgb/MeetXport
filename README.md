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

## Before going live

- Contact details: `admin@meetxport.com`, `+91 83196 24287`, and Greater Noida, Uttar Pradesh, India - 201310
- Contact form currently saves submissions to the browser's `localStorage` (key: `meetxport_leads`) — wire it to a real backend (e.g. Supabase, like the UniEDD LMS) to actually receive leads
- `login.html` is a visual shell only — connect real authentication before enabling it publicly

## Brand

- **Colors:** Deep indigo `#180B33`, purple `#7B2FE0`, gold accent `#E7A94C`
- **Fonts:** Space Grotesk (headings), Inter (body), IBM Plex Mono (labels/eyebrows)

## CRM (`crm.html` + `api/`)

Private CRM for the Meetxport team only (no client logins). Every lead gets a permanent serial ID (**MX-1001**, MX-1002, …) and moves through:

**New → Contacted → Follow-up → Demo / call → Payment link sent → Paid / onboarded** (or Lost)

Leads arrive automatically from:
- **Instagram / Facebook lead forms** (Meta webhook, plus a daily sync and a "Sync Instagram leads" button)
- **Instagram DMs / Messenger**: a question bot asks *Importer / Exporter / Service provider / Just starting* → years in business → city → WhatsApp number → service of interest, with tap buttons
- **Comments on posts / ads**: a public "we've sent you a message" reply plus a private DM that starts the same questions
- **WhatsApp** messages to the business number, and the **website** contact form and chat widget

On each lead the team can add notes and calls (with a next follow-up date), assign an owner, and send **WhatsApp** (welcome, community link, payment link, custom text) or **email** (welcome, payment link, custom). Everything is logged on the lead's timeline with who did it, along with WhatsApp delivered/read receipts and replies. New leads can get the WhatsApp and email welcome automatically (switches in Settings).

Roles: **Super admin** (everything, including Team, Settings and deleting records) and **Team member** (day-to-day CRM work).

### Files
| Path | What it does |
|---|---|
| `crm.html`, `js/crm.js`, `css/crm.css` | The CRM app |
| `js/supabase-config.js` | Supabase URL + anon key (public by design) |
| `supabase/crm-schema.sql` | Database, security rules, default settings |
| `api/meta-webhook.js` | Meta webhook: lead forms, DMs, comments, WhatsApp receipts and replies |
| `api/crm.js` | CRM actions: send WhatsApp/email, sync Meta leads, manage team; daily cron |
| `api/lead.js` | Website contact form / chat enquiries |
| `api/_*.js` | Shared code (not deployed as separate functions) |

### Setup

**1. Supabase**
1. Create a project at supabase.com, then **SQL Editor** → paste `supabase/crm-schema.sql` → **Run**.
2. **Authentication → Users → Add user** with your email and password (tick "Auto confirm"). Then make yourself super admin in the SQL Editor:
   `insert into crm_users(id, email, full_name, role) select id, email, 'Your Name', 'super_admin' from auth.users where email = 'you@example.com';`
3. **Authentication → Sign In / Providers**: turn off "Allow new users to sign up". **URL Configuration**: Site URL `https://meetxport.com`, and add `https://meetxport.com/crm.html` to Redirect URLs.
4. Put the Project URL and `anon` key into `js/supabase-config.js`. Later team members are added from the CRM's **Team** page.

**2. Vercel environment variables** (Project → Settings → Environment Variables)
| Name | Value |
|---|---|
| `SUPABASE_URL` | Supabase Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase `service_role` key (secret) |
| `META_APP_SECRET` | Meta app → App settings → Basic → App secret |
| `META_VERIFY_TOKEN` | Any random string; type the same one into Meta's webhook setup |
| `META_PAGE_ID` | The Meetxport Facebook Page ID |
| `META_PAGE_ACCESS_TOKEN` | Never-expiring system-user token (Business Settings → System users) with the Page and Instagram account assigned |
| `META_IG_USER_ID` | Optional: the Instagram business account ID (otherwise looked up automatically) |
| `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp Manager → phone number ID |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | WhatsApp Business Account ID (to submit templates) |
| `WHATSAPP_TOKEN` | System-user token with `whatsapp_business_messaging` and `whatsapp_business_management` (can be the same token as above) |
| `RESEND_API_KEY` | resend.com API key |
| `EMAIL_FROM` | e.g. `Meetxport <hello@meetxport.com>` |
| `EMAIL_REPLY_TO` | Optional: where replies go, e.g. `admin@meetxport.com` |
| `CRON_SECRET` | Any random string (protects the daily lead sync) |

**3. Meta app** (developers.facebook.com, a Business app owned by the Meetxport business)
- Permissions for the system-user token: `leads_retrieval`, `pages_show_list`, `pages_read_engagement`, `pages_manage_metadata`, `pages_messaging`, `pages_manage_engagement`, `instagram_basic`, `instagram_manage_messages`, `instagram_manage_comments`, `business_management`.
- **Webhooks**: callback URL `https://meetxport.com/api/meta-webhook` with your `META_VERIFY_TOKEN`. Subscribe:
  - **Page**: `leadgen`, `feed`, `messages`, `message_echoes`
  - **Instagram**: `messages`, `message_echoes`, `comments`
  - **WhatsApp Business Account**: `messages`
- Subscribe the Page to the app (`POST /{page-id}/subscribed_apps?subscribed_fields=leadgen,feed,messages,message_echoes`), and in Instagram app settings allow access to messages (Settings → Messages and story replies → Message controls → Connected tools → Allow access to messages).
- Lead forms: any questions work. For the cleanest data, use questions containing "importer / exporter", "how long … in business", "city", "phone", "email" and "services".

**4. WhatsApp templates**: in the CRM, go to **Settings → Submit WhatsApp templates to Meta**. Meta usually approves them within a few minutes to a day. Then add your community link in Settings.

**5. Email**: in Resend, add the domain `meetxport.com` and copy the DNS records it shows (SPF/DKIM) into your domain's DNS. Once it shows "Verified", emails send from `@meetxport.com`.
