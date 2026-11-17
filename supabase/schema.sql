create table if not exists mensagens (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  role text not null check (role in ('user','model')),
  texto text not null,
  criado_em timestamptz not null default now()
);
alter table mensagens enable row level security;
create policy "ver as minhas" on mensagens for select using (auth.uid() = user_id);
create policy "criar as minhas" on mensagens for insert with check (auth.uid() = user_id);
create policy "apagar as minhas" on mensagens for delete using (auth.uid() = user_id);
