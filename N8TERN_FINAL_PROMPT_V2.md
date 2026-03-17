# n8tern — AI-Powered Internship Tracker for B.Tech Students
## Master Build Prompt for Antigravity

---

## Project Overview

Build **n8tern** — a full-stack AI-powered internship and job tracker for B.Tech students.

**Core concept:** n8n Cloud automatically scrapes internship and job listings from multiple public platforms on a schedule, posts them to an Express webhook hosted on Render, Groq AI scores how well each listing matches each student's profile, Twilio sends WhatsApp alerts for high-scoring matches (>70%), and students track their applications on a drag-and-drop Kanban board hosted on Vercel.

**Tech Stack:**
- **Frontend:** React (Vite) + Tailwind CSS + React Router + @dnd-kit → **deployed on Vercel**
- **Backend:** Node.js + Express (`"type": "module"`) → **deployed on Render**
- **Database:** Supabase (PostgreSQL) → Supabase cloud
- **AI Matching:** Groq API — model `llama3-70b-8192`
- **Alerts:** Twilio WhatsApp Sandbox
- **Automation:** **n8n Cloud** — scheduled scraping pipeline calling the Render backend URL
- **Scraping:** Multi-source with graceful fallback to mock data

**Deployment architecture:**
```
n8n Cloud (scraper workflows)
        ↓ POST
Render (Express backend) ←→ Supabase (database)
        ↑ fetch('/api/...')
Vercel (React frontend)
        ↓ WhatsApp
Twilio → Student's phone
```

---

## Task Checklist

Complete tasks in this order:

- [ ] **Project Scaffolding** — root `package.json`, full folder structure, `.env.example`, `.env`
- [ ] **Supabase Setup** — client config, SQL schema file
- [ ] **Backend — Express server** (`backend/index.js`) with all middleware and routes registered
- [ ] **Backend — Student routes** (`POST /api/students`, `GET /api/students`)
- [ ] **Backend — Listing routes** (`GET /api/listings`, `POST /api/listings`)
- [ ] **Backend — Match route** (`POST /api/match`) — Groq scoring + Twilio alerts
- [ ] **Backend — Application routes** (`GET /api/applications`, `POST /api/applications`, `PUT /api/applications/:id`)
- [ ] **Backend — n8n Ingest webhook** (`POST /api/ingest-listing`)
- [ ] **Backend — Scraper** (`POST /api/scrape`, `GET /api/scrape/strategies`) — all 7 strategies
- [ ] **Backend — Cron job** — auto-scrape every 6 hours via node-cron (backup for n8n)
- [ ] **Frontend — Vite scaffold** with Tailwind CSS configured
- [ ] **Frontend — App shell** — React Router, navbar, layout
- [ ] **Frontend — Profile page** (`/profile`)
- [ ] **Frontend — Matches page** (`/matches`)
- [ ] **Frontend — Tracker page** (`/tracker`) — Kanban with drag-and-drop
- [ ] **Deployment config** — `vercel.json`, `render.yaml`, CORS for production URLs
- [ ] **`.env` file** — all keys populated (see Section 11)
- [ ] **Verification** — local `npm run dev`, then deploy to Vercel + Render

---

## 1. Project Structure

```
n8tern/
├── package.json                    ← root — concurrently dev script
├── .env.example                    ← template (commit this, values blank)
├── vercel.json                     ← Vercel deployment config for frontend
├── render.yaml                     ← Render deployment config for backend
├── .gitignore
├── backend/
│   ├── package.json                ← MUST have "type": "module"
│   ├── index.js                    ← Express entry point + cron
│   ├── config/
│   │   └── supabase.js             ← Supabase anon + admin clients
│   ├── db/
│   │   └── schema.sql              ← run once in Supabase SQL Editor
│   └── routes/
│       ├── students.js
│       ├── listings.js
│       ├── match.js
│       ├── applications.js
│       ├── ingest.js               ← n8n webhook receiver
│       └── scrape.js               ← multi-source scraper
└── frontend/
    ├── package.json
    ├── vite.config.js              ← dev proxy + prod API base URL
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── index.html
    └── src/
        ├── main.jsx
        ├── index.css
        ├── lib/
        │   └── api.js              ← axios instance with baseURL from env
        ├── App.jsx                 ← Router + layout
        └── pages/
            ├── Profile.jsx
            ├── Matches.jsx
            └── Tracker.jsx
```

---

## 2. Environment Variables

### Three `.env` files — one per environment:

**`.env.example`** — commit this to git, all values blank:
```env
# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=

# Groq AI
GROQ_API_KEY=

# Twilio WhatsApp
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886

# Server
PORT=5000

# CORS — set to Vercel production URL in production
FRONTEND_URL=http://localhost:5173

# Scraping — optional, app falls back to mock data without these
RAPIDAPI_KEY=
RAPIDAPI_HOST=linkedin-jobs-search.p.rapidapi.com
SCRAPINGBEE_API_KEY=
```

**`backend/.env`** — local development, never commit:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key
GROQ_API_KEY=your-groq-key
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
PORT=5000
FRONTEND_URL=http://localhost:5173
RAPIDAPI_KEY=
SCRAPINGBEE_API_KEY=
```

**`frontend/.env`** — only ONE variable, safe to commit if using `.env.example`:
```env
# In development: empty (Vite proxy handles /api → localhost:5000)
# In production: set to your Render backend URL
VITE_API_URL=
```

> **Why `VITE_` prefix?** Vite only exposes env vars prefixed with `VITE_` to the browser bundle. All other vars stay server-side. Never put `SUPABASE_SERVICE_KEY` or any secret in frontend `.env`.

**`.gitignore`** — add all of these:
```
backend/.env
frontend/.env
.env
node_modules/
dist/
.vercel/
```

---

## 3. Supabase Database

### File: `backend/db/schema.sql`

Run this once in **Supabase Dashboard → SQL Editor → New Query → Run**:

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Students
CREATE TABLE IF NOT EXISTS students (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  whatsapp        TEXT NOT NULL UNIQUE,
  skills          TEXT[] DEFAULT '{}',
  branch          TEXT,
  cgpa            NUMERIC(3,2),
  preferred_roles TEXT[] DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Listings
CREATE TABLE IF NOT EXISTS listings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title           TEXT NOT NULL,
  company         TEXT NOT NULL,
  url             TEXT,
  skills_required TEXT[] DEFAULT '{}',
  deadline        DATE,
  source          TEXT DEFAULT 'manual',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Applications — match_score lives HERE, not on listings
-- One row per student-listing pair. Each student gets their own score.
CREATE TABLE IF NOT EXISTS applications (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id   UUID REFERENCES students(id) ON DELETE CASCADE,
  listing_id   UUID REFERENCES listings(id) ON DELETE CASCADE,
  status       TEXT DEFAULT 'saved'
               CHECK (status IN ('saved','applied','interview','offer')),
  match_score  INTEGER DEFAULT 0,
  match_reason TEXT,
  applied_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, listing_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_listings_source      ON listings(source);
CREATE INDEX IF NOT EXISTS idx_listings_deadline    ON listings(deadline);
CREATE INDEX IF NOT EXISTS idx_applications_student ON applications(student_id);
CREATE INDEX IF NOT EXISTS idx_applications_status  ON applications(status);
```

### File: `backend/config/supabase.js`

```js
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

// Public client — respects Row Level Security
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Admin client — bypasses RLS. SERVER-SIDE ONLY. Never expose SUPABASE_SERVICE_KEY to frontend.
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);
```

---

## 4. Backend — Express Server

### `backend/package.json`

```json
{
  "name": "n8tern-backend",
  "type": "module",
  "engines": { "node": ">=18.0.0" },
  "scripts": {
    "dev": "nodemon index.js",
    "start": "node index.js"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.39.0",
    "axios": "^1.6.0",
    "cheerio": "^1.0.0-rc.12",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "express": "^4.18.2",
    "groq-sdk": "^0.3.0",
    "node-cron": "^3.0.3",
    "puppeteer": "^21.0.0",
    "twilio": "^4.20.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.2"
  }
}
```

> **`"type": "module"` is mandatory.** Without it every `import` throws. Use `import/export` everywhere, never `require()`.
> **`engines.node`** tells Render which Node version to use — keep it `>=18`.

### `backend/index.js`

```js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cron from 'node-cron';

import studentsRouter     from './routes/students.js';
import listingsRouter     from './routes/listings.js';
import matchRouter        from './routes/match.js';
import applicationsRouter from './routes/applications.js';
import ingestRouter       from './routes/ingest.js';
import scrapeRouter       from './routes/scrape.js';

const app  = express();
const PORT = process.env.PORT || 5000;

// CORS — allow both local dev and Vercel production frontend
const allowedOrigins = [
  'http://localhost:5173',
  process.env.FRONTEND_URL,           // set to https://n8tern.vercel.app in Render env
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (Render health checks, n8n, curl)
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

app.use(express.json());

app.use('/api/students',       studentsRouter);
app.use('/api/listings',       listingsRouter);
app.use('/api/match',          matchRouter);
app.use('/api/applications',   applicationsRouter);
app.use('/api/ingest-listing', ingestRouter);
app.use('/api/scrape',         scrapeRouter);

// Health check — Render pings this to confirm service is up
app.get('/health', (_, res) => res.json({ status: 'ok', env: process.env.NODE_ENV }));

// Backup cron — fires even if n8n Cloud workflow is paused
// In production on Render this cron runs on the Render instance
cron.schedule('0 */6 * * *', () => {
  const baseURL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
  console.log('[CRON] Scheduled scrape...');
  fetch(`${baseURL}/api/scrape`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ strategy: 'auto' }),
  }).catch(err => console.error('[CRON] Failed:', err.message));
});

app.listen(PORT, () => console.log(`🚀 n8tern backend → http://localhost:${PORT}`));
```

### REST API Route Table

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/students` | Create / upsert student (upsert on `whatsapp`) |
| GET | `/api/students` | List all students |
| GET | `/api/listings` | All listings — query: `?skills=React&source=unstop&min_score=50` |
| POST | `/api/listings` | Manually add a listing |
| POST | `/api/match` | Groq AI scoring — body: `{ listing_id }` or `{ listing, student_id }` |
| GET | `/api/applications` | All applications — query: `?student_id=xxx` |
| POST | `/api/applications` | Save a listing for a student |
| PUT | `/api/applications/:id` | Update Kanban status |
| POST | `/api/ingest-listing` | **n8n Cloud webhook** — saves listing + triggers match async |
| POST | `/api/scrape` | Run scraper — body: `{ strategy, keyword }` |
| GET | `/api/scrape/strategies` | Show which strategies are available |
| GET | `/health` | Render health check — always returns 200 |

---

## 5. Backend — Route Implementation Details

### students.js
- `POST /api/students` — upsert on `whatsapp` using Supabase `upsert({ onConflict: 'whatsapp' })`
- Normalise `skills` and `preferred_roles`: accept comma-separated string or array, always save as array
- Prepend `+` to `whatsapp` if missing

### listings.js
- `GET /api/listings` — filter by `skills` (overlaps), `source` (eq), order by `created_at` desc

### match.js — most important route

1. Accept `{ listing_id }` (fetch from DB) OR `{ listing }` (inline from ingest)
2. Fetch all students — or only one if `student_id` provided
3. Call Groq `llama3-70b-8192`. Prompt must demand **only JSON, no markdown**:
   ```
   Respond ONLY with valid JSON, no markdown fences, no explanation:
   {"score": <integer 0-100>, "reason": "<one sentence>"}
   ```
4. Strip markdown fences before parsing:
   ```js
   const clean = raw.replace(/```json|```/g, '').trim();
   ```
5. **Upsert into `applications`** table with `match_score` + `match_reason` — NOT into `listings`
6. If `score > 70` → send Twilio WhatsApp message
7. **Return immediately, process async** — prevents Render from timing out:
   ```js
   router.post('/', async (req, res) => {
     res.json({ success: true, message: 'Matching triggered' }); // respond first
     runMatchingInBackground(listing, students);                  // then process
   });
   ```

### ingest.js (n8n Cloud → Express)
- Accept `{ title, company, url, skills_required, deadline, source }`
- Normalise `skills_required` to array
- Insert into `listings`
- Fire `POST /api/match` with new listing — **do not await**, return `201` instantly
- n8n Cloud expects a fast response (< 10s timeout on most plans)

---

## 6. Scraping — LinkedIn Workarounds

> LinkedIn blocks all headless browsers. The app must never fail because scraping is blocked. Mock data is a permanent feature.

### All 7 strategies

#### Strategy 1 — RapidAPI LinkedIn Jobs ✅ Best for LinkedIn data
- Sign up: `https://rapidapi.com/fantastic-jobs/api/linkedin-jobs-search`
- Free tier: 100 req/month
- Headers: `X-RapidAPI-Key`, `X-RapidAPI-Host`

#### Strategy 2 — Unstop public API ✅ Best for India, no key needed
- `GET https://unstop.com/api/public/opportunity/search-result?opportunity=jobs&keyword={keyword}&page=0&per_page=20`
- Add `User-Agent: Mozilla/5.0` header
- Parse `response.data.data.data[]`

#### Strategy 3 — Internshala (cheerio scrape)
- `GET https://internshala.com/internships/keywords-{keyword}`
- Cheerio selectors: `.individual_internship`, `.profile`, `.company-name`, `.locations`

#### Strategy 4 — Naukri JSON API
- `GET https://www.naukri.com/jobapi/v3/search?noOfResults=20&urlType=search_by_keyword&searchType=adv&keyword={keyword}&k={keyword}`
- Headers: `appid: 109`, `systemid: 109`

#### Strategy 5 — Wellfound startup internships
- `GET https://wellfound.com/jobs?role=intern&locations[]=India`
- Cheerio scrape — parse job card elements

#### Strategy 6 — Puppeteer stealth (demo only)
- Args: `--no-sandbox`, `--disable-setuid-sandbox`, `--disable-blink-features=AutomationControlled`
- Target: `https://www.linkedin.com/jobs/search/?keywords={keyword}&f_JT=I&location=India`
- On Render: Puppeteer requires the `puppeteer` buildpack or use `puppeteer-core` with `--no-sandbox`
- If 0 results → fall through to mock

#### Strategy 7 — Mock data ✅ Always works

Hardcode these 20 listings (source: `'mock'`):

| Title | Company | Skills |
|-------|---------|--------|
| Frontend Intern | Razorpay | React, TypeScript, Tailwind |
| ML Intern | Google | Python, TensorFlow, Statistics |
| Backend Intern | Zepto | Node.js, PostgreSQL, Redis |
| Data Science Intern | Flipkart | Python, Pandas, SQL |
| DevOps Intern | Swiggy | Docker, Kubernetes, CI/CD |
| Full Stack Intern | CRED | React, Node.js, MongoDB |
| Android Intern | Meesho | Kotlin, Android SDK |
| UI/UX Intern | Groww | Figma, UX Research |
| iOS Intern | PhonePe | Swift, SwiftUI |
| Backend Intern | Ola | Java, Spring Boot, MySQL |
| ML Research Intern | Microsoft | PyTorch, NLP, Python |
| Cloud Intern | Amazon | AWS, Terraform, Python |
| Frontend Intern | Zomato | Vue.js, JavaScript |
| Security Intern | BrowserStack | Linux, Networking |
| API Intern | Postman | REST APIs, Node.js, OpenAPI |
| Data Analyst Intern | Juspay | SQL, Python, Tableau |
| React Native Intern | Dream11 | React Native, JavaScript |
| AI Intern | NVIDIA | CUDA, Python, Deep Learning |
| Product Intern | Notion | Figma, Analytics |
| SRE Intern | Atlassian | Linux, Prometheus, Go |

### Auto-select logic in `POST /api/scrape`

```
strategy = 'auto':
  1. RAPIDAPI_KEY set?    → try RapidAPI
  2. Always               → try Unstop (no key needed)
  3. Always               → try Internshala (cheerio)
  4. SCRAPINGBEE_KEY set? → try ScrapingBee
  5. All returned 0?      → fall back to mock

strategy = 'mock'      → mock directly
strategy = 'puppeteer' → Puppeteer, fallback to mock on 0 results
```

Merge results from all successful strategies, deduplicate by `title + company` before inserting.

### Skill extractor helper

```js
const SKILLS = ['React','Vue','Angular','Node.js','Python','Java','TypeScript',
  'JavaScript','SQL','PostgreSQL','MongoDB','Redis','Docker','Kubernetes',
  'AWS','GCP','Azure','TensorFlow','PyTorch','Pandas','Django','Flask',
  'Spring','Kotlin','Swift','Flutter','Android','iOS','GraphQL','REST APIs',
  'Git','Linux','Go','Rust','C++','Figma','Tableau','Spark','Hadoop'];

function extractSkillsFromText(text) {
  return SKILLS.filter(s => text.toLowerCase().includes(s.toLowerCase()));
}
```

---

## 7. n8n Cloud Automation

> n8n Cloud is the automation engine. It replaces writing cron scrapers — you build visual workflows that call your **Render backend URL**. No ngrok needed because Render gives you a permanent public HTTPS URL.

### n8n Cloud Setup
1. Sign up at `https://n8n.io` → free tier includes 5 active workflows
2. Your Render backend URL will be something like `https://n8tern-backend.onrender.com`
3. Use this URL in all n8n HTTP Request nodes — never `localhost`

### Workflow 1 — Scheduled Internship Scraper (build this first)

```
[Schedule Trigger]
  └─ Every 6 hours
        ↓
[HTTP Request — Unstop]
  └─ GET https://unstop.com/api/public/opportunity/search-result
       ?opportunity=jobs&keyword=software+intern&page=0&per_page=20
       Header: User-Agent: Mozilla/5.0
        ↓
[Code Node — Normalise]
  └─ const items = $input.first().json.data.data;
     return items.map(item => ({
       json: {
         title: item.title,
         company: item.organisation?.name || 'Unknown',
         url: `https://unstop.com/jobs/${item.slug}`,
         skills_required: (item.skills || []).map(s => s.name || s),
         deadline: item.end_date?.split('T')[0] || null,
         source: 'unstop'
       }
     }));
        ↓
[Split In Batches]
  └─ Batch size: 1
        ↓
[HTTP Request — POST to Render]
  └─ POST https://n8tern-backend.onrender.com/api/ingest-listing
     Content-Type: application/json
     Body: {{ $json }}
```

### Workflow 2 — Multi-source parallel scraper

```
[Schedule Trigger — every 6h]
        ↓
[Switch Node — run branches in parallel]
    ├─ Branch A: HTTP GET → Unstop API
    ├─ Branch B: HTTP POST → https://n8tern-backend.onrender.com/api/scrape
    │            Body: { "strategy": "internshala", "keyword": "software intern" }
    └─ Branch C: HTTP POST → https://n8tern-backend.onrender.com/api/scrape
                 Body: { "strategy": "naukri", "keyword": "software intern" }
        ↓
[Merge Node — merge all results]
        ↓
[Code Node — deduplicate]
  └─ const seen = new Set();
     return $input.all().filter(item => {
       const key = `${item.json.title}|${item.json.company}`;
       if (seen.has(key)) return false;
       seen.add(key); return true;
     });
        ↓
[Split In Batches — size 1]
        ↓
[HTTP Request — POST /api/ingest-listing]
  └─ https://n8tern-backend.onrender.com/api/ingest-listing
```

### Workflow 3 — Manual demo trigger

```
[Manual Trigger]
        ↓
[HTTP Request]
  └─ POST https://n8tern-backend.onrender.com/api/scrape
     Body: { "strategy": "mock", "keyword": "software intern" }
```

### Important n8n Cloud notes

- Set HTTP Request node timeout to **30 seconds** — Render free tier cold starts can take 10–15s
- Use **Basic Auth** or a secret header on `/api/ingest-listing` to prevent anyone else from posting to it:
  ```js
  // In ingest.js — verify a shared secret header
  if (req.headers['x-n8n-secret'] !== process.env.N8N_WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorised' });
  }
  ```
  Add `N8N_WEBHOOK_SECRET=your-random-string` to backend `.env` and Render env vars, and set the same header in n8n HTTP Request node.
- n8n Cloud **free tier pauses workflows after 14 days of inactivity** — log in and re-activate before the demo

---

## 8. Frontend — React (Vite + Tailwind)

### `frontend/vite.config.js`

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Dev only — in production, VITE_API_URL points to Render
      '/api': { target: 'http://localhost:5000', changeOrigin: true }
    }
  }
});
```

### `frontend/src/lib/api.js` — centralised axios instance

```js
import axios from 'axios';

// In development: VITE_API_URL is empty, so baseURL is '' (Vite proxy handles /api)
// In production on Vercel: VITE_API_URL = https://n8tern-backend.onrender.com
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  headers: { 'Content-Type': 'application/json' },
});

export default api;
```

**Every API call in every page must import from `lib/api.js`** instead of using `fetch` or a raw `axios` call. This is the only change needed to switch between local dev and Render production.

### `vercel.json` — in the `frontend/` folder

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

This tells Vercel to serve `index.html` for all routes so React Router works correctly. Without this, refreshing `/tracker` on Vercel returns a 404.

### Navbar routes
- `/profile` — Profile setup
- `/matches` — Browse and search listings
- `/tracker` — Kanban application tracker

Store `student_id` in `localStorage` after profile creation. All subsequent API calls use this ID.

### Page: `/profile`

Fields: Name, WhatsApp (+91 hint), Branch (select), CGPA, Skills (comma-separated → array), Preferred Roles (comma chips: Frontend, Backend, Full Stack, ML Engineer, Data Scientist, DevOps, Android, iOS, PM, UI/UX). On success: save `student_id` to `localStorage`.

### Page: `/matches`

- On mount: `api.get('/api/listings')`
- Filter bar: text search, min score dropdown (All / 50%+ / 70%+)
- Buttons: "🔄 Scrape Live" (`api.post('/api/scrape', { strategy: 'auto' })`), "Load Mock Data" (`strategy: 'mock'`)
- Score badge: green >70, yellow 50–70, red <50, gray unscored
- "Apply →": opens URL in new tab

### Page: `/tracker`

Kanban — 4 columns: **Saved → Applied → Interview → Offer**

- Fetch: `api.get('/api/applications', { params: { student_id } })`
- Drag with `@dnd-kit` → `api.put('/api/applications/:id', { status })`
- Fallback if time-pressed: plain HTML5 drag events work fine for demo

---

## 9. Deployment

### Backend → Render

1. Push code to GitHub (backend in `backend/` folder)
2. Go to `render.com` → New → Web Service → connect GitHub repo
3. Settings:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Node Version:** 18 (set in Environment)
4. Add all environment variables from `backend/.env` in Render's **Environment** tab — paste each key-value pair
5. Add `FRONTEND_URL=https://n8tern.vercel.app` (use your actual Vercel URL after deploying frontend)
6. Add `RENDER_EXTERNAL_URL=https://n8tern-backend.onrender.com` (Render sets this automatically — used by the backup cron)
7. Deploy — Render gives you a URL like `https://n8tern-backend.onrender.com`
8. Test: `curl https://n8tern-backend.onrender.com/health` → should return `{"status":"ok"}`

> **Render free tier cold starts:** The service sleeps after 15 min of inactivity and takes 10–15s to wake up. For the demo, hit `/health` first to wake the server before presenting. Or upgrade to Render Starter ($7/month) to avoid cold starts.

**`render.yaml`** — optional, place in repo root for infrastructure-as-code:

```yaml
services:
  - type: web
    name: n8tern-backend
    env: node
    rootDir: backend
    buildCommand: npm install
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 5000
      - key: SUPABASE_URL
        sync: false
      - key: SUPABASE_ANON_KEY
        sync: false
      - key: SUPABASE_SERVICE_KEY
        sync: false
      - key: GROQ_API_KEY
        sync: false
      - key: TWILIO_ACCOUNT_SID
        sync: false
      - key: TWILIO_AUTH_TOKEN
        sync: false
      - key: TWILIO_WHATSAPP_FROM
        value: "whatsapp:+14155238886"
      - key: RAPIDAPI_KEY
        sync: false
      - key: N8N_WEBHOOK_SECRET
        sync: false
```

`sync: false` means the value is set manually in the Render dashboard, not in the YAML file (keeps secrets out of git).

### Frontend → Vercel

1. Push code to GitHub (`frontend/` folder)
2. Go to `vercel.com` → New Project → import GitHub repo
3. Settings:
   - **Root Directory:** `frontend`
   - **Framework Preset:** Vite (auto-detected)
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. Add environment variable:
   - `VITE_API_URL` = `https://n8tern-backend.onrender.com` (your Render URL)
5. Deploy — Vercel gives you `https://n8tern.vercel.app` (or custom domain)
6. Go back to Render → update `FRONTEND_URL` env var to this Vercel URL → redeploy backend

> **Order matters:** Deploy backend to Render first → get the Render URL → use it in Vercel's `VITE_API_URL` → deploy frontend → get Vercel URL → update Render's `FRONTEND_URL`.

### n8n Cloud → Render connection

After both Render and Vercel are live:
1. Log in to n8n Cloud (`app.n8n.cloud`)
2. Update all HTTP Request nodes: replace `localhost:5000` with `https://n8tern-backend.onrender.com`
3. Add the `x-n8n-secret` header to all HTTP Request nodes that call `/api/ingest-listing`
4. Activate workflows — they will now run on schedule against the live Render backend

---

## 10. Root `package.json`

```json
{
  "name": "n8tern",
  "version": "1.0.0",
  "scripts": {
    "dev": "concurrently \"npm run backend\" \"npm run frontend\"",
    "backend": "cd backend && npm run dev",
    "frontend": "cd frontend && npm run dev",
    "install:all": "npm install && cd backend && npm install && cd ../frontend && npm install"
  },
  "devDependencies": {
    "concurrently": "^8.2.0"
  }
}
```

---

## 11. Code Quality Requirements

- `"type": "module"` in `backend/package.json` — `import/export` everywhere, never `require()`
- `async/await` with `try/catch` on every async function — log errors, never swallow silently
- Comments on all major functions explaining inputs, outputs, side effects
- `SUPABASE_SERVICE_KEY` stays in backend only — never in frontend code or Vercel env vars
- All secrets via `process.env` — zero hardcoded keys in source code
- CORS configured for both `localhost:5173` and the Vercel production URL
- If Groq fails for one student, log and `continue` — don't crash the whole batch
- If scraper returns 0 results → auto-fall back to mock, log which strategy was used
- On server startup, if `listings` table is empty → seed mock data automatically

---

## 12. ⚠️ API Keys — Request All of These Before Starting

> **Antigravity: At the end of project setup — after all files are created but before starting any server or deploying — explicitly ask the user to provide every value below. Fill them into `backend/.env` for local dev AND into Render's environment variables dashboard for production. Do not start the dev server or deploy until the user confirms all required keys are filled in.**

---

### 🔴 Required — nothing works without these

| Variable | Where to get it | Notes |
|----------|----------------|-------|
| `SUPABASE_URL` | Supabase Dashboard → Settings → API → Project URL | `https://xxxx.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API → `anon public` key | Safe for reads |
| `SUPABASE_SERVICE_KEY` | Supabase Dashboard → Settings → API → `service_role secret` key | Server-side only, never frontend |
| `GROQ_API_KEY` | `console.groq.com` → API Keys → Create | Free, no credit card |
| `TWILIO_ACCOUNT_SID` | `console.twilio.com` → Dashboard → Account Info | Starts with `AC...` |
| `TWILIO_AUTH_TOKEN` | `console.twilio.com` → Dashboard → Account Info | Keep secret |
| `N8N_WEBHOOK_SECRET` | Generate any random string (e.g. `openssl rand -hex 32`) | Shared between Render and n8n Cloud |

---

### 🟡 Required for WhatsApp alerts — extra manual step

1. Go to **Twilio Console → Messaging → Try it out → Send a WhatsApp message**
2. Note the sandbox join keyword (e.g. "join bright-lion")
3. From **every WhatsApp number that should receive alerts**, send that keyword to `+14155238886`
4. Twilio sandbox only delivers to opted-in numbers — this is a sandbox limitation, not a bug

---

### 🟢 Optional — app works without these (falls back to mock data)

| Variable | Where to get it | What it unlocks |
|----------|----------------|----------------|
| `RAPIDAPI_KEY` | `rapidapi.com` → subscribe to "LinkedIn Jobs Search" (100 free req/month) | Live LinkedIn data |
| `SCRAPINGBEE_API_KEY` | `scrapingbee.com` → sign up (1000 free credits) | JS-rendered page scraping |

---

### 🗄️ One-time database setup (Supabase)

1. Create a Supabase project at `supabase.com`
2. Open **SQL Editor → New Query**
3. Paste full contents of `backend/db/schema.sql`
4. Click **Run**
5. Confirm three tables in **Table Editor**: `students`, `listings`, `applications`

---

### ✅ Pre-launch checklist — local dev

- [ ] Supabase project created, all three keys copied
- [ ] Schema SQL executed — all 3 tables visible in Supabase
- [ ] Groq API key created at `console.groq.com`
- [ ] Twilio account created, WhatsApp sandbox activated, at least one number opted in
- [ ] All required keys filled in `backend/.env`
- [ ] `npm run install:all` run from project root
- [ ] `npm run dev` starts both servers without errors
- [ ] `http://localhost:5173` loads the app in browser

### ✅ Pre-launch checklist — production deployment

- [ ] Backend pushed to GitHub, deployed on Render, `/health` returns 200
- [ ] All env vars set in Render dashboard (including `FRONTEND_URL` and `N8N_WEBHOOK_SECRET`)
- [ ] Frontend pushed to GitHub, deployed on Vercel, `VITE_API_URL` set to Render URL
- [ ] `vercel.json` present in `frontend/` — React Router works on refresh
- [ ] Vercel URL added as `FRONTEND_URL` in Render env vars → backend redeployed
- [ ] n8n Cloud workflows updated to use Render URL, `x-n8n-secret` header set
- [ ] n8n workflows activated and manually executed once to verify
- [ ] End-to-end test: fill profile → scrape → verify listing in Supabase → verify WhatsApp message

---

## 13. n8n Cloud Verification

1. Log in to `app.n8n.cloud`
2. Create Workflow 1 from Section 7 — all URLs pointing to Render
3. Click **Execute Workflow** manually
4. Check Supabase `listings` table — new rows should appear
5. Check Render logs (Render Dashboard → Logs tab) — `[INGEST]` and `[MATCH]` lines visible
6. If workflow fails: check the n8n execution log for which node errored. Common issues:
   - Render cold start timeout → increase n8n HTTP timeout to 30s
   - CORS error → verify `FRONTEND_URL` is set correctly on Render
   - 401 Unauthorised → verify `x-n8n-secret` matches `N8N_WEBHOOK_SECRET` on Render

---

## 14. Demo Script (for hackathon judges)

1. Open live Vercel URL → `/profile` → fill in name, WhatsApp, skills like "React, Node.js, Python" → save
2. Open `/matches` → click **Load Mock Data** → 20 listings appear instantly (works even if Render is cold)
3. Click **Scrape Live** → fetches from Unstop/Internshala (falls back to mock gracefully)
4. Point out the **colour-coded match score badges** — explain Groq AI scored these in real time
5. Show a WhatsApp message on your phone — explain it fired because the match score was >70%
6. Open `/tracker` → drag a card Saved → Applied → status updates live via Render API
7. Open n8n Cloud dashboard → show the live workflow with the schedule trigger — "this runs every 6 hours automatically, zero manual effort"
8. Point to the Render dashboard — show live server logs with `[INGEST]` entries from n8n

---

*Built for hackathon. Hosted on Vercel + Render + n8n Cloud — fully live, no localhost in the demo.*
