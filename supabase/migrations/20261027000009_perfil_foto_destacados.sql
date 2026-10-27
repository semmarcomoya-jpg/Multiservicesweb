-- =====================================================================
-- Castillo Multiservices · Foto de perfil y Destacados
--   * profiles.foto_url: el cliente sube su foto (bucket público "avatars", carpeta {user_id}/).
--   * featured: lo que el administrador elige para "Destacados" en Inicio.
--   * top_sellers(): lo que más se vende (sugerencias y relleno automático).
-- =====================================================================

alter table public.profiles add column if not exists foto_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists avatars_read on storage.objects;
create policy avatars_read on storage.objects for select using (bucket_id = 'avatars');
drop policy if exists avatars_write on storage.objects;
create policy avatars_write on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists avatars_delete on storage.objects;
create policy avatars_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- Destacados
create table if not exists public.featured (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null check (kind in ('product', 'service')),
  ref_id     uuid not null,
  orden      int not null default 0,
  created_at timestamptz not null default now(),
  unique (kind, ref_id)
);
alter table public.featured enable row level security;
drop policy if exists featured_read on public.featured;
create policy featured_read on public.featured for select using (true);
drop policy if exists featured_admin on public.featured;
create policy featured_admin on public.featured for all using (public.is_admin()) with check (public.is_admin());
grant select on public.featured to anon, authenticated;
grant insert, update, delete on public.featured to authenticated;

-- 'auto' = la app muestra lo más vendido; 'manual' = solo lo que eligió el administrador
alter table public.settings add column if not exists destacados_modo text not null default 'auto'
  check (destacados_modo in ('auto', 'manual'));

-- Lo más vendido de los últimos días (sin pedidos rechazados). Cualquiera puede consultarlo:
-- solo regresa conteos, nunca datos de clientes.
create or replace function public.top_sellers(p_days int default 30, p_limit int default 8)
returns table (kind text, ref_id uuid, veces bigint, total numeric)
language sql stable security definer set search_path = public as $$
  with o as (
    select * from public.orders
     where status <> 'rechazado' and created_at > now() - make_interval(days => greatest(1, least(p_days, 365)))
  ),
  svc as (
    select 'service'::text kind, o.service_id ref_id, count(*) veces, sum(o.total) total
      from o join public.services s on s.id = o.service_id and s.activo
     where o.kind = 'service' and o.service_id is not null
     group by o.service_id
  ),
  prod as (
    select 'product'::text kind, (it->>'product_id')::uuid ref_id, sum(coalesce((it->>'qty')::int, 1)) veces,
           sum(coalesce((it->>'qty')::int, 1) * coalesce((it->>'price')::numeric, 0)) total
      from o, jsonb_array_elements(coalesce(o.items, '[]'::jsonb)) it
     where o.kind = 'shop' and it ? 'product_id'
     group by 2
  )
  select x.kind, x.ref_id, x.veces, x.total from (
    select * from svc
    union all
    select p.* from prod p join public.products pr on pr.id = p.ref_id and pr.activo
  ) x
  order by x.veces desc, x.total desc
  limit greatest(1, least(p_limit, 30));
$$;
grant execute on function public.top_sellers(int, int) to anon, authenticated;
