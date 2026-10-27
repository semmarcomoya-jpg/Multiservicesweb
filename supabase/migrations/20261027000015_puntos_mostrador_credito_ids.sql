-- =====================================================================
-- Castillo Multiservices · Puntos, Mostrador, Crédito/Apartado, Identificaciones,
-- Clientes, Reglas y Textos (igual que la maqueta)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Ajustes generales nuevos
-- ---------------------------------------------------------------------
alter table public.settings add column if not exists credit jsonb not null default
  '{"on": true, "layaway": true, "freqs": {"semanal": true, "quincenal": true, "mensual": true}, "nList": "4, 6, 8, 12", "minDown": 20, "rate": 0, "lateFee": 5, "grace": 3, "minPrice": 50, "layDays": 60}'::jsonb;
alter table public.settings add column if not exists id_types jsonb not null default
  '{"matricula": true, "pasaporte": true, "ine": true, "licencia": true, "estatal": true}'::jsonb;
alter table public.settings add column if not exists redes text not null default 'Elektra, Coppel, Banco Azteca, Bodega Aurrera, Walmart, OXXO';
alter table public.settings add column if not exists terms_es text not null default
  'Castillo Multiservices ofrece envíos de dinero a México mediante proveedores con licencia, pago de servicios y venta de productos. Los pagos con Zelle se confirman por la tienda antes de procesar tu pedido. Los tipos de cambio y comisiones se muestran antes de pagar. Tus datos se usan solo para atenderte y nunca te preguntamos tu estatus migratorio.';
alter table public.settings add column if not exists terms_en text not null default
  'Castillo Multiservices offers money transfers to Mexico through licensed providers, bill payments and product sales. Zelle payments are confirmed by the store before your order is processed. Exchange rates and fees are shown before you pay. Your data is used only to serve you and we never ask about your immigration status.';
alter table public.settings add column if not exists help_wa text not null default '';
alter table public.settings add column if not exists help_mail text not null default '';

-- Programa de puntos de cada tienda
alter table public.stores add column if not exists loyalty jsonb not null default
  '{"on": true, "perTx": 10, "per100": 5, "bday": 50, "postPts": 10,
    "rewards": [{"id": "r1", "es": "Envío sin comisión", "en": "Fee-free transfer", "pts": 200, "type": "fee", "value": 0},
                {"id": "r2", "es": "$5 de descuento", "en": "$5 off", "pts": 300, "type": "off", "value": 5},
                {"id": "r3", "es": "$15 de descuento", "en": "$15 off", "pts": 800, "type": "off", "value": 15}]}'::jsonb;

-- Pedidos: canal, forma de pago, descuentos por premio y abonos
alter table public.orders add column if not exists channel text not null default 'app';
alter table public.orders add column if not exists pay_method text not null default 'zelle';
alter table public.orders add column if not exists discount numeric(10,2) not null default 0;
alter table public.orders add column if not exists reward_name text not null default '';
alter table public.orders add column if not exists reward_pts int not null default 0;
alter table public.orders add column if not exists plan_id uuid;
alter table public.orders add column if not exists inst int;

-- Que una función de confianza pueda cambiar el estado de identificación del cliente
create or replace function public.protect_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() and coalesce(current_setting('castillo.bypass', true), '') <> '1' then
    new.role := old.role;
    new.member_code := old.member_code;
    new.id_status := old.id_status;
    if old.role = 'tienda' then new.store_id := old.store_id; end if;
  end if;
  return new;
end $$;

-- Clave de empleado: regresa el empleado o falla
create or replace function public.emp_or_fail(p_store uuid, p_pin text) returns public.employees
language plpgsql security definer set search_path = public, extensions as $$
declare e public.employees;
begin
  if not public.is_store_staff(p_store) then raise exception 'Sin permiso en esta tienda'; end if;
  select * into e from public.employees x
   where x.activo and (x.rol = 'admin' or x.store_id = p_store) and x.pin_hash = crypt(coalesce(p_pin, ''), x.pin_hash) limit 1;
  if e.id is null then raise exception 'Clave de empleado incorrecta'; end if;
  return e;
end $$;
revoke all on function public.emp_or_fail(uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 1. Puntos
-- ---------------------------------------------------------------------
create table if not exists public.points_ledger (
  id         bigserial primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  store_id   uuid not null references public.stores(id) on delete cascade,
  pts        int not null,
  kind       text not null check (kind in ('earn', 'redeem', 'refund', 'bday', 'post', 'adjust')),
  motivo     text not null default '',
  order_id   uuid references public.orders(id) on delete set null,
  ref        text unique,
  by_name    text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists points_user_idx on public.points_ledger (user_id, store_id, created_at desc);
alter table public.points_ledger enable row level security;
drop policy if exists points_read on public.points_ledger;
create policy points_read on public.points_ledger for select using (
  user_id = auth.uid() or public.is_admin() or public.is_store_staff(store_id)
);
grant select on public.points_ledger to authenticated;

create or replace function public.points_balance(p_user uuid, p_store uuid) returns int
language sql stable security definer set search_path = public as $$
  select greatest(0, coalesce(sum(pts), 0))::int from public.points_ledger where user_id = p_user and store_id = p_store
$$;
revoke all on function public.points_balance(uuid, uuid) from public, anon;
grant execute on function public.points_balance(uuid, uuid) to authenticated;

-- Puntos que gana un pedido completado
create or replace function public.award_points(p_order uuid) returns void
language plpgsql security definer set search_path = public as $$
declare o public.orders; ly jsonb; n int;
begin
  select * into o from public.orders where id = p_order;
  if o.id is null or o.status <> 'completado' or o.kind = 'abono' then return; end if;
  select loyalty into ly from public.stores where id = o.store_id;
  if ly is null or coalesce((ly->>'on')::boolean, false) = false then return; end if;
  n := coalesce((ly->>'perTx')::int, 0) + floor(coalesce(o.monto, 0) / 100)::int * coalesce((ly->>'per100')::int, 0);
  if n <= 0 then return; end if;
  insert into public.points_ledger (user_id, store_id, pts, kind, motivo, order_id, ref)
  values (o.user_id, o.store_id, n, 'earn', 'Pedido ' || o.folio, o.id, 'earn-' || o.id)
  on conflict (ref) do nothing;
  if found then
    perform public.notify(o.user_id, 'points', '+' || n || ' puntos', 'Por tu pedido ' || o.folio || '.', '/puntos', o.id);
  end if;
end $$;
revoke all on function public.award_points(uuid) from public, anon, authenticated;

create or replace function public.points_on_order() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'completado' and (tg_op = 'INSERT' or old.status is distinct from 'completado') then
    perform public.award_points(new.id);
  end if;
  -- Pedido rechazado: le regresamos los puntos del premio que usó
  if tg_op = 'UPDATE' and new.status = 'rechazado' and old.status <> 'rechazado' and new.reward_pts > 0 then
    insert into public.points_ledger (user_id, store_id, pts, kind, motivo, order_id, ref)
    values (new.user_id, new.store_id, new.reward_pts, 'refund', 'Te regresamos tus puntos del pedido ' || new.folio, new.id, 'refund-' || new.id)
    on conflict (ref) do nothing;
  end if;
  return null;
end $$;
drop trigger if exists points_order_ins on public.orders;
create trigger points_order_ins after insert on public.orders for each row execute function public.points_on_order();
drop trigger if exists points_order_upd on public.orders;
create trigger points_order_upd after update of status on public.orders for each row execute function public.points_on_order();

-- Puntos de cumpleaños (una vez al año por tienda, en el mes del cumpleaños)
create or replace function public.claim_birthday() returns int
language plpgsql security definer set search_path = public as $$
declare pr public.profiles; st record; total int := 0; n int;
begin
  select * into pr from public.profiles where id = auth.uid();
  if pr.id is null or pr.fecha_nac is null or extract(month from pr.fecha_nac) <> extract(month from now()) then return 0; end if;
  for st in select id, loyalty from public.stores where activo and coalesce((loyalty->>'on')::boolean, false) loop
    n := coalesce((st.loyalty->>'bday')::int, 0);
    if n > 0 then
      insert into public.points_ledger (user_id, store_id, pts, kind, motivo, ref)
      values (pr.id, st.id, n, 'bday', 'Regalo de cumpleaños', 'bday-' || pr.id || '-' || st.id || '-' || extract(year from now()))
      on conflict (ref) do nothing;
      if found then total := total + n; end if;
    end if;
  end loop;
  return total;
end $$;
revoke all on function public.claim_birthday() from public, anon;
grant execute on function public.claim_birthday() to authenticated;

-- Puntos por participar en Boca a boca (una vez por semana por tienda)
create or replace function public.points_on_post() returns trigger
language plpgsql security definer set search_path = public as $$
declare ly jsonb; n int; r text;
begin
  if new.store_id is null or new.user_id is null or new.kind not in ('reco', 'prod', 'promo', 'sug') then return null; end if;
  if exists (select 1 from public.profiles where id = new.user_id and role <> 'cliente') then return null; end if;
  select loyalty into ly from public.stores where id = new.store_id;
  if ly is null or coalesce((ly->>'on')::boolean, false) = false then return null; end if;
  n := coalesce((ly->>'postPts')::int, 0);
  if n <= 0 then return null; end if;
  r := 'post-' || new.user_id || '-' || new.store_id || '-' || to_char(now(), 'IYYY-IW');
  insert into public.points_ledger (user_id, store_id, pts, kind, motivo, ref)
  values (new.user_id, new.store_id, n, 'post', 'Por compartir en Boca a boca', r)
  on conflict (ref) do nothing;
  if found then perform public.notify(new.user_id, 'points', '+' || n || ' puntos por compartir', 'Gracias por ayudar a la comunidad.', '/puntos', new.id); end if;
  return null;
end $$;
drop trigger if exists points_post on public.posts;
create trigger points_post after insert on public.posts for each row execute function public.points_on_post();

-- Calcula el descuento de un premio para un pedido
create or replace function public.reward_discount(p_store uuid, p_reward text, p_total numeric, p_fee numeric)
returns table (name text, pts int, discount numeric)
language plpgsql stable security definer set search_path = public as $$
declare ly jsonb; r jsonb;
begin
  select loyalty into ly from public.stores where id = p_store;
  if ly is null or coalesce((ly->>'on')::boolean, false) = false then raise exception 'Esta tienda no tiene programa de puntos'; end if;
  select x into r from jsonb_array_elements(coalesce(ly->'rewards', '[]'::jsonb)) x where x->>'id' = p_reward;
  if r is null then raise exception 'Premio no encontrado'; end if;
  name := coalesce(r->>'es', 'Premio');
  pts := coalesce((r->>'pts')::int, 0);
  discount := case when r->>'type' = 'fee' then least(coalesce(p_fee, 0), p_total)
                   else least(coalesce((r->>'value')::numeric, 0), p_total) end;
  if discount <= 0 then raise exception 'Este premio no aplica a este pedido'; end if;
  return next;
end $$;
revoke all on function public.reward_discount(uuid, text, numeric, numeric) from public, anon, authenticated;

-- El cliente usa un premio en su pedido (antes de pagarlo)
create or replace function public.apply_reward(p_order uuid, p_reward text) returns public.orders
language plpgsql security definer set search_path = public as $$
declare o public.orders; rd record;
begin
  select * into o from public.orders where id = p_order and user_id = auth.uid() for update;
  if o.id is null then raise exception 'Pedido no encontrado'; end if;
  if o.status <> 'verificar' or o.reward_pts > 0 then raise exception 'Este pedido ya no acepta premios'; end if;
  select * into rd from public.reward_discount(o.store_id, p_reward, o.total, o.fee);
  if public.points_balance(o.user_id, o.store_id) < rd.pts then raise exception 'No te alcanzan los puntos'; end if;
  insert into public.points_ledger (user_id, store_id, pts, kind, motivo, order_id, ref)
  values (o.user_id, o.store_id, -rd.pts, 'redeem', rd.name || ' · ' || o.folio, o.id, 'redeem-' || o.id);
  update public.orders set discount = rd.discount, total = total - rd.discount, reward_name = rd.name, reward_pts = rd.pts
   where id = o.id returning * into o;
  insert into public.order_events (order_id, act, by_name) values (o.id, 'Usó su premio: ' || rd.name, o.cliente_nombre);
  return o;
end $$;
revoke all on function public.apply_reward(uuid, text) from public, anon;
grant execute on function public.apply_reward(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- 2. Mostrador: buscar cliente por su tarjeta y cobrar
-- ---------------------------------------------------------------------
create or replace function public.find_member(p_store uuid, p_code text)
returns table (user_id uuid, nombre text, member_code text, telefono text, foto_url text, id_status text, puntos int, planes int, credito_on boolean, credito_limite numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_store_staff(p_store) then raise exception 'Sin permiso'; end if;
  return query
  select p.id, trim(p.nombre || ' ' || p.apellidos), p.member_code, p.telefono, p.foto_url, p.id_status,
         public.points_balance(p.id, p_store),
         (select count(*)::int from public.plans pl where pl.user_id = p.id and pl.store_id = p_store and pl.status = 'activo'),
         coalesce((select cl.on from public.credit_lines cl where cl.user_id = p.id and cl.store_id = p_store), false),
         coalesce((select cl.limite from public.credit_lines cl where cl.user_id = p.id and cl.store_id = p_store), 0)
  from public.profiles p
  where upper(p.member_code) = upper(trim(p_code))
  limit 1;
end $$;

create or replace function public.counter_sale(
  p_store uuid, p_pin text, p_member text, p_kind text,
  p_service uuid, p_option int, p_amount numeric, p_variant uuid, p_method text, p_reward text
) returns public.orders
language plpgsql security definer set search_path = public as $$
declare
  e public.employees; st public.stores; pr public.profiles; sv public.services; v record; o public.orders;
  v_base numeric := 0; v_fee numeric := 0; v_opt jsonb; v_items jsonb; v_kind text; rd record;
  v_method text := case when p_method in ('cash', 'card', 'zelle') then p_method else 'cash' end;
begin
  e := public.emp_or_fail(p_store, p_pin);
  select * into st from public.stores where id = p_store;
  select * into pr from public.profiles where upper(member_code) = upper(trim(p_member));
  if pr.id is null then raise exception 'No encontramos ese número de cliente'; end if;

  if p_kind = 'svc' then
    select * into sv from public.services where id = p_service and activo;
    if sv.id is null or sv.id = any(st.svc_off) then raise exception 'Servicio no disponible en esta tienda'; end if;
    if sv.price_type = 'fixed' then v_base := sv.base;
    elsif sv.price_type = 'options' then
      v_opt := sv.options -> p_option;
      if v_opt is null then raise exception 'Elige una opción'; end if;
      v_base := (v_opt->>'p')::numeric;
    else v_base := p_amount; end if;
    if v_base is null or v_base <= 0 then raise exception 'Monto inválido'; end if;
    v_fee := sv.fee;
    v_kind := 'service';
  elsif p_kind = 'prod' then
    select pv.id, pv.label, pv.price, pv.stock, p.id pid, trim(p.marca || ' ' || p.modelo) nm, p.store_id
      into v from public.product_variants pv join public.products p on p.id = pv.product_id
     where pv.id = p_variant and pv.activo and p.activo;
    if v.id is null or v.store_id <> p_store then raise exception 'Producto no disponible'; end if;
    if v.stock < 1 then raise exception 'Ya no hay existencias de ese producto'; end if;
    update public.product_variants set stock = stock - 1 where id = v.id;
    v_base := v.price;
    v_items := jsonb_build_array(jsonb_build_object('product_id', v.pid, 'variant_id', v.id, 'name', v.nm, 'label', v.label, 'qty', 1, 'price', v.price));
    v_kind := 'shop';
  else
    raise exception 'Tipo de venta inválido';
  end if;

  insert into public.orders (user_id, store_id, kind, service_id, service_name, items, monto, fee, total, status, channel, pay_method,
                             attended_by, attended_name, cliente_nombre, cliente_code, zelle_nombre, paid_at)
  values (pr.id, p_store, v_kind, sv.id,
          case when sv.id is null then null else jsonb_build_object('es', sv.es, 'en', sv.en, 'icon', sv.icon, 'cat', sv.cat_id,
               'opcion', case when v_opt is null then null else jsonb_build_object('es', v_opt->>'es', 'en', v_opt->>'en') end) end,
          v_items, v_base, v_fee, v_base + v_fee, 'verificar', 'store', v_method,
          e.id, e.nombre, trim(pr.nombre || ' ' || pr.apellidos), coalesce(pr.member_code, ''), '', now())
  returning * into o;

  if coalesce(p_reward, '') <> '' then
    select * into rd from public.reward_discount(p_store, p_reward, o.total, o.fee);
    if public.points_balance(pr.id, p_store) < rd.pts then raise exception 'Al cliente no le alcanzan los puntos'; end if;
    insert into public.points_ledger (user_id, store_id, pts, kind, motivo, order_id, ref, by_name)
    values (pr.id, p_store, -rd.pts, 'redeem', rd.name || ' · ' || o.folio, o.id, 'redeem-' || o.id, e.nombre);
    update public.orders set discount = rd.discount, total = total - rd.discount, reward_name = rd.name, reward_pts = rd.pts where id = o.id;
  end if;

  -- Cobrado en mostrador: queda completado (y gana puntos)
  update public.orders set status = 'completado' where id = o.id returning * into o;
  insert into public.order_events (order_id, act, by_name)
  values (o.id, 'Cobró en mostrador (' || case v_method when 'cash' then 'efectivo' when 'card' then 'tarjeta' else 'Zelle' end || ')', e.nombre);
  return o;
end $$;
revoke all on function public.counter_sale(uuid, text, text, text, uuid, int, numeric, uuid, text, text) from public, anon;
grant execute on function public.counter_sale(uuid, text, text, text, uuid, int, numeric, uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Crédito y apartado
-- ---------------------------------------------------------------------
create table if not exists public.credit_lines (
  user_id    uuid not null references auth.users(id) on delete cascade,
  store_id   uuid not null references public.stores(id) on delete cascade,
  "on"       boolean not null default false,
  limite     numeric(10,2) not null default 0,
  by_name    text not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, store_id)
);
alter table public.credit_lines enable row level security;
drop policy if exists credit_read on public.credit_lines;
create policy credit_read on public.credit_lines for select using (user_id = auth.uid() or public.is_admin() or public.is_store_staff(store_id));
grant select on public.credit_lines to authenticated;

create sequence if not exists public.plan_folio_seq start 1001;
create table if not exists public.plans (
  id             uuid primary key default gen_random_uuid(),
  folio          text not null unique default ('CR-' || nextval('public.plan_folio_seq')),
  kind           text not null check (kind in ('credito', 'apartado')),
  user_id        uuid not null references auth.users(id) on delete cascade,
  store_id       uuid not null references public.stores(id),
  product_id     uuid,
  variant_id     uuid,
  item_name      text not null default '',
  item_label     text not null default '',
  price          numeric(10,2) not null,
  down           numeric(10,2) not null default 0,
  n              int not null,
  freq           text not null check (freq in ('semanal', 'quincenal', 'mensual')),
  rate           numeric(6,2) not null default 0,
  total_fin      numeric(10,2) not null,
  status         text not null default 'solicitado' check (status in ('solicitado', 'activo', 'rechazado', 'liquidado', 'cancelado')),
  cliente_nombre text not null default '',
  cliente_code   text not null default '',
  approved_by    text not null default '',
  reject_reason  text not null default '',
  created_at     timestamptz not null default now()
);
create table if not exists public.plan_payments (
  plan_id  uuid not null references public.plans(id) on delete cascade,
  i        int not null,
  due      date not null,
  amount   numeric(10,2) not null,
  paid_at  timestamptz,
  method   text not null default '',
  by_name  text not null default '',
  order_id uuid,
  primary key (plan_id, i)
);
alter table public.plans enable row level security;
alter table public.plan_payments enable row level security;
drop policy if exists plans_read on public.plans;
create policy plans_read on public.plans for select using (user_id = auth.uid() or public.is_admin() or public.is_store_staff(store_id));
drop policy if exists plan_pay_read on public.plan_payments;
create policy plan_pay_read on public.plan_payments for select using (exists (select 1 from public.plans p where p.id = plan_id));
grant select on public.plans, public.plan_payments to authenticated;

-- La tienda habilita la línea de crédito de un cliente
create or replace function public.set_credit_line(p_store uuid, p_pin text, p_member text, p_on boolean, p_limit numeric) returns void
language plpgsql security definer set search_path = public as $$
declare e public.employees; pr public.profiles;
begin
  e := public.emp_or_fail(p_store, p_pin);
  select * into pr from public.profiles where upper(member_code) = upper(trim(p_member));
  if pr.id is null then raise exception 'No encontramos ese número de cliente'; end if;
  if p_limit is null or p_limit < 0 then raise exception 'Límite inválido'; end if;
  insert into public.credit_lines (user_id, store_id, "on", limite, by_name, updated_at)
  values (pr.id, p_store, p_on, p_limit, e.nombre, now())
  on conflict (user_id, store_id) do update set "on" = excluded."on", limite = excluded.limite, by_name = excluded.by_name, updated_at = now();
  if p_on then perform public.notify(pr.id, 'credit', 'Tienes línea de crédito', 'Ya puedes llevarte productos en abonos hasta $' || p_limit || '.', '/credito', null); end if;
end $$;
revoke all on function public.set_credit_line(uuid, text, text, boolean, numeric) from public, anon;
grant execute on function public.set_credit_line(uuid, text, text, boolean, numeric) to authenticated;

create or replace function public.plan_left(p_plan uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(sum(amount), 0) from public.plan_payments where plan_id = p_plan and paid_at is null
$$;

-- El cliente pide un plan de pagos para un producto
create or replace function public.request_plan(p_variant uuid, p_kind text, p_freq text, p_n int, p_down numeric) returns public.plans
language plpgsql security definer set search_path = public as $$
declare
  cfg jsonb; v record; st public.stores; pr public.profiles; pl public.plans; cl public.credit_lines;
  v_min numeric; v_rate numeric; v_fin numeric; v_each numeric; v_step interval; i int; v_used numeric;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  select credit into cfg from public.settings where id = 1;
  select pv.id, pv.label, pv.price, pv.stock, p.id pid, trim(p.marca || ' ' || p.modelo) nm, p.store_id
    into v from public.product_variants pv join public.products p on p.id = pv.product_id where pv.id = p_variant and pv.activo and p.activo;
  if v.id is null then raise exception 'Producto no disponible'; end if;
  select * into st from public.stores where id = v.store_id and activo;
  if p_kind = 'credito' then
    if coalesce((cfg->>'on')::boolean, false) = false or coalesce((st.mods->>'credit')::boolean, false) = false then raise exception 'Esta tienda no ofrece crédito'; end if;
    if v.price < coalesce((cfg->>'minPrice')::numeric, 0) then raise exception 'Este producto no se puede financiar'; end if;
  elsif p_kind = 'apartado' then
    if coalesce((cfg->>'layaway')::boolean, false) = false or coalesce((st.mods->>'layaway')::boolean, false) = false then raise exception 'Esta tienda no ofrece apartado'; end if;
  else raise exception 'Tipo inválido'; end if;
  if coalesce((cfg->'freqs'->>p_freq)::boolean, false) = false then raise exception 'Frecuencia no disponible'; end if;
  if not (p_n::text = any(string_to_array(replace(coalesce(cfg->>'nList', ''), ' ', ''), ','))) then raise exception 'Número de pagos no disponible'; end if;
  if v.stock < 1 then raise exception 'Ya no hay existencias'; end if;

  v_min := ceil(v.price * coalesce((cfg->>'minDown')::numeric, 0)) / 100;
  if p_down is null or p_down < v_min then raise exception 'El enganche mínimo es $%', v_min; end if;
  if p_down >= v.price then raise exception 'El enganche debe ser menor al precio'; end if;
  v_rate := case when p_kind = 'credito' then coalesce((cfg->>'rate')::numeric, 0) else 0 end;
  v_fin := round((v.price - p_down) * (1 + v_rate / 100), 2);

  if p_kind = 'credito' then
    select * into cl from public.credit_lines where user_id = auth.uid() and store_id = st.id;
    if cl.user_id is null or not cl."on" then raise exception 'Para llevártelo hoy necesitas una línea de crédito. Pídela en tu tienda.'; end if;
    select coalesce(sum(public.plan_left(p.id)), 0) into v_used from public.plans p
     where p.user_id = auth.uid() and p.store_id = st.id and p.kind = 'credito' and p.status in ('solicitado', 'activo');
    if v_fin > cl.limite - v_used + 0.001 then raise exception 'Tu crédito disponible es $%. Sube el enganche o apártalo.', greatest(0, cl.limite - v_used); end if;
  end if;

  select * into pr from public.profiles where id = auth.uid();
  insert into public.plans (kind, user_id, store_id, product_id, variant_id, item_name, item_label, price, down, n, freq, rate, total_fin, cliente_nombre, cliente_code)
  values (p_kind, auth.uid(), st.id, v.pid, v.id, v.nm, v.label, v.price, p_down, p_n, p_freq, v_rate, v_fin, trim(pr.nombre || ' ' || pr.apellidos), coalesce(pr.member_code, ''))
  returning * into pl;
  v_step := case p_freq when 'semanal' then interval '7 days' when 'quincenal' then interval '14 days' else interval '1 month' end;
  v_each := round(v_fin / p_n, 2);
  for i in 1..p_n loop
    insert into public.plan_payments (plan_id, i, due, amount)
    values (pl.id, i, (current_date + v_step * i)::date, case when i = p_n then v_fin - v_each * (p_n - 1) else v_each end);
  end loop;
  perform public.notify_staff(st.id, 'plan', 'Solicitud de ' || case when p_kind = 'credito' then 'crédito' else 'apartado' end || ' ' || pl.folio,
    pl.cliente_nombre || ' · ' || pl.item_name || ' · $' || v.price, '/tienda/creditos', pl.id);
  return pl;
end $$;
revoke all on function public.request_plan(uuid, text, text, int, numeric) from public, anon;
grant execute on function public.request_plan(uuid, text, text, int, numeric) to authenticated;

-- La tienda aprueba o rechaza (con clave de empleado)
create or replace function public.decide_plan(p_plan uuid, p_pin text, p_ok boolean, p_reason text) returns public.plans
language plpgsql security definer set search_path = public as $$
declare pl public.plans; e public.employees; o public.orders;
begin
  select * into pl from public.plans where id = p_plan for update;
  if pl.id is null then raise exception 'Plan no encontrado'; end if;
  e := public.emp_or_fail(pl.store_id, p_pin);
  if pl.status <> 'solicitado' then raise exception 'Este plan ya se revisó'; end if;
  if not p_ok then
    update public.plans set status = 'rechazado', approved_by = e.nombre, reject_reason = coalesce(p_reason, '') where id = pl.id returning * into pl;
    perform public.notify(pl.user_id, 'plan', 'Tu solicitud ' || pl.folio || ' no fue aprobada', coalesce(nullif(p_reason, ''), 'Pregunta en tu tienda.'), '/credito', pl.id);
    return pl;
  end if;
  update public.product_variants set stock = stock - 1 where id = pl.variant_id and stock > 0;
  if not found then raise exception 'Ya no hay existencias de ese producto'; end if;
  update public.plans set status = 'activo', approved_by = e.nombre where id = pl.id returning * into pl;
  -- El enganche / primer abono queda como venta para el corte
  insert into public.orders (user_id, store_id, kind, items, monto, fee, total, status, channel, pay_method, attended_by, attended_name,
                             cliente_nombre, cliente_code, zelle_nombre, paid_at, plan_id, inst, folio_prov)
  values (pl.user_id, pl.store_id, 'abono',
          jsonb_build_array(jsonb_build_object('product_id', pl.product_id, 'variant_id', pl.variant_id, 'name', pl.item_name, 'label', pl.item_label, 'qty', 1, 'price', pl.down)),
          pl.down, 0, pl.down, 'completado', 'store', 'cash', e.id, e.nombre, pl.cliente_nombre, pl.cliente_code, '', now(), pl.id, 0, pl.folio)
  returning * into o;
  insert into public.order_events (order_id, act, by_name)
  values (o.id, case when pl.kind = 'credito' then 'Aprobó crédito, cobró enganche y entregó el producto' else 'Aprobó apartado y cobró el primer abono' end, e.nombre);
  perform public.notify(pl.user_id, 'plan', '¡Aprobado! ' || pl.folio,
    case when pl.kind = 'credito' then 'Ya puedes recoger tu ' || pl.item_name || '. Paga el enganche en tienda.' else 'Guardamos tu ' || pl.item_name || '. Paga tus abonos aquí o en tienda.' end, '/credito', pl.id);
  return pl;
end $$;
revoke all on function public.decide_plan(uuid, text, boolean, text) from public, anon;
grant execute on function public.decide_plan(uuid, text, boolean, text) to authenticated;

-- Marca pagado el siguiente abono
create or replace function public.mark_installment(p_plan uuid, p_method text, p_by text, p_order uuid) returns int
language plpgsql security definer set search_path = public as $$
declare pp public.plan_payments; pl public.plans;
begin
  select * into pp from public.plan_payments where plan_id = p_plan and paid_at is null order by i limit 1 for update;
  if pp.plan_id is null then raise exception 'Este plan ya está liquidado'; end if;
  update public.plan_payments set paid_at = now(), method = p_method, by_name = p_by, order_id = p_order where plan_id = p_plan and i = pp.i;
  if not exists (select 1 from public.plan_payments where plan_id = p_plan and paid_at is null) then
    update public.plans set status = 'liquidado' where id = p_plan returning * into pl;
    perform public.notify(pl.user_id, 'plan', '¡Terminaste de pagar ' || pl.folio || '!',
      case when pl.kind = 'apartado' then 'Pasa a recoger tu ' || pl.item_name || '.' else 'Gracias por tus pagos puntuales.' end, '/credito', pl.id);
  end if;
  return pp.i;
end $$;
revoke all on function public.mark_installment(uuid, text, text, uuid) from public, anon, authenticated;

-- La tienda cobra un abono en mostrador
create or replace function public.pay_installment(p_plan uuid, p_pin text, p_method text) returns public.orders
language plpgsql security definer set search_path = public as $$
declare pl public.plans; e public.employees; pp public.plan_payments; o public.orders; v_m text := case when p_method in ('cash', 'card', 'zelle') then p_method else 'cash' end;
begin
  select * into pl from public.plans where id = p_plan;
  if pl.id is null or pl.status <> 'activo' then raise exception 'Este plan no está activo'; end if;
  e := public.emp_or_fail(pl.store_id, p_pin);
  select * into pp from public.plan_payments where plan_id = p_plan and paid_at is null order by i limit 1;
  if pp.plan_id is null then raise exception 'Este plan ya está liquidado'; end if;
  insert into public.orders (user_id, store_id, kind, monto, fee, total, status, channel, pay_method, attended_by, attended_name,
                             cliente_nombre, cliente_code, zelle_nombre, paid_at, plan_id, inst, folio_prov)
  values (pl.user_id, pl.store_id, 'abono', pp.amount, 0, pp.amount, 'completado', 'store', v_m, e.id, e.nombre,
          pl.cliente_nombre, pl.cliente_code, '', now(), pl.id, pp.i, pl.folio)
  returning * into o;
  perform public.mark_installment(pl.id, v_m, e.nombre, o.id);
  insert into public.order_events (order_id, act, by_name) values (o.id, 'Cobró abono ' || pp.i || '/' || pl.n || ' de ' || pl.folio, e.nombre);
  perform public.notify(pl.user_id, 'plan', 'Abono ' || pp.i || '/' || pl.n || ' registrado', pl.folio || ' · $' || pp.amount, '/credito', pl.id);
  return o;
end $$;
revoke all on function public.pay_installment(uuid, text, text) from public, anon;
grant execute on function public.pay_installment(uuid, text, text) to authenticated;

-- El cliente paga su abono con Zelle (queda por confirmar como cualquier pedido)
create or replace function public.create_abono_order(p_plan uuid) returns public.orders
language plpgsql security definer set search_path = public as $$
declare pl public.plans; pp public.plan_payments; o public.orders;
begin
  select * into pl from public.plans where id = p_plan and user_id = auth.uid();
  if pl.id is null or pl.status <> 'activo' then raise exception 'Este plan no está activo'; end if;
  select * into pp from public.plan_payments where plan_id = p_plan and paid_at is null order by i limit 1;
  if pp.plan_id is null then raise exception 'Este plan ya está liquidado'; end if;
  select * into o from public.orders where plan_id = p_plan and inst = pp.i and status = 'verificar' limit 1;
  if o.id is not null then return o; end if;
  insert into public.orders (user_id, store_id, kind, monto, fee, total, cliente_nombre, cliente_code, zelle_nombre, plan_id, inst, folio_prov)
  values (pl.user_id, pl.store_id, 'abono', pp.amount, 0, pp.amount, pl.cliente_nombre, pl.cliente_code, pl.cliente_nombre, pl.id, pp.i, pl.folio)
  returning * into o;
  insert into public.order_events (order_id, act, by_name) values (o.id, 'Abono ' || pp.i || '/' || pl.n || ' de ' || pl.folio || ' por Zelle', o.cliente_nombre);
  return o;
end $$;
revoke all on function public.create_abono_order(uuid) from public, anon;
grant execute on function public.create_abono_order(uuid) to authenticated;

-- Cuando la tienda confirma el Zelle de un abono, se marca pagado y queda completado
create or replace function public.abono_paid() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'abono' and new.plan_id is not null and new.channel = 'app' and new.status = 'proceso' and old.status = 'verificar' then
    perform public.mark_installment(new.plan_id, 'zelle', coalesce(new.attended_name, ''), new.id);
    new.status := 'completado';
  end if;
  return new;
end $$;
drop trigger if exists abono_paid on public.orders;
create trigger abono_paid before update of status on public.orders for each row execute function public.abono_paid();

-- ---------------------------------------------------------------------
-- 4. Identificaciones
-- ---------------------------------------------------------------------
create table if not exists public.id_docs (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  tipo         text not null,
  front_path   text not null,
  back_path    text not null,
  submitted_at timestamptz not null default now(),
  reviewed_by  text not null default '',
  reviewed_at  timestamptz,
  note         text not null default ''
);
alter table public.id_docs enable row level security;
drop policy if exists iddocs_read on public.id_docs;
create policy iddocs_read on public.id_docs for select using (
  user_id = auth.uid() or public.is_admin() or public.my_role() = 'tienda'
);
grant select on public.id_docs to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('identificaciones', 'identificaciones', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
drop policy if exists ids_write on storage.objects;
create policy ids_write on storage.objects for insert to authenticated
  with check (bucket_id = 'identificaciones' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists ids_read on storage.objects;
create policy ids_read on storage.objects for select to authenticated using (
  bucket_id = 'identificaciones' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin() or public.my_role() = 'tienda')
);

create or replace function public.submit_id(p_tipo text, p_front text, p_back text) returns void
language plpgsql security definer set search_path = public as $$
declare ok jsonb;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  select id_types into ok from public.settings where id = 1;
  if coalesce((ok->>p_tipo)::boolean, false) = false then raise exception 'Ese tipo de identificación no se acepta'; end if;
  if p_front not like auth.uid()::text || '/%' or p_back not like auth.uid()::text || '/%' then raise exception 'Fotos inválidas'; end if;
  insert into public.id_docs (user_id, tipo, front_path, back_path, submitted_at, reviewed_by, reviewed_at, note)
  values (auth.uid(), p_tipo, p_front, p_back, now(), '', null, '')
  on conflict (user_id) do update set tipo = excluded.tipo, front_path = excluded.front_path, back_path = excluded.back_path,
    submitted_at = now(), reviewed_by = '', reviewed_at = null, note = '';
  perform set_config('castillo.bypass', '1', true);
  update public.profiles set id_status = 'pendiente' where id = auth.uid();
  perform set_config('castillo.bypass', '', true);
  perform public.notify_staff((select store_id from public.profiles where id = auth.uid()), 'id', 'Identificación por revisar',
    (select trim(nombre || ' ' || apellidos) from public.profiles where id = auth.uid()), '/tienda/identificaciones', auth.uid());
end $$;
revoke all on function public.submit_id(text, text, text) from public, anon;
grant execute on function public.submit_id(text, text, text) to authenticated;

create or replace function public.review_id(p_user uuid, p_ok boolean, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare who text;
begin
  if not (public.is_admin() or public.my_role() = 'tienda') then raise exception 'Sin permiso'; end if;
  select trim(nombre || ' ' || apellidos) into who from public.profiles where id = auth.uid();
  update public.id_docs set reviewed_by = coalesce(who, ''), reviewed_at = now(), note = coalesce(p_note, '') where user_id = p_user;
  if not found then raise exception 'No hay identificación de ese cliente'; end if;
  perform set_config('castillo.bypass', '1', true);
  update public.profiles set id_status = case when p_ok then 'verificada' else 'rechazada' end where id = p_user;
  perform set_config('castillo.bypass', '', true);
  perform public.notify(p_user, 'id', case when p_ok then '¡Tu identificación fue verificada!' else 'No pudimos verificar tu identificación' end,
    case when p_ok then 'Ya puedes enviar montos más altos.' else coalesce(nullif(p_note, ''), 'Sube fotos más claras o pasa a tu tienda.') end, '/identidad', null);
end $$;
revoke all on function public.review_id(uuid, boolean, text) from public, anon;
grant execute on function public.review_id(uuid, boolean, text) to authenticated;

-- Lista de identificaciones (con datos del cliente) para la tienda
create or replace function public.pending_ids(p_all boolean default false)
returns table (user_id uuid, nombre text, member_code text, fecha_nac date, id_status text, tipo text, front_path text, back_path text, submitted_at timestamptz, reviewed_by text, reviewed_at timestamptz, note text)
language sql stable security definer set search_path = public as $$
  select d.user_id, trim(p.nombre || ' ' || p.apellidos), p.member_code, p.fecha_nac, p.id_status, d.tipo, d.front_path, d.back_path, d.submitted_at, d.reviewed_by, d.reviewed_at, d.note
  from public.id_docs d join public.profiles p on p.id = d.user_id
  where (public.is_admin() or public.my_role() = 'tienda') and (p_all or p.id_status = 'pendiente')
  order by d.submitted_at desc
  limit 300
$$;
grant execute on function public.pending_ids(boolean) to authenticated;

-- ---------------------------------------------------------------------
-- 5. Clientes de una tienda
-- ---------------------------------------------------------------------
create or replace function public.store_customers(p_store uuid)
returns table (user_id uuid, nombre text, member_code text, telefono text, foto_url text, id_status text, favorita boolean,
               pedidos bigint, gastado numeric, ultimo timestamptz, puntos int, planes bigint, credito_on boolean, credito_limite numeric)
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
         coalesce((select cl.limite from public.credit_lines cl where cl.user_id = c.id and cl.store_id = p_store), 0)
  from c
  where public.is_store_staff(p_store)
  order by 10 desc nulls last
  limit 2000
$$;
grant execute on function public.store_customers(uuid) to authenticated;

-- Trazabilidad
do $$
declare t text;
begin
  if to_regprocedure('public.audit_row()') is not null then
    foreach t in array array['plans', 'credit_lines', 'id_docs'] loop
      execute format('drop trigger if exists audit_%1$s on public.%1$I', t);
      execute format('create trigger audit_%1$s after insert or update or delete on public.%1$I for each row execute function public.audit_row()', t);
    end loop;
  end if;
end $$;
