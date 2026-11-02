-- =====================================================================
-- 19. Costo y mínimo de cada producto (solo personal) y cumpleaños en Clientes
-- =====================================================================

-- ---------- Costo y existencia mínima por variante
-- Va en su propia tabla para que el cliente NUNCA pueda leer el costo
-- (product_variants la puede leer cualquiera).
create table if not exists public.product_costs (
  variant_id uuid primary key references public.product_variants(id) on delete cascade,
  costo      numeric(10,2) not null default 0 check (costo >= 0),
  minimo     int not null default 0 check (minimo >= 0),
  updated_at timestamptz not null default now()
);
alter table public.product_costs enable row level security;

drop policy if exists product_costs_staff on public.product_costs;
create policy product_costs_staff on public.product_costs for all
  using (exists (select 1 from public.product_variants v join public.products p on p.id = v.product_id
                 where v.id = variant_id and public.is_store_staff(p.store_id)))
  with check (exists (select 1 from public.product_variants v join public.products p on p.id = v.product_id
                      where v.id = variant_id and public.is_store_staff(p.store_id)));

revoke all on public.product_costs from anon;
grant select, insert, update, delete on public.product_costs to authenticated;

create or replace function public.touch_product_costs() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
drop trigger if exists product_costs_touch on public.product_costs;
create trigger product_costs_touch before update on public.product_costs for each row execute function public.touch_product_costs();

do $$
begin
  if to_regprocedure('public.audit_row()') is not null then
    drop trigger if exists audit_product_costs on public.product_costs;
    create trigger audit_product_costs after insert or update or delete on public.product_costs for each row execute function public.audit_row();
  end if;
end $$;

-- ---------- Clientes de la tienda: ahora con el día de cumpleaños (solo mes-día, sin año)
drop function if exists public.store_customers(uuid);
create function public.store_customers(p_store uuid)
returns table (user_id uuid, nombre text, member_code text, telefono text, foto_url text, id_status text, favorita boolean,
               pedidos bigint, gastado numeric, ultimo timestamptz, puntos int, planes bigint, credito_on boolean, credito_limite numeric,
               cumple text)
language sql stable security definer set search_path = public as $$
  with c as (
    select p.* from public.profiles p
    where p.role = 'cliente' and (p.store_id = p_store or exists (select 1 from public.orders o where o.user_id = p.id and o.store_id = p_store))
  )
  select c.id, trim(c.nombre || ' ' || c.apellidos), c.member_code, c.telefono, c.foto_url, c.id_status, c.store_id = p_store,
         (select count(*) from public.orders o where o.user_id = c.id and o.store_id = p_store and o.status = 'completado'),
         (select coalesce(sum(o.total), 0) from public.orders o where o.user_id = c.id and o.store_id = p_store and o.status = 'completado'),
         (select max(o.created_at) from public.orders o where o.user_id = c.id and o.store_id = p_store),
         public.points_balance(c.id, p_store),
         (select count(*) from public.plans pl where pl.user_id = c.id and pl.store_id = p_store and pl.status = 'activo'),
         coalesce((select cl."on" from public.credit_lines cl where cl.user_id = c.id and cl.store_id = p_store), false),
         coalesce((select cl.limite from public.credit_lines cl where cl.user_id = c.id and cl.store_id = p_store), 0),
         to_char(c.fecha_nac, 'MM-DD')
  from c
  where public.is_store_staff(p_store)
  order by 10 desc nulls last
  limit 2000
$$;
revoke all on function public.store_customers(uuid) from public, anon;
grant execute on function public.store_customers(uuid) to authenticated;
