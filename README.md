# AP KPI Dashboard — SAADAA Finance

Production dashboard for Accounts Payable KPIs: error rate, delayed entry, cost savings.

**Stack:** React 18 + Vite · Supabase (auth + db) · Chart.js · Vercel

---

## Setup (do in this order)

### 1. Supabase

1. Go to [supabase.com](https://supabase.com) → New project
2. Name it `saadaa-ap-kpi` · choose a strong DB password · region: Mumbai (ap-south-1)
3. Wait for project to provision (~2 min)
4. Go to **SQL Editor** → paste the entire contents of `ap-kpi-schema.sql` → Run
5. Go to **Authentication → Providers → Google** → enable it
   - You need a Google OAuth Client ID + Secret (same Google Cloud Console project as NPD Tracker, just add the new redirect URI)
6. Go to **Authentication → URL Configuration**
   - Site URL: `https://your-app.vercel.app` (fill in after Vercel deploy)
   - Redirect URLs: add `https://your-app.vercel.app/**`
7. Go to **Project Settings → API** → copy:
   - `Project URL` → this is your `VITE_SUPABASE_URL`
   - `anon public` key → this is your `VITE_SUPABASE_ANON_KEY`

### 2. Seed yourself as admin

In Supabase SQL Editor, run this **after your first login**:

```sql
insert into ap_user_roles (user_id, email, role)
select id, email, 'admin'
from auth.users
where email = 'your.email@saadaa.in'
on conflict (user_id) do update set role = 'admin';
```

### 3. GitHub

```bash
# Extract the project
tar -xzf ap-kpi-dashboard.tar.gz
cd ap-kpi-dashboard

# Copy env file
cp .env.example .env.local
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

# Init git
git init
git add .
git commit -m "init: AP KPI Dashboard"

# Push to GitHub (create repo on github.com first)
git remote add origin https://github.com/saadaa-design/ap-kpi-dashboard.git
git push -u origin main
```

### 4. Vercel

1. Go to [vercel.com](https://vercel.com) → Add New Project → Import from GitHub
2. Select `ap-kpi-dashboard` repo
3. Framework: **Vite** (auto-detected)
4. Add Environment Variables:
   - `VITE_SUPABASE_URL` = your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase anon key
5. Deploy
6. Copy the deployed URL → go back to Supabase → update Site URL and Redirect URLs

### 5. Grant team access

1. Login at your Vercel URL with your @saadaa.in Google account
2. Run the admin seed SQL above
3. Refresh → go to `/admin`
4. Add each finance team member's email with role `uploader`
5. They login → they can upload CSVs and view all dashboards

---

## CSV Files

Export these sheets from `KPI_Dashboard.xlsx` as individual CSV files:

| Sheet name | Export as | Dashboard use |
|---|---|---|
| `AP INVOICE TAT Working` | `KPI_Dashboard_-_AP_INVOICE_TAT_Working_.csv` | Delayed Entry, Invoice Log |
| `Modify` | `KPI_Dashboard_-_Modify.csv` | Error Rate |
| `Add` | `KPI_Dashboard_-_Add.csv` | True error rate (÷ vouchers created) |
| `Invoice Data` | `KPI_Dashboard_-_Invoice_Data.csv` | Invoice volume analysis |
| `Cost saved achieved` | `KPI_Dashboard_-_Cost_saved_achieved.csv` | Cost Savings page |

Upload any/all via the `/upload` page. Files are auto-detected by column headers.  
**Duplicate rows are skipped. Changed rows are updated. Safe to re-upload.**

---

## Project Structure

```
src/
├── lib/
│   ├── supabase.js       # Supabase client
│   └── upload.js         # CSV parser + batch upsert for all 5 file types
├── hooks/
│   ├── useAuth.jsx       # Google OAuth, role management, @saadaa.in guard
│   └── useChart.js       # Chart.js wrapper hook
├── components/
│   ├── AppShell.jsx      # Header + sidenav layout
│   ├── Guards.jsx        # RequireAuth / RequireUploader / RequireAdmin
│   └── UI.jsx            # Shared components (KpiCard, Card, Tag, etc.)
├── pages/
│   ├── Login.jsx         # Google sign-in page
│   ├── Overview.jsx      # Summary KPIs + 4 charts
│   ├── ErrorRate.jsx     # Modification volume by person × quarter
│   ├── DelayedEntry.jsx  # TAT analysis by person, month, PO type, vendor
│   ├── CostSavings.jsx   # AP DN savings + AR logistics deductions
│   ├── InvoiceLog.jsx    # Paginated + searchable invoice table
│   ├── Upload.jsx        # CSV uploader with progress + history log
│   └── Admin.jsx         # Role management (admin only)
└── styles/
    └── global.css        # Dark theme CSS vars + all component styles
```

---

## Roles

| Role | Can view | Can upload | Can manage users |
|---|---|---|---|
| `viewer` | ✓ | ✗ | ✗ |
| `uploader` | ✓ | ✓ | ✗ |
| `admin` | ✓ | ✓ | ✓ |

All roles require @saadaa.in Google login. Non-saadaa.in accounts are blocked at the OAuth level.

---

## Local Dev

```bash
npm install
cp .env.example .env.local   # fill in Supabase keys
npm run dev                   # http://localhost:5173
```
