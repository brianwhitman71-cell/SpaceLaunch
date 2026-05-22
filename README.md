# 🚀 Space Launch

A live tracker for **every rocket launch in the United States** — featuring
**Florida's Space Coast** (Cape Canaveral & Kennedy Space Center) as the home
base, with its own page for **Vandenberg**, **SpaceX Starbase**, **Wallops**
and every other U.S. spaceport. Plus live mission tracking, the International
Space Station, space news, and launch reminders.

Built as a fast static site (cosmic / nebula theme) with an optional Netlify
backend for email & text reminders.

---

## What's inside

| Section | What it does |
|---|---|
| **Mission Control** | Live countdown to the next Space Coast launch + an at-a-glance dashboard, including a "Launching Across America" panel |
| **Calendar** | Month grid of every scheduled U.S. launch (Space Coast highlighted; toggle to Space Coast only) — click any launch for full details |
| **Launch Sites** | A directory of every U.S. spaceport: the Space Coast featured up top, plus its own sub-page for Vandenberg, Starbase, Wallops, Pacific Spaceport and an all-U.S. list — each with launch list and viewing tips |
| **Live** | Active-operations panel + a real-time map of the ISS orbiting Earth + recent results |
| **Stations** | The ISS and Tiangong — specs, facts, operational status, and live orbital position |
| **Space News** | A live feed of spaceflight & astronomy news and discoveries |
| **Reminders** | Add launches to your calendar, get browser alerts, or sign up for email/SMS reminders |

## Data sources (all free, no API keys needed for the site itself)

- **Launches** — [The Space Devs · Launch Library 2](https://thespacedevs.com/llapi)
- **Space news** — [Spaceflight News API](https://spaceflightnewsapi.net/)
- **ISS position** — [WhereTheISS.at](https://wheretheiss.at/w/developer)
- **Weather** — [Open-Meteo](https://open-meteo.com/) (Cape Canaveral, for the ticker)
- **Map tiles** — OpenStreetMap / CARTO · **Map library** — Leaflet

Launch responses are cached in the browser (`localStorage`) for 30 minutes to
stay well under the public API rate limits.

---

## Run it locally

It's a plain static site — just open `index.html`, or serve the folder:

```bash
cd ~/Claude/Projects/SpaceLaunch
python3 -m http.server 8080      # then visit http://localhost:8080
```

To also run the reminder backend locally (calendar + browser alerts work
without it):

```bash
npm install
netlify dev
```

## Deploy to Netlify

```bash
npm install
netlify deploy --prod --dir=.
```

`netlify.toml` already points `functions` at `netlify/functions`.

---

## Turning on email & text reminders (optional)

The site works fully without this — **Add to Calendar** and **Browser
Notifications** need no backend at all. Email/SMS need two free-ish accounts
and a few environment variables in Netlify (**Site settings → Environment
variables**).

### Email — via [Resend](https://resend.com)

| Variable | Value |
|---|---|
| `RESEND_API_KEY` | Your Resend API key |
| `RESEND_FROM` | e.g. `Space Launch <launches@yourdomain.com>` (or use Resend's test sender) |

Resend's free tier covers 3,000 emails/month.

### Text messages — via [Twilio](https://twilio.com)

| Variable | Value |
|---|---|
| `TWILIO_ACCOUNT_SID` | Your Twilio Account SID |
| `TWILIO_AUTH_TOKEN` | Your Twilio Auth Token |
| `TWILIO_FROM` | Your Twilio phone number, e.g. `+13215550100` |

Twilio charges ~$1–2/month for a phone number plus ~$0.01 per text.

Once the variables are set, the `send-reminders` scheduled function runs every
15 minutes, checks upcoming launches against subscribers (stored in Netlify
Blobs), and sends each reminder once. If a channel's variables aren't set, that
channel is simply skipped — nothing breaks.

---

## Project structure

```
SpaceLaunch/
├── index.html              # all sections / single-page app
├── css/styles.css          # cosmic-nebula theme
├── js/
│   ├── config.js           # API endpoints + curated station data
│   ├── util.js             # shared helpers (fetch+cache, dates, countdown)
│   ├── launches.js         # U.S. launch data, calendar, site directory & pages, modal
│   ├── live.js             # live ops panel + ISS map + recent results
│   ├── stations.js         # space-station cards + live position
│   ├── news.js             # space-news feed
│   ├── reminders.js        # .ics export, browser alerts, email/SMS form
│   ├── ticker.js           # top live ticker — launches, news, CCAFS weather
│   └── app.js              # starfield, routing, countdown ticker, boot
├── netlify/functions/
│   ├── subscribe.mjs       # stores a reminder subscription
│   └── send-reminders.mjs  # scheduled — sends the reminders
├── netlify.toml
└── package.json
```

---

🛰️ *Best free public launch viewing near Orlando: Titusville, Playalinda Beach
(Canaveral National Seashore), Jetty Park, and Max Brewer Bridge. Clear skies!*
