# SAADAA AP KPI Dashboard — Context Reference

Internal engineering reference for AI coding assistants and onboarding developers. Covers every file, route, schema table, data flow, and design decision in the codebase.

---

## 1. Project Overview

An internal analytics dashboard for the **Accounts Payable (AP)** team at SAADAA. It visualises invoice submission timeliness (TAT), voucher modification volume, vendor cost savings, and a full searchable invoice log — all fed by CSV exports from the Busy accounting software.

Data is uploaded manually via a drag-and-drop interface. All storage and authentication is handled by **Supabase (PostgreSQL + Auth)**. The frontend is a Vite + React SPA deployed on **Vercel**.

| | |
|---|---|
| Repository root | `d:\KPI-Dashboard` |
| Purpose | Internal finance analytics — not customer-facing |
| Users | SAADAA finance team with `@saadaa.in` email addresses |
| Data entry | Manual CSV upload from Busy accounting software exports |
| Access control | Supabase RLS enforced server-side. Client-side guards are intentionally open (see §13). |

---

## 2. Tech Stack

| Layer | Library | Version | Role |
|---|---|---|---|
| UI framework | React | 18.3.1 | Components, context, hooks |
| Build tool | Vite | 5.2.11 | Dev server, HMR, production bundle |
| Routing | React Router DOM | 6.23.1 | Client-side routes, nested layouts, NavLink |
| Charts | Chart.js | 4.4.3 | Bar, line, doughnut charts via canvas |
| CSV parsing | PapaParse | 5.4.1 | Browser-side CSV → JS objects |
| Backend / DB | Supabase | 2.43.4 | PostgreSQL, Auth, Row Level Security |
| Deployment | Vercel | — | Static SPA hosting; env vars in dashboard |
| Type system | None (plain JSX) | — | No TypeScript; no PropTypes |
| Testing | None | — | No test suite |

---

## 3. File Structure

```
KPI-Dashboard/
├── src/
│   ├── components/
│   │   ├── AppShell.jsx     — sticky header, sidenav, quarter selector, <Outlet />
│   │   ├── Guards.jsx       — RequireAuth (real), RequireUploader/Admin (pass-through)
│   │   └── UI.jsx           — all shared UI primitives (20+ components)
│   ├── hooks/
│   │   ├── useAuth.jsx      — AuthContext, Supabase session management
│   │   └── useChart.js      — Chart.js wrapper hook + person colour map
│   ├── lib/
│   │   ├── supabase.js      — Supabase client singleton
│   │   └── upload.js        — CSV detection, transform, batch upsert (~270 lines)
│   ├── pages/
│   │   ├── Login.jsx        — email/password auth form
│   │   ├── Overview.jsx     — KPI cards + 4 charts (bar, doughnut, bar, line)
│   │   ├── ErrorRate.jsx    — voucher modification volume by person
│   │   ├── DelayedEntry.jsx — invoice TAT analysis (person, month, PO type, vendor)
│   │   ├── CostSavings.jsx  — AP DN savings + AR logistics deductions
│   │   ├── InvoiceLog.jsx   — server-paginated, searchable invoice table
│   │   ├── Upload.jsx       — drag-and-drop uploader for all 5 CSV types
│   │   └── Admin.jsx        — user role management (read/grant/change/remove)
│   ├── styles/
│   │   └── global.css       — all CSS; CSS custom properties (light theme)
│   ├── App.jsx              — BrowserRouter + route tree
│   └── main.jsx             — React 18 createRoot entry
├── ap-kpi-schema.sql        — full Supabase schema (run once to set up DB)
├── context.md               — this file
├── index.html               — Vite HTML entry, Inter + JetBrains Mono preload
├── vite.config.js           — minimal: @vitejs/plugin-react only
├── vercel.json              — SPA rewrite: "/*" → "/index.html"
└── .env.example             — VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
```

---

## 4. Routing & Authentication

### Route Tree

```
/login           → Login.jsx                          (public)
/                → RequireAuth
  /              → AppShell (layout — header + sidenav + Outlet)
    /            → Overview.jsx                       (index)
    /error-rate  → ErrorRate.jsx
    /delayed-entry → DelayedEntry.jsx
    /cost-savings  → CostSavings.jsx
    /invoices      → InvoiceLog.jsx
    /upload        → RequireUploader → Upload.jsx
    /admin         → RequireAdmin    → Admin.jsx
    /*             → redirect to /
```

### Auth Flow

`AuthProvider` (in `useAuth.jsx`) wraps the whole app. On mount it calls `supabase.auth.getSession()` and subscribes to `onAuthStateChange`. The `user` object and a `loading` boolean are exposed via context.

`RequireAuth` shows a full-screen spinner while loading, then redirects to `/login` if there is no session. Login uses Supabase email/password only (`signInWithPassword`). Sign-up is available at the same form by toggling mode.

### Guards

> **Important:** `RequireUploader` and `RequireAdmin` are intentional pass-throughs — they render their children unconditionally. All authenticated users can access every page. Security is enforced server-side by Supabase RLS policies, not the client guards.

```js
RequireAuth      // real guard: redirects to /login if no session
RequireUploader  // pass-through (returns children immediately)
RequireAdmin     // pass-through (returns children immediately)
```

---

## 5. Database Schema

All tables live in Supabase (PostgreSQL). Row Level Security is enabled on every table. The schema is in `ap-kpi-schema.sql` — run it once in the Supabase SQL editor to set up a fresh project.

### Tables

| Table | Source CSV | Conflict Key (upsert) | Key Columns |
|---|---|---|---|
| `ap_invoice_tat` | AP Invoice TAT Working | invoice_no, vendor_code, submitted_at | submitted_at, quarter, month_label, added_by, remark (On Time/Delay), tat, actual_tat, po_type, association |
| `ap_voucher_modify` | Modify Log | vch_no, account, modified_at, modified_by | vch_no, modified_by, quarter, month_label, series, type, org_amt, final_amt, amt_changed (generated bool) |
| `ap_voucher_add` | Add Log | vch_no, account, entry_date | vch_no, added_by, quarter, month_label, series, type, debit, credit |
| `ap_invoice_data` | Invoice Data | invoice_no, vendor_code, submitted_at | invoice_no, vendor_code, po_no, po_type, invoice_date, amount, email |
| `ap_cost_saved` | Cost Saved Achieved | month_label, category, sub_category_key, vendor_key *(generated cols)* | month_label, month_date, category, sub_category, vendor, invoice_amt, credit_note_amt, saving_amt, saving_pct |
| `ap_upload_log` | written automatically on upload | — | uploaded_by, email, file_name, table_name, rows_inserted, status, error_msg, uploaded_at |
| `ap_user_roles` | managed via Admin page | email (unique), user_id (unique) | id (PK), user_id (FK → auth.users), email, role (viewer/uploader/admin) |

### Row Level Security

| Operation | Allowed when |
|---|---|
| SELECT on all data tables | Any authenticated user with `@saadaa.in` email (`is_saadaa_user()` helper) |
| INSERT / UPDATE on data tables | Role is `uploader` or `admin` (`get_my_role()` helper) |
| ALL on `ap_user_roles` | Role is `admin` only |

### SQL Helper Functions

```sql
get_my_role()            → text      -- returns 'viewer' (default) / 'uploader' / 'admin'
is_saadaa_user()         → boolean   -- true if auth.users.email ends with @saadaa.in
get_user_id_by_email()   → table(id uuid)  -- used by Admin.jsx to pre-fill user_id
```

### Views (exist in schema but not queried by the app)

| View | Purpose |
|---|---|
| `v_error_rate_by_person` | Joins Add + Modify to compute true error rate % per person per quarter |
| `v_delay_by_person` | On-time vs delay counts + average TAT per person/month |
| `v_modify_by_person` | Modification volume grouped by person, quarter, series |
| `v_cost_savings_summary` | Monthly AP/AR savings totals + overall saving % |

> The dashboard queries raw tables directly; aggregation is done client-side in JavaScript.

### Migration (existing databases)

If the database was created before the schema was updated, run in the Supabase SQL editor:

```sql
-- Add missing unique constraint (required for Admin.jsx grantRole)
ALTER TABLE ap_user_roles ADD CONSTRAINT ap_user_roles_email_unique UNIQUE (email);

-- Add missing RPC (called by Admin.jsx to resolve user_id from email)
CREATE OR REPLACE FUNCTION get_user_id_by_email(email_input text)
RETURNS TABLE(id uuid) LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT id FROM auth.users WHERE email = email_input LIMIT 1;
$$;
```

---

## 6. Pages

Every page inside `AppShell` reads the active quarter from `QtrContext` via `useQtr()` and filters data accordingly. Most pages fetch all data once on mount (client-side filtering). `InvoiceLog` is the exception — it paginates server-side.

| Route | Page | Data Source | Notes |
|---|---|---|---|
| `/` | Overview | `ap_voucher_modify`, `ap_invoice_tat` | 4 KPI cards + 4 charts: mods by person (bar), on-time vs delayed (doughnut), mods by quarter (bar), monthly delay rate (line) |
| `/error-rate` | ErrorRate | `ap_voucher_modify`, `ap_voucher_add` | Modification volume by person. Shows true error rate only when Add CSV is uploaded. Quarter × person table. |
| `/delayed-entry` | DelayedEntry | `ap_invoice_tat` (full select) | TAT by person, monthly trend, by PO type, by vendor association. Person summary table with avg TAT. |
| `/cost-savings` | CostSavings | `ap_cost_saved` | Category filter (All/AP/AR). No quarter field — not affected by quarter selector. |
| `/invoices` | InvoiceLog | `ap_invoice_tat` with `.range()` + `.count()` | Server-paginated (100 rows/page). Filters: quarter, remark, free-text search. |
| `/upload` | Upload | writes to all 5 tables + `ap_upload_log` | 5 drag-and-drop zones, auto file detection, live row progress, upload history. |
| `/admin` | Admin | `ap_user_roles`, RPC `get_user_id_by_email` | Grant/change/remove roles. Uses `id` (PK), not `user_id`, to avoid null-key collisions. |
| `/login` | Login | Supabase Auth | Email + password. Toggles sign-in / sign-up. Redirects to `/` on session. |

---

## 7. Components

### AppShell.jsx

Renders sticky header, sidebar nav, and `<Outlet />`. Owns the **quarter selector state** and provides it via `QtrContext` to all child pages. On mount, fetches distinct `quarter` values from both `ap_voucher_modify` and `ap_invoice_tat` (up to 1 000 rows each) to build the selector buttons.

**Exports:** `default AppShell`, `QtrContext`, `useQtr()` hook.

```js
// Quarter label format used throughout the app
q.replace(/(\d{4})Q(\d)/, (_, yr, qn) => `Q${qn}'${yr.slice(-2)}`)
// e.g. "2024Q1" → "Q1'24"
```

### UI.jsx — Primitive component library

| Component | Props | Notes |
|---|---|---|
| `KpiCard` | label, value, sub, color | Accent stripe + colour glow. colors: blue/red/green/amber/purple/teal |
| `Card` | title, titleRight, style, children | Standard surface container with optional header row |
| `Tag` | children, color | Pill label. Same color set as KpiCard |
| `StatusTag` | value | Specialised Tag: "Delay" → red, "On Time" → green |
| `RateTag` | rate | Auto-colors: >30% red, >10% amber, else green |
| `ProgressBar` | name, value, max, color | Auto-colors from % if color not specified |
| `NoteBox` | children | Amber warning box with ⚠ prefix |
| `InfoBox` | children | Accent info box with ℹ prefix |
| `EmptyState` | icon, title, sub | Centred placeholder when data is empty |
| `Spinner` | — | 20px animated border spinner |
| `FilterRow` | label, options, active, onChange | Row of pill toggle buttons |

### Guards.jsx

```js
RequireAuth({ children })
  // Shows Spinner while loading; redirects to /login if !user; else renders children

RequireUploader({ children }) → children   // pass-through — intentional
RequireAdmin({ children })    → children   // pass-through — intentional
```

---

## 8. Hooks

### useAuth.jsx

Provides `AuthContext` with: `user`, `loading`, `isUploader: true`, `isAdmin: true`, `signInWithEmail`, `signUpWithEmail`, `signOut`.

> `isUploader` and `isAdmin` are hardcoded `true` for all authenticated users. Role enforcement is fully handled by Supabase RLS. The client flags exist only for UI conditionals.

### useChart.js

Thin wrapper around Chart.js. Accepts a canvas `ref`, a config object, and a deps array. Destroys and recreates the chart whenever deps change.

```js
useChart(canvasRef, config, deps)

// config shape:
{
  type: 'bar' | 'line' | 'doughnut',
  labels: string[],
  datasets: ChartDataset[],
  options: {
    legend: boolean,    // show legend (default false)
    pct: boolean,       // y-axis ticks show "%" suffix
    stacked: boolean,
    extra: object,      // merged into Chart.js options root
    xScale: object,     // merged into scales.x
    yScale: object,     // merged into scales.y
    plugins: object,    // merged into plugins
  }
}
```

Person colour map: `pc(name)` returns a hex colour from `PERSON_COLORS` (Hanuman, Anju, Komal, Mukesh Gupta, SID, Zaid). Unknown names fall back to `#6b7280`.

---

## 9. Utilities

### lib/supabase.js

Creates and exports a single Supabase client. Reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from `import.meta.env`. **Throws at module evaluation** if either is missing. Options: `autoRefreshToken: true`, `persistSession: true`, `detectSessionInUrl: true`.

### lib/upload.js — exports

```js
detectFileType(headers: string[]) → fileType | null
uploadCSV(file: File, onProgress: ({processed, total}) => void) → Promise<{fileType, table, total}>
```

---

## 10. CSV Upload Pipeline

### File Detection (header sniffing)

| fileType | Detection rule (case-insensitive) | DB Table |
|---|---|---|
| `tat` | any header contains `"your association with saadaa"` | `ap_invoice_tat` |
| `modify` | has `action` header AND any header contains `"org.vch"` | `ap_voucher_modify` |
| `add` | has `action` AND `name` AND no `"org.vch"` header | `ap_voucher_add` |
| `invoice_data` | has `"invoice number"` AND `"po type"` AND no `"association"` | `ap_invoice_data` |
| `cost_saved` | any header contains `"saving_amt"` or `"saving amt"` | `ap_cost_saved` |

### Pipeline Steps

```
1. PapaParse.parse(file, {header: true, skipEmptyLines: true})
2. detectFileType(headers)          — throws if unrecognised
3. rows.map(cfg.fn)                 — transform raw CSV row → DB row shape
4. filter(r => r.row_hash)          — drop rows with no hash (parse failures)
5. In-file dedup by conflict key    — prevents "ON CONFLICT row affected twice" error
6. Batch upsert in chunks of 2000 rows
   supabase.from(table).upsert(batch, {onConflict, ignoreDuplicates})
7. Log result to ap_upload_log (success or error)
```

### Upsert Strategy per File Type

| fileType | onConflict columns | ignoreDuplicates | Effect |
|---|---|---|---|
| `tat` | invoice_no, vendor_code, submitted_at | false | Updates changed rows |
| `modify` | vch_no, account, modified_at, modified_by | false | Updates changed rows |
| `add` | vch_no, account, entry_date | false | Updates changed rows |
| `invoice_data` | invoice_no, vendor_code, submitted_at | false | Updates changed rows |
| `cost_saved` | month_label, category, sub_category_key, vendor_key | **true** | Skips duplicates |

> `sub_category_key` and `vendor_key` are PostgreSQL **generated columns** (`ALWAYS AS coalesce(col, '')`). Using `DO NOTHING` avoids the error that occurs when Supabase tries to `SET` generated columns during an update.

### Transform Helpers (lib/upload.js)

```js
parseDate(s)    → Date | null
toDateStr(s)    → "YYYY-MM-DD" | null
toTsStr(s)      → ISO timestamp | null
toNum(s)        → number | null  (strips commas)
quarterLabel(d) → "2024Q1" format
monthLabel(d)   → "Jan 2024" (en-IN locale)
rowHash(obj)    → string (djb2 hash of JSON.stringify)
```

---

## 11. Styling System

All styles live in `src/styles/global.css`. No CSS modules, no Tailwind. Component classes are BEM-flavoured (e.g., `.kpi`, `.kpi-value`, `.kpi.blue`). Currently uses a **light theme** via CSS custom properties.

### Key CSS Variables

| Variable | Value | Role |
|---|---|---|
| `--bg` | `#f4f6fb` | Page background |
| `--surface` | `#ffffff` | Cards, header, sidenav |
| `--surface2` | `#f0f2f8` | Input backgrounds, table headers, hover |
| `--surface3` | `#e8eaf3` | Deeper hover, progress track |
| `--border` | `#e2e5f0` | Primary border |
| `--text` | `#111827` | Primary text |
| `--text2` | `#4a5278` | Secondary text |
| `--muted` | `#8891ae` | Labels, captions, placeholders |
| `--accent` | `#4b7cf3` | Primary interactive colour |
| `--red/green/amber/purple/teal` | dark accessible shades | Semantic status colours |

### Layout Utilities

```css
.grid-2   /* 1fr 1fr */
.grid-3   /* 1fr 1fr 1fr */
.grid-65  /* 1.75fr 1fr — wide-left two-col */
.kpi-row  /* repeat(4, 1fr) — collapses to 2col at 1024px */
.mb       /* margin-bottom: 14px */
```

### Fonts

- **Inter** — body, UI labels, buttons (loaded from Google Fonts)
- **JetBrains Mono** — numbers in KPI cards, table data, quarter buttons

### Chart.js Theme (useChart.js)

```js
Chart.defaults.color = '#8891ae'       // axis labels
GRID = { color: 'rgba(226,229,240,0.9)' }
TT (tooltip) = {
  backgroundColor: '#ffffff',
  titleColor: '#111827',
  bodyColor: '#4a5278',
  borderColor: '#e2e5f0',
}
```

---

## 12. Deployment

| | |
|---|---|
| Platform | Vercel (static SPA) |
| Build command | `npm run build` → Vite outputs to `dist/` |
| SPA routing | `vercel.json`: `"rewrites": [{"source":"/(.*)", "destination":"/index.html"}]` |
| Required env vars | `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` — set in Vercel dashboard |
| Supabase region | India (ap-south-1) |
| Bundle size | ~654 kB JS (gzip 200 kB) — mainly Chart.js. No code splitting configured. |

> After changing the Vercel domain, update allowed redirect URLs in Supabase → Authentication → URL Configuration → Redirect URLs.

---

## 13. Design Decisions & Known Patterns

| Decision | Rationale |
|---|---|
| **Client guards are pass-throughs** | All finance team members need full access. Supabase RLS is the real security gate. The role flags (`isUploader`, `isAdmin`) exist for future UI conditionals only. |
| **All data fetched once on mount** | Quarter filtering is done in JavaScript after a single full fetch. Avoids repeated round-trips when the user switches quarters. Exception: InvoiceLog (server-paginated). |
| **Admin uses row `id` not `user_id`** | `user_id` is nullable for pre-provisioned email-only users. The UUID primary key `id` is always safe and unique. |
| **cost_saved uses `ignoreDuplicates: true`** | The unique constraint spans generated columns (`sub_category_key`, `vendor_key`). PostgreSQL generated columns cannot appear in `ON CONFLICT DO UPDATE SET`, so `DO NOTHING` is the only safe upsert strategy. |
| **Quarter labels use function replacement** | String-literal replacement like `'Q$2\'$1'.slice(-3)` is evaluated at JS parse time, not replace time — producing wrong output. All quarter formatting now uses: `(_, yr, qn) => \`Q${qn}'${yr.slice(-2)}\`` |
| **No TypeScript** | Project was bootstrapped as plain JSX. No migration planned; no PropTypes either. |
| **Views exist but aren't queried** | Supabase views were created for potential direct SQL use. The React app queries raw tables and aggregates in JS for chart rendering flexibility. |
| **Batch size: 2 000 rows** | Stays under Supabase's per-request body size limit. The Add Log CSV can exceed 140 000 rows — upload takes 8–10 minutes. Keep the tab open. |
| **Light theme** | Originally dark; converted to light. All colours are CSS custom properties — no hardcoded dark colours remain in CSS. Chart theme also updated in `useChart.js`. |
