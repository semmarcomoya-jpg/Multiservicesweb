-- =====================================================================
-- 20. Avisos con la app cerrada (Web Push)
-- Cada equipo que prende los avisos guarda aquí su suscripción.
-- La función send-push (Edge Function) los manda cuando se crea un aviso
-- en public.notifications (se conecta con un Database Webhook).
-- =====================================================================
create table if not exists public.push_subs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade default auth.uid(),
  endpoint   text not null unique check (endpoint ~ '^https://'),
  p256dh     text not null,
  auth       text not null,
  agent      text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists push_subs_user_idx on public.push_subs (user_id);
alter table public.push_subs enable row level security;

-- Cada quien ve, agrega y borra solo sus equipos
drop policy if exists push_subs_own on public.push_subs;
create policy push_subs_own on public.push_subs for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on public.push_subs from anon;
grant select, insert, update, delete on public.push_subs to authenticated;
