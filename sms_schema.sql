-- טבלת תבניות SMS
CREATE TABLE sms_templates (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid references organizations(id) on delete cascade,
  org_name text,
  name text not null,
  content text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table sms_templates enable row level security;
create policy "auth_read_sms" on sms_templates for select using (auth.role() = 'authenticated');
create policy "admin_write_sms" on sms_templates for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

create index idx_sms_org on sms_templates(org_id);
