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

-- 2026-11-18: várias conversas por usuário (lista de conversas salvas)
alter table mensagens add column if not exists conversa text not null default 'antiga';
create index if not exists mensagens_conversa on mensagens (user_id, conversa, id);

-- 2026-11-19: catálogo de produtos (foto salva uma vez, usada como base nas imagens)
create table if not exists produtos (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  nome text not null,
  foto text not null,
  criado_em timestamptz not null default now()
);
alter table produtos enable row level security;
create policy "ver meus produtos" on produtos for select using (auth.uid() = user_id);
create policy "criar meus produtos" on produtos for insert with check (auth.uid() = user_id);
create policy "apagar meus produtos" on produtos for delete using (auth.uid() = user_id);
