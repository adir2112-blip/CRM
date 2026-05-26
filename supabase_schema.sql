-- ============================================================
-- CRM System — Supabase Schema
-- הרץ את הקובץ הזה ב: Supabase → SQL Editor → New Query
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── ORGANIZATIONS ──────────────────────────────────────────
create table organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  active boolean default true,
  created_at timestamptz default now()
);

-- ── CATEGORIES (3-level linked, per org) ───────────────────
create table cat1 (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid references organizations(id) on delete cascade,
  name text not null,
  active boolean default true,
  sort_order int default 0
);

create table cat2 (
  id uuid primary key default uuid_generate_v4(),
  cat1_id uuid references cat1(id) on delete cascade,
  name text not null,
  active boolean default true,
  sort_order int default 0
);

create table cat3 (
  id uuid primary key default uuid_generate_v4(),
  cat2_id uuid references cat2(id) on delete cascade,
  name text not null,
  active boolean default true,
  opens_dynamic boolean default false,  -- פותח שדות ספק+הטבה
  sort_order int default 0
);

-- ── SUPPLIERS & BENEFITS ───────────────────────────────────
create table suppliers (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  active boolean default true
);

create table benefits (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  active boolean default true
);

-- ── STATUSES ───────────────────────────────────────────────
create table statuses (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  color text default 'gray',  -- blue/green/amber/red/purple/teal/gray
  sort_order int default 0,
  active boolean default true
);

-- Insert default statuses
insert into statuses (name, color, sort_order) values
  ('בטיפול נציג',              'blue',   1),
  ('אין מענה',                 'amber',  2),
  ('הועבר לשיחת מנהל',         'purple', 3),
  ('בטיפול בשיחת מנהל',        'purple', 4),
  ('טופל לאחר שיחת מנהל',      'teal',   5),
  ('טופל',                     'green',  6);

-- ── USER PROFILES (extends Supabase auth.users) ────────────
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null default 'agent' check (role in ('admin','agent')),
  active boolean default true,
  created_at timestamptz default now()
);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'agent')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ── CASES ──────────────────────────────────────────────────
create table cases (
  id          bigserial primary key,
  -- customer info
  customer_name text not null,
  phone         text not null,
  id_number     text not null,
  -- classification
  org_id        uuid references organizations(id),
  org_name      text,                              -- snapshot
  status_id     uuid references statuses(id),
  status_name   text,                              -- snapshot
  subject       text not null,
  content       text not null,
  cat1_id       uuid references cat1(id),
  cat1_name     text,
  cat2_id       uuid references cat2(id),
  cat2_name     text,
  cat3_id       uuid references cat3(id),
  cat3_name     text,
  -- dynamic fields
  supplier_id   uuid references suppliers(id),
  supplier_name text,
  benefit_id    uuid references benefits(id),
  benefit_name  text,
  -- agent
  agent_id      uuid references profiles(id),
  agent_name    text,
  last_editor_id   uuid references profiles(id),
  last_editor_name text,
  -- timestamps
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger cases_updated_at
  before update on cases
  for each row execute procedure update_updated_at();

-- ── CASE LOGS (manual documentation) ──────────────────────
create table case_logs (
  id         uuid primary key default uuid_generate_v4(),
  case_id    bigint references cases(id) on delete cascade,
  author_id  uuid references profiles(id),
  author_name text,
  content    text not null,
  created_at timestamptz default now()
);

-- ── ROW LEVEL SECURITY ─────────────────────────────────────
alter table organizations  enable row level security;
alter table cat1           enable row level security;
alter table cat2           enable row level security;
alter table cat3           enable row level security;
alter table suppliers      enable row level security;
alter table benefits       enable row level security;
alter table statuses       enable row level security;
alter table profiles       enable row level security;
alter table cases          enable row level security;
alter table case_logs      enable row level security;

-- All authenticated users can read reference tables
create policy "read_orgs"       on organizations  for select using (auth.role() = 'authenticated');
create policy "read_cat1"       on cat1           for select using (auth.role() = 'authenticated');
create policy "read_cat2"       on cat2           for select using (auth.role() = 'authenticated');
create policy "read_cat3"       on cat3           for select using (auth.role() = 'authenticated');
create policy "read_suppliers"  on suppliers      for select using (auth.role() = 'authenticated');
create policy "read_benefits"   on benefits       for select using (auth.role() = 'authenticated');
create policy "read_statuses"   on statuses       for select using (auth.role() = 'authenticated');
create policy "read_profiles"   on profiles       for select using (auth.role() = 'authenticated');

-- Admin-only write on reference tables
create policy "admin_write_orgs"      on organizations for all using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
create policy "admin_write_cat1"      on cat1          for all using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
create policy "admin_write_cat2"      on cat2          for all using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
create policy "admin_write_cat3"      on cat3          for all using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
create policy "admin_write_suppliers" on suppliers     for all using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
create policy "admin_write_benefits"  on benefits      for all using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
create policy "admin_write_statuses"  on statuses      for all using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
create policy "admin_write_profiles"  on profiles      for all using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- Cases: all authenticated can read+write
create policy "auth_read_cases"   on cases for select using (auth.role() = 'authenticated');
create policy "auth_insert_cases" on cases for insert with check (auth.role() = 'authenticated');
create policy "auth_update_cases" on cases for update using (auth.role() = 'authenticated');

-- Logs: all authenticated
create policy "auth_read_logs"   on case_logs for select using (auth.role() = 'authenticated');
create policy "auth_insert_logs" on case_logs for insert with check (auth.role() = 'authenticated');

-- ── INDEXES ────────────────────────────────────────────────
create index idx_cases_agent     on cases(agent_id);
create index idx_cases_status    on cases(status_name);
create index idx_cases_org       on cases(org_name);
create index idx_cases_created   on cases(created_at desc);
create index idx_cases_updated   on cases(updated_at desc);
create index idx_case_logs_case  on case_logs(case_id);
