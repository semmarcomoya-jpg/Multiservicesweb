-- =====================================================================
-- Castillo Multiservices · Personal en varias tiendas, corte por forma de pago,
-- venta con carrito en mostrador, horario por día y candados de seguridad
--   * Una cuenta de tienda y un empleado pueden atender varias sucursales
--   * Admin: asignar rol y sucursales a una cuenta en un solo paso
--   * Clave de empleado: 5 intentos fallidos = espera de 10 minutos
--   * Corte: lo esperado por Zelle / efectivo / tarjeta, lo contado y gastos de caja
--   * Mostrador: una venta con varios artículos y descuento
--   * Sucursal: horario por día; la cuenta de tienda ya no cambia "activa" ni "orden"
-- Córrelo una vez en Supabase → SQL Editor.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Varias sucursales por cuenta y por empleado
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists store_ids uuid[] not null default '{}';
alter table public.employees add column if not exists store_ids uuid[] not null default '{}';
update public.profiles set store_ids = array[store_id] where role = 'tienda' and store_id is not null and store_ids = '{}';
update public.employees set store_ids = array[store_id] where store_id is not null and store_ids = '{}';

create or replace function public.is_store_staff(p_store uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and (role = 'admin' or (role = 'tienda' and (store_id = p_store or p_store = any(store_ids))))
  )
$$;

create or replace function public.notify_staff(p_store uuid, p_kind text, p_title text, p_body text, p_link text, p_ref uuid)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, kind, title, body, link, ref_id)
  select pr.id, p_kind, left(p_title, 140), left(coalesce(p_body, ''), 300), coalesce(p_link, ''), p_ref
  from public.profiles pr
  where pr.role = 'admin' or (pr.role = 'tienda' and p_store is not null and (pr.store_id = p_store or p_store = any(pr.store_ids)))
$$;
revoke all on function public.notify_staff(uuid, text, text, text, text, uuid) from public, anon, authenticated;

create or replace function public.protect_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() and coalesce(current_setting('castillo.bypass', true), '') <> '1' then
    new.role := old.role;
    new.member_code := old.member_code;
    new.id_status := old.id_status;
    new.store_ids := old.store_ids;
    if old.role = 'tienda' then new.store_id := old.store_id; end if;
  end if;
  return new;
end $$;

-- La bitácora también registra cuando cambian las sucursales de una cuenta
create or replace function public.audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  o jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else '{}'::jsonb end;
  n jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else '{}'::jsonb end;
  r jsonb := case when tg_op = 'DELETE' then o else n end;
  diff jsonb := '{}'::jsonb;
  k text;
  pr public.profiles;
  v_store uuid;
  v_title text;
begin
  select * into pr from public.profiles where id = auth.uid();
  -- Lo que provoca un cliente al comprar (stock, vistas de historias) no es un cambio de configuración
  if auth.uid() is not null and coalesce(pr.role, 'cliente') = 'cliente' and tg_table_name <> 'profiles' then
    return null;
  end if;

  if tg_op = 'UPDATE' then
    for k in select jsonb_object_keys(n) loop
      if k in ('updated_at', 'views', 'rate_updated_at', 'pin_hash') then continue; end if;
      if (o -> k) is distinct from (n -> k) then
        diff := diff || jsonb_build_object(k, jsonb_build_array(o -> k, n -> k));
      end if;
    end loop;
    if (o -> 'pin_hash') is distinct from (n -> 'pin_hash') then diff := diff || '{"clave": ["****", "nueva"]}'::jsonb; end if;
    if diff = '{}'::jsonb then return null; end if;
    -- En perfiles solo interesa lo que cambia el acceso o la identificación
    if tg_table_name = 'profiles' and not (diff ?| array['role', 'store_id', 'store_ids', 'id_status']) then return null; end if;
  elsif tg_op = 'INSERT' then
    diff := n - 'pin_hash';
  else
    diff := o - 'pin_hash';
  end if;

  v_store := case
    when tg_table_name = 'stores' then nullif(r ->> 'id', '')::uuid
    when tg_table_name = 'product_variants' then (select p.store_id from public.products p where p.id = (r ->> 'product_id')::uuid)
    else nullif(r ->> 'store_id', '')::uuid
  end;
  v_title := coalesce(nullif(r ->> 'nombre', ''), nullif(trim(coalesce(r ->> 'marca', '') || ' ' || coalesce(r ->> 'modelo', '')), ''),
                      nullif(r ->> 'es', ''), nullif(r ->> 'title_es', ''), nullif(r ->> 'caption_es', ''), nullif(r ->> 'label', ''), '');

  insert into public.audit_log (user_id, user_name, user_role, tabla, accion, registro, titulo, store_id, cambios)
  values (auth.uid(),
          case when auth.uid() is null then 'Sistema / SQL' else coalesce(nullif(trim(pr.nombre || ' ' || pr.apellidos), ''), pr.member_code, '') end,
          coalesce(pr.role, case when auth.uid() is null then 'sistema' else '' end),
          tg_table_name,
          case tg_op when 'INSERT' then 'crear' when 'UPDATE' then 'cambiar' else 'borrar' end,
          coalesce(r ->> 'id', ''), left(v_title, 120), v_store, diff);
  return null;
end $$;

-- ---------------------------------------------------------------------
-- 2. Clave de empleado con límite de intentos
-- ---------------------------------------------------------------------
create table if not exists public.pin_locks (
  user_id      uuid not null,
  store_id     uuid not null,
  fails        int not null default 0,
  locked_until timestamptz,
  primary key (user_id, store_id)
);
alter table public.pin_locks enable row level security;   -- nadie la lee desde la app

create or replace function public.check_employee_pin(p_store uuid, p_pin text)
returns table (id uuid, nombre text)
language plpgsql security definer set search_path = public, extensions as $$
declare lk public.pin_locks; e record; v_uid uuid := coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000');
begin
  if not public.is_store_staff(p_store) then return; end if;
  select * into lk from public.pin_locks where user_id = v_uid and store_id = p_store;
  if lk.locked_until is not null and lk.locked_until > now() then
    raise exception 'Demasiados intentos con clave incorrecta. Espera % min y vuelve a intentar.', ceil(extract(epoch from (lk.locked_until - now())) / 60)::int;
  end if;
  select x.id, x.nombre into e from public.employees x
   where x.activo and (x.rol = 'admin' or x.store_id = p_store or p_store = any(x.store_ids))
     and x.pin_hash = crypt(coalesce(p_pin, ''), x.pin_hash)
   limit 1;
  if e.id is null then
    insert into public.pin_locks as pl (user_id, store_id, fails, locked_until) values (v_uid, p_store, 1, null)
    on conflict (user_id, store_id) do update set
      fails = case when pl.fails + 1 >= 5 then 0 else pl.fails + 1 end,
      locked_until = case when pl.fails + 1 >= 5 then now() + interval '10 minutes' else null end;
    return;
  end if;
  delete from public.pin_locks where user_id = v_uid and store_id = p_store;
  id := e.id; nombre := e.nombre;
  return next;
end $$;
revoke all on function public.check_employee_pin(uuid, text) from public, anon;
grant execute on function public.check_employee_pin(uuid, text) to authenticated;

create or replace function public.emp_or_fail(p_store uuid, p_pin text) returns public.employees
language plpgsql security definer set search_path = public, extensions as $$
declare e public.employees; lk public.pin_locks;
begin
  if not public.is_store_staff(p_store) then raise exception 'Sin permiso en esta tienda'; end if;
  select * into lk from public.pin_locks where user_id = auth.uid() and store_id = p_store;
  if lk.locked_until is not null and lk.locked_until > now() then raise exception 'Clave bloqueada unos minutos por intentos fallidos'; end if;
  select * into e from public.employees x
   where x.activo and (x.rol = 'admin' or x.store_id = p_store or p_store = any(x.store_ids))
     and x.pin_hash = crypt(coalesce(p_pin, ''), x.pin_hash) limit 1;
  if e.id is null then raise exception 'Clave de empleado incorrecta'; end if;
  return e;
end $$;

-- ---------------------------------------------------------------------
-- 3. Admin: guardar empleado con varias sucursales y dar acceso a una cuenta
-- ---------------------------------------------------------------------
create or replace function public.admin_employee_save(
  p_id uuid, p_nombre text, p_stores uuid[], p_rol text, p_activo boolean, p_pin text
) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid; v_stores uuid[] := coalesce(p_stores, '{}');
begin
  if not public.is_admin() then raise exception 'Solo el administrador'; end if;
  if coalesce(trim(p_nombre), '') = '' then raise exception 'Escribe el nombre'; end if;
  if p_rol not in ('tienda', 'admin') then raise exception 'Rol inválido'; end if;
  if p_rol = 'tienda' and cardinality(v_stores) = 0 then raise exception 'Elige al menos una sucursal'; end if;
  if p_pin is not null and p_pin !~ '^\d{4,6}$' then raise exception 'La clave debe tener de 4 a 6 dígitos'; end if;
  if p_pin is not null and exists (
    select 1 from public.employees where activo and pin_hash = crypt(p_pin, pin_hash) and id is distinct from p_id
  ) then raise exception 'Esa clave ya la usa otro empleado'; end if;
  if p_rol = 'admin' then v_stores := '{}'; end if;
  if p_id is null then
    if p_pin is null then raise exception 'Falta la clave'; end if;
    insert into public.employees (nombre, store_id, store_ids, rol, activo, pin_hash)
    values (trim(p_nombre), v_stores[1], v_stores, p_rol, coalesce(p_activo, true), crypt(p_pin, gen_salt('bf')))
    returning id into v_id;
  else
    update public.employees set
      nombre = trim(p_nombre), store_id = v_stores[1], store_ids = v_stores, rol = p_rol,
      activo = coalesce(p_activo, activo),
      pin_hash = case when p_pin is null then pin_hash else crypt(p_pin, gen_salt('bf')) end
    where id = p_id returning id into v_id;
    if v_id is null then raise exception 'No encontramos ese empleado'; end if;
  end if;
  return v_id;
end $$;
revoke all on function public.admin_employee_save(uuid, text, uuid[], text, boolean, text) from public, anon;
grant execute on function public.admin_employee_save(uuid, text, uuid[], text, boolean, text) to authenticated;

create or replace function public.admin_set_access(p_user uuid, p_role text, p_stores uuid[]) returns void
language plpgsql security definer set search_path = public as $$
declare v_stores uuid[] := coalesce(p_stores, '{}');
begin
  if not public.is_admin() then raise exception 'Solo el administrador'; end if;
  if p_role not in ('cliente', 'tienda', 'admin') then raise exception 'Rol inválido'; end if;
  if p_role = 'tienda' and cardinality(v_stores) = 0 then raise exception 'Elige al menos una sucursal'; end if;
  if p_user = auth.uid() and p_role <> 'admin' then raise exception 'No puedes quitarte tu propio acceso de administrador'; end if;
  update public.profiles set
    role = p_role,
    store_ids = case when p_role = 'tienda' then v_stores else '{}' end,
    store_id = case when p_role = 'tienda' then v_stores[1] else store_id end
  where id = p_user;
  if not found then raise exception 'No encontramos esa cuenta'; end if;
end $$;
revoke all on function public.admin_set_access(uuid, text, uuid[]) from public, anon;
grant execute on function public.admin_set_access(uuid, text, uuid[]) to authenticated;

-- El anterior sigue sirviendo (por correo o número de cliente) y ahora también llena store_ids
create or replace function public.admin_set_role(p_lookup text, p_role text, p_store uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.is_admin() then raise exception 'Solo el administrador'; end if;
  select p.id into v_id from public.profiles p join auth.users u on u.id = p.id
  where upper(p.member_code) = upper(trim(p_lookup)) or lower(u.email) = lower(trim(p_lookup));
  if v_id is null then raise exception 'No encontramos esa cuenta'; end if;
  perform public.admin_set_access(v_id, p_role, case when p_role = 'tienda' and p_store is not null then array[p_store] else '{}' end);
end $$;

-- Correos de las cuentas (solo el administrador) para poder buscarlas por correo
create or replace function public.admin_account_emails() returns table (id uuid, email text)
language sql stable security definer set search_path = public as $$
  select u.id, u.email::text from auth.users u where public.is_admin()
$$;
revoke all on function public.admin_account_emails() from public, anon;
grant execute on function public.admin_account_emails() to authenticated;

-- ---------------------------------------------------------------------
-- 4. Sucursal: horario por día y columnas que solo cambia el administrador
-- ---------------------------------------------------------------------
-- horas: [{"d":1,"on":true,"a":"09:00","c":"20:00"}, ...]  (d: 0 = domingo … 6 = sábado)
alter table public.stores add column if not exists horas jsonb;
alter table public.stores add column if not exists tz text not null default 'America/Chicago';

create or replace function public.protect_store() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.activo := old.activo;
    new.orden := old.orden;
  end if;
  return new;
end $$;
drop trigger if exists protect_store on public.stores;
create trigger protect_store before update on public.stores for each row execute function public.protect_store();

-- ---------------------------------------------------------------------
-- 5. Mostrador: una venta con varios artículos y descuento
-- ---------------------------------------------------------------------
alter table public.orders add column if not exists sale_id uuid;
create index if not exists orders_sale_idx on public.orders (sale_id) where sale_id is not null;

-- p_lines: [{"kind":"svc","service":"…","option":0,"amount":80,"qty":1}, {"kind":"prod","variant":"…","qty":2}]
create or replace function public.counter_cart(
  p_store uuid, p_pin text, p_member text, p_lines jsonb, p_method text, p_reward text, p_disc numeric
) returns setof public.orders
language plpgsql security definer set search_path = public as $$
declare
  ln jsonb; q int; i int; o public.orders; e public.employees;
  v_sale uuid := gen_random_uuid(); v_tried boolean := false;
  v_pct numeric := greatest(0, least(coalesce(p_disc, 0), 50)); v_d numeric;
begin
  e := public.emp_or_fail(p_store, p_pin);
  if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) = 0 then raise exception 'Agrega algo a la venta'; end if;
  if jsonb_array_length(p_lines) > 30 then raise exception 'Demasiados artículos en una venta'; end if;
  for ln in select * from jsonb_array_elements(p_lines) loop
    q := greatest(1, least(coalesce(nullif(ln->>'qty', '')::int, 1), 20));
    for i in 1..q loop
      o := public.counter_sale(p_store, p_pin, p_member, ln->>'kind',
             nullif(ln->>'service', '')::uuid, nullif(ln->>'option', '')::int, nullif(ln->>'amount', '')::numeric,
             nullif(ln->>'variant', '')::uuid, p_method, case when v_tried then null else nullif(p_reward, '') end);
      v_tried := true;
      v_d := round(o.total * v_pct / 100, 2);
      update public.orders set sale_id = v_sale, discount = coalesce(discount, 0) + v_d, total = total - v_d where id = o.id returning * into o;
      if v_d > 0 then
        insert into public.order_events (order_id, act, by_name) values (o.id, 'Descuento de mostrador ' || v_pct || ' %', e.nombre);
      end if;
      return next o;
    end loop;
  end loop;
end $$;
revoke all on function public.counter_cart(uuid, text, text, jsonb, text, text, numeric) from public, anon;
grant execute on function public.counter_cart(uuid, text, text, jsonb, text, text, numeric) to authenticated;

-- ---------------------------------------------------------------------
-- 6. Corte de caja: por forma de pago, lo contado y gastos de caja
-- ---------------------------------------------------------------------
create table if not exists public.caja_gastos (
  id            uuid primary key default gen_random_uuid(),
  store_id      uuid not null references public.stores(id) on delete cascade,
  concepto      text not null,
  monto         numeric(12,2) not null check (monto > 0),
  metodo        text not null default 'cash' check (metodo in ('cash', 'card', 'zelle')),
  foto_path     text,
  employee_name text not null default '',
  corte_id      uuid references public.cortes(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists caja_gastos_store_idx on public.caja_gastos (store_id, created_at desc);
alter table public.caja_gastos enable row level security;
drop policy if exists gastos_read on public.caja_gastos;
create policy gastos_read on public.caja_gastos for select using (public.is_store_staff(store_id));
grant select on public.caja_gastos to authenticated;

create or replace function public.add_gasto(p_store uuid, p_pin text, p_concepto text, p_monto numeric, p_metodo text, p_foto text)
returns public.caja_gastos
language plpgsql security definer set search_path = public as $$
declare e public.employees; g public.caja_gastos;
begin
  e := public.emp_or_fail(p_store, p_pin);
  if coalesce(trim(p_concepto), '') = '' then raise exception 'Escribe el concepto del gasto'; end if;
  if p_monto is null or p_monto <= 0 or p_monto > 5000 then raise exception 'Monto inválido'; end if;
  insert into public.caja_gastos (store_id, concepto, monto, metodo, foto_path, employee_name)
  values (p_store, left(trim(p_concepto), 120), round(p_monto, 2), case when p_metodo in ('cash', 'card', 'zelle') then p_metodo else 'cash' end, nullif(p_foto, ''), e.nombre)
  returning * into g;
  return g;
end $$;
revoke all on function public.add_gasto(uuid, text, text, numeric, text, text) from public, anon;
grant execute on function public.add_gasto(uuid, text, text, numeric, text, text) to authenticated;

alter table public.cortes add column if not exists contado jsonb not null default '{}';  -- {"zelle":0,"cash":0,"card":0}
alter table public.cortes add column if not exists gastos numeric(12,2) not null default 0;

drop function if exists public.make_corte(uuid, text, text);
create or replace function public.make_corte(p_store uuid, p_pin text, p_notas text default '', p_contado jsonb default '{}')
returns public.cortes
language plpgsql security definer set search_path = public as $$
declare e record; c public.cortes; v_desde timestamptz; v_id uuid := gen_random_uuid(); v_gastos numeric;
begin
  if not public.is_store_staff(p_store) then raise exception 'Sin permiso'; end if;
  select * into e from public.check_employee_pin(p_store, p_pin);
  if e.id is null then raise exception 'Clave incorrecta o de otra sucursal'; end if;
  select max(hasta) into v_desde from public.cortes where store_id = p_store;
  perform 1 from public.orders where store_id = p_store and corte_id is null and paid_at is not null and status <> 'rechazado' for update;
  select coalesce(sum(monto), 0) into v_gastos from public.caja_gastos where store_id = p_store and corte_id is null;

  insert into public.cortes (id, store_id, desde, hasta, employee_id, employee_name, n_orders, total, fees, resumen, notas, contado, gastos)
  select v_id, p_store, v_desde, now(), e.id, e.nombre, count(*), coalesce(sum(total), 0), coalesce(sum(fee), 0),
         jsonb_build_object(
           'por_tipo', coalesce((select jsonb_object_agg(k, jsonb_build_object('n', n, 'total', t)) from (
               select case when kind = 'service' then 'cat:' || coalesce(service_name->>'cat', 'otros') else kind end k, count(*) n, sum(total) t
               from public.orders where store_id = p_store and corte_id is null and paid_at is not null and status <> 'rechazado' group by 1) x), '{}'::jsonb),
           'por_empleado', coalesce((select jsonb_object_agg(k, jsonb_build_object('n', n, 'total', t)) from (
               select coalesce(attended_name, 'Sin asignar') k, count(*) n, sum(total) t
               from public.orders where store_id = p_store and corte_id is null and paid_at is not null and status <> 'rechazado' group by 1) y), '{}'::jsonb),
           'por_pago', coalesce((select jsonb_object_agg(k, jsonb_build_object('n', n, 'total', t)) from (
               select coalesce(nullif(pay_method, ''), 'zelle') k, count(*) n, sum(total) t
               from public.orders where store_id = p_store and corte_id is null and paid_at is not null and status <> 'rechazado' group by 1) z), '{}'::jsonb),
           'gastos_por_pago', coalesce((select jsonb_object_agg(metodo, t) from (
               select metodo, sum(monto) t from public.caja_gastos where store_id = p_store and corte_id is null group by 1) g), '{}'::jsonb)
         ),
         coalesce(p_notas, ''), coalesce(p_contado, '{}'::jsonb), v_gastos
  from public.orders where store_id = p_store and corte_id is null and paid_at is not null and status <> 'rechazado'
  returning * into c;

  update public.orders set corte_id = v_id where store_id = p_store and corte_id is null and paid_at is not null and status <> 'rechazado';
  update public.caja_gastos set corte_id = v_id where store_id = p_store and corte_id is null;
  perform public.notify_staff(null, 'corte', 'Corte de caja · ' || (select nombre from public.stores where id = p_store),
    e.nombre || ' cerró ' || c.n_orders || ' ventas por $' || c.total || '.', '/tienda/corte', v_id);
  return c;
end $$;
revoke all on function public.make_corte(uuid, text, text, jsonb) from public, anon;
grant execute on function public.make_corte(uuid, text, text, jsonb) to authenticated;

-- Bitácora de gastos de caja
drop trigger if exists audit_caja_gastos on public.caja_gastos;
create trigger audit_caja_gastos after insert or update or delete on public.caja_gastos for each row execute function public.audit_row();
