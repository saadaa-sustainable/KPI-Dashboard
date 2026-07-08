-- ============================================================
-- AP KPI DASHBOARD — SUPABASE SCHEMA
-- Run this in Supabase SQL Editor (new project)
-- ============================================================

-- ── Extensions ──────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ============================================================
-- 1. UPLOAD LOG
-- Tracks every CSV upload — who, when, what, how many rows
-- ============================================================
create table if not exists ap_upload_log (
  id            uuid primary key default gen_random_uuid(),
  uploaded_by   uuid references auth.users(id),
  email         text,
  file_name     text not null,
  table_name    text not null,
  rows_inserted integer default 0,
  rows_updated  integer default 0,
  rows_skipped  integer default 0,
  status        text default 'success', -- success | error
  error_msg     text,
  uploaded_at   timestamptz default now()
);

-- ============================================================
-- 2. VOUCHER ADD LOG (from Add CSV)
-- One row per unique voucher created in Busy
-- ============================================================
create table if not exists ap_voucher_add (
  id            uuid primary key default gen_random_uuid(),
  vch_no        text not null,
  vch_date      date,
  entry_date    timestamptz,           -- "Date & Time" col
  quarter       text,                  -- computed: 2025Q4
  month_label   text,                  -- computed: Dec 2025
  type          text,                  -- Sale / Purc / Jrnl etc.
  series        text,                  -- MYNTRA / MAIN / MFG etc.
  account       text,
  debit         numeric,
  credit        numeric,
  narration     text,
  added_by      text,
  computer_name text,
  row_hash      text,                  -- md5 of all fields for change detection
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  -- unique per voucher + account line (multiple lines per vch)
  unique (vch_no, account, entry_date)
);

create index if not exists idx_voucher_add_vch_no    on ap_voucher_add(vch_no);
create index if not exists idx_voucher_add_added_by  on ap_voucher_add(added_by);
create index if not exists idx_voucher_add_quarter   on ap_voucher_add(quarter);
create index if not exists idx_voucher_add_series    on ap_voucher_add(series);

-- ============================================================
-- 3. VOUCHER MODIFY LOG (from Modify CSV)
-- One row per voucher modification event
-- ============================================================
create table if not exists ap_voucher_modify (
  id            uuid primary key default gen_random_uuid(),
  vch_no        text not null,
  vch_date      date,
  modified_at   timestamptz,
  quarter       text,
  month_label   text,
  modified_by   text,
  type          text,
  series        text,
  account       text,
  org_amt       numeric,
  final_amt     numeric,
  amt_changed   boolean generated always as (
                  org_amt is not null
                  and final_amt is not null
                  and org_amt <> final_amt
                ) stored,
  computer_name text,
  row_hash      text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  unique (vch_no, account, modified_at, modified_by)
);

create index if not exists idx_voucher_modify_vch_no      on ap_voucher_modify(vch_no);
create index if not exists idx_voucher_modify_modified_by on ap_voucher_modify(modified_by);
create index if not exists idx_voucher_modify_quarter     on ap_voucher_modify(quarter);
create index if not exists idx_voucher_modify_series      on ap_voucher_modify(series);

-- ============================================================
-- 4. AP INVOICE TAT (from AP Invoice TAT Working CSV)
-- One row per invoice submission via vendor Google Form
-- ============================================================
create table if not exists ap_invoice_tat (
  id            uuid primary key default gen_random_uuid(),
  submitted_at  date,                  -- Timestamp col
  month_label   text,
  quarter       text,
  email         text,
  association   text,                  -- Fabrication / Trims / Fabric etc.
  po_no         text,
  vendor_code   text,
  po_type       text,                  -- FOB / E-FOB / CMTP / Job
  doc_type      text,                  -- INVOICE / DEBIT NOTE / CREDIT NOTE
  invoice_no    text,
  invoice_date  date,
  add_in_busy   date,
  if_modify     text,
  tat           numeric,               -- days (can be negative = early)
  actual_tat    numeric,
  added_by      text,
  modify_by     text,
  remark        text,                  -- On Time / Delay
  row_hash      text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  unique (invoice_no, vendor_code, submitted_at)
);

create index if not exists idx_tat_submitted_at  on ap_invoice_tat(submitted_at);
create index if not exists idx_tat_vendor_code   on ap_invoice_tat(vendor_code);
create index if not exists idx_tat_added_by      on ap_invoice_tat(added_by);
create index if not exists idx_tat_remark        on ap_invoice_tat(remark);
create index if not exists idx_tat_month_label   on ap_invoice_tat(month_label);

-- ============================================================
-- 5. INVOICE DATA (from Invoice Data CSV)
-- Full vendor invoice submission log
-- ============================================================
create table if not exists ap_invoice_data (
  id            uuid primary key default gen_random_uuid(),
  submitted_at  timestamptz,
  month_label   text,
  quarter       text,
  email         text,
  association   text,
  invoice_no    text,
  vendor_code   text,
  po_no         text,
  po_type       text,
  doc_type      text,
  invoice_date  date,
  amount        numeric,
  row_hash      text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  unique (invoice_no, vendor_code, submitted_at)
);

create index if not exists idx_invoice_data_vendor   on ap_invoice_data(vendor_code);
create index if not exists idx_invoice_data_month    on ap_invoice_data(month_label);
create index if not exists idx_invoice_data_po_type  on ap_invoice_data(po_type);

-- ============================================================
-- 6. COST SAVED (from Cost saved achieved CSV)
-- AP (DN savings) + AR (logistics deductions) per month
-- ============================================================
create table if not exists ap_cost_saved (
  id              uuid primary key default gen_random_uuid(),
  month_label     text not null,
  month_date      date,
  category        text not null,
  sub_category    text,
  vendor          text,
  invoice_amt     numeric default 0,
  credit_note_amt numeric default 0,
  saving_amt      numeric default 0,
  saving_pct      numeric,
  row_hash        text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  sub_category_key text generated always as (coalesce(sub_category, '')) stored,
  vendor_key       text generated always as (coalesce(vendor, '')) stored,
  unique (month_label, category, sub_category_key, vendor_key)
);

create index if not exists idx_cost_saved_month    on ap_cost_saved(month_label);
create index if not exists idx_cost_saved_category on ap_cost_saved(category);

-- ============================================================
-- VIEWS — pre-aggregated for dashboard queries
-- ============================================================

-- Error rate by person (requires both Add + Modify tables)
create or replace view v_error_rate_by_person as
select
  a.added_by                                          as person,
  a.quarter,
  a.month_label,
  count(distinct a.vch_no)                            as total_added,
  count(distinct m.vch_no)                            as total_modified,
  round(
    count(distinct m.vch_no)::numeric
    / nullif(count(distinct a.vch_no), 0) * 100, 2
  )                                                   as error_rate_pct
from (
  select distinct vch_no, added_by, quarter, month_label from ap_voucher_add
) a
left join (
  select distinct vch_no from ap_voucher_modify
) m on a.vch_no = m.vch_no
group by a.added_by, a.quarter, a.month_label;

-- Delay summary by person
create or replace view v_delay_by_person as
select
  added_by                                            as person,
  month_label,
  quarter,
  count(*)                                            as total_invoices,
  count(*) filter (where remark = 'On Time')          as on_time,
  count(*) filter (where remark = 'Delay')            as delayed,
  round(
    count(*) filter (where remark = 'Delay')::numeric
    / nullif(count(*), 0) * 100, 2
  )                                                   as delay_rate_pct,
  round(avg(tat) filter (where remark = 'Delay'), 1) as avg_delay_tat
from ap_invoice_tat
group by added_by, month_label, quarter;

-- Modification volume by person + quarter
create or replace view v_modify_by_person as
select
  modified_by                                         as person,
  quarter,
  month_label,
  series,
  count(distinct vch_no)                              as unique_vouchers_modified,
  count(*)                                            as total_modify_events,
  count(*) filter (where amt_changed = true)          as amt_changes
from ap_voucher_modify
group by modified_by, quarter, month_label, series;

-- Cost savings summary
create or replace view v_cost_savings_summary as
select
  month_label,
  month_date,
  category,
  sum(invoice_amt)      as total_invoice_amt,
  sum(credit_note_amt)  as total_credit_amt,
  sum(saving_amt)       as total_saving_amt,
  round(
    sum(saving_amt) / nullif(sum(invoice_amt), 0) * 100, 2
  )                     as overall_saving_pct
from ap_cost_saved
group by month_label, month_date, category;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table ap_upload_log     enable row level security;
alter table ap_voucher_add    enable row level security;
alter table ap_voucher_modify enable row level security;
alter table ap_invoice_tat    enable row level security;
alter table ap_invoice_data   enable row level security;
alter table ap_cost_saved     enable row level security;

-- ── User roles table ─────────────────────────────────────────
create table if not exists ap_user_roles (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade,
  email      text not null,
  role       text not null default 'viewer', -- viewer | uploader | admin
  created_at timestamptz default now(),
  unique(user_id),
  unique(email)
);

alter table ap_user_roles enable row level security;

-- Helper function: get current user role
create or replace function get_my_role()
returns text language sql security definer stable as $$
  select coalesce(
    (select role from ap_user_roles where user_id = auth.uid()),
    'viewer'
  );
$$;

-- Helper function: look up a user's auth.users id by email (admin-only use)
create or replace function get_user_id_by_email(email_input text)
returns table(id uuid) language sql security definer stable as $$
  select id from auth.users where email = email_input limit 1;
$$;

-- Helper function: is @saadaa.in email
create or replace function is_saadaa_user()
returns boolean language sql security definer stable as $$
  select coalesce(
    (select email like '%@saadaa.in' from auth.users where id = auth.uid()),
    false
  );
$$;

-- ── RLS Policies ─────────────────────────────────────────────

-- READ: any authenticated @saadaa.in user
create policy "saadaa users can read" on ap_voucher_add
  for select using (is_saadaa_user());
create policy "saadaa users can read" on ap_voucher_modify
  for select using (is_saadaa_user());
create policy "saadaa users can read" on ap_invoice_tat
  for select using (is_saadaa_user());
create policy "saadaa users can read" on ap_invoice_data
  for select using (is_saadaa_user());
create policy "saadaa users can read" on ap_cost_saved
  for select using (is_saadaa_user());
create policy "saadaa users can read" on ap_upload_log
  for select using (is_saadaa_user());
create policy "saadaa users can read own role" on ap_user_roles
  for select using (is_saadaa_user());

-- WRITE: only uploaders and admins
create policy "uploaders can insert" on ap_voucher_add
  for insert with check (get_my_role() in ('uploader','admin'));
create policy "uploaders can update" on ap_voucher_add
  for update using (get_my_role() in ('uploader','admin'));

create policy "uploaders can insert" on ap_voucher_modify
  for insert with check (get_my_role() in ('uploader','admin'));
create policy "uploaders can update" on ap_voucher_modify
  for update using (get_my_role() in ('uploader','admin'));

create policy "uploaders can insert" on ap_invoice_tat
  for insert with check (get_my_role() in ('uploader','admin'));
create policy "uploaders can update" on ap_invoice_tat
  for update using (get_my_role() in ('uploader','admin'));

create policy "uploaders can insert" on ap_invoice_data
  for insert with check (get_my_role() in ('uploader','admin'));
create policy "uploaders can update" on ap_invoice_data
  for update using (get_my_role() in ('uploader','admin'));

create policy "uploaders can insert" on ap_cost_saved
  for insert with check (get_my_role() in ('uploader','admin'));
create policy "uploaders can update" on ap_cost_saved
  for update using (get_my_role() in ('uploader','admin'));

create policy "uploaders can insert log" on ap_upload_log
  for insert with check (get_my_role() in ('uploader','admin'));

-- ADMIN: role management
create policy "admin can manage roles" on ap_user_roles
  for all using (get_my_role() = 'admin');

-- ============================================================
-- SEED: make yourself admin
-- Replace with your actual email after first login
-- ============================================================
-- insert into ap_user_roles (user_id, email, role)
-- select id, email, 'admin'
-- from auth.users
-- where email = 'your.email@saadaa.in'
-- on conflict (user_id) do update set role = 'admin';

-- ============================================================
-- MIGRATION: run on existing databases to add missing constraints
-- ============================================================
-- alter table ap_user_roles add constraint ap_user_roles_email_unique unique (email);
-- alter table ap_invoice_data add column if not exists association text;
-- create or replace function get_user_id_by_email(email_input text)
-- returns table(id uuid) language sql security definer stable as $$
--   select id from auth.users where email = email_input limit 1;
-- $$;
