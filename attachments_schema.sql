-- טבלת קבצים מצורפים
CREATE TABLE case_attachments (
  id uuid primary key default uuid_generate_v4(),
  case_id bigint references cases(id) on delete cascade,
  uploaded_by uuid references profiles(id),
  uploader_name text,
  file_name text not null,
  file_size bigint,
  file_type text,
  storage_path text not null,
  created_at timestamptz default now()
);

alter table case_attachments enable row level security;
create policy "auth_read_attachments" on case_attachments for select using (auth.role() = 'authenticated');
create policy "auth_insert_attachments" on case_attachments for insert with check (auth.role() = 'authenticated');
create policy "auth_delete_attachments" on case_attachments for delete using (auth.role() = 'authenticated');

-- Storage bucket for attachments
insert into storage.buckets (id, name, public) values ('case-attachments', 'case-attachments', false)
on conflict do nothing;

create policy "auth_upload" on storage.objects for insert with check (bucket_id = 'case-attachments' AND auth.role() = 'authenticated');
create policy "auth_download" on storage.objects for select using (bucket_id = 'case-attachments' AND auth.role() = 'authenticated');
create policy "auth_delete_storage" on storage.objects for delete using (bucket_id = 'case-attachments' AND auth.role() = 'authenticated');
