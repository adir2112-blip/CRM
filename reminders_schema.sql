-- טבלת תזכורות
CREATE TABLE reminders (
  id uuid primary key default uuid_generate_v4(),
  case_id bigint references cases(id) on delete cascade,
  agent_id uuid references profiles(id) on delete cascade,
  agent_name text,
  customer_name text,
  org_name text,
  remind_at timestamptz not null,
  note text,
  is_done boolean default false,
  created_at timestamptz default now()
);

alter table reminders enable row level security;
create policy "auth_read_reminders" on reminders for select using (auth.role() = 'authenticated');
create policy "auth_insert_reminders" on reminders for insert with check (auth.role() = 'authenticated');
create policy "auth_update_reminders" on reminders for update using (auth.role() = 'authenticated');
create policy "auth_delete_reminders" on reminders for delete using (auth.role() = 'authenticated');

create index idx_reminders_agent on reminders(agent_id);
create index idx_reminders_remind_at on reminders(remind_at);
