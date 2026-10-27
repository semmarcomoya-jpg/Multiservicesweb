-- =====================================================================
-- Castillo Multiservices · Fase 1 · Esquema base
-- Tablas, funciones, seguridad (RLS) y almacenamiento.
-- Ejecutar en Supabase → SQL Editor (o `supabase db push`).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Tiendas
-- ---------------------------------------------------------------------
create table if not exists public.stores (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null,
  direccion     text not null default '',
  ciudad        text not null default '',
  horario       text not null default '',
  telefono      text not null default '',
  descripcion   text not null default '',
  zelle_dato    text not null default '',          -- correo o teléfono de Zelle
  zelle_nombre  text not null default '',          -- nombre que ve el cliente en Zelle
  fotos         text[] not null default '{}',
  -- funciones que la tienda prende o apaga
  mods          jsonb not null default '{"send":true,"svc":true,"shop":true,"credit":false,"layaway":false,"comm":true}',
  -- formas de entrega
  delivery      jsonb not null default '{"pickup":true,"curb":true,"home":false,"homeFee":5,"freeOver":0,"slots":"10:00, 12:00, 14:00, 16:00, 18:00","zips":""}',
  svc_off       uuid[] not null default '{}',      -- servicios del catálogo que esta tienda NO ofrece
  activo        boolean not null default true,      -- false = oculta (solo el admin la ve)
  abierta       boolean not null default true,      -- la tienda abre o cierra (no recibe pedidos nuevos)
  aviso_cerrada text not null default '',           -- mensaje para el cliente cuando está cerrada
  orden         int not null default 0,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Perfiles (1 a 1 con auth.users)
-- role: cliente | tienda (cuenta del mostrador de una sucursal) | admin
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  nombre        text not null default '',
  apellidos     text not null default '',
  telefono      text not null default '',
  fecha_nac     date,
  foto_url      text,
  idioma        text not null default 'es' check (idioma in ('es','en')),
  member_code   text unique,
  role          text not null default 'cliente' check (role in ('cliente','tienda','admin')),
  store_id      uuid references public.stores(id) on delete set null,   -- tienda de la cuenta 'tienda' o tienda favorita del cliente
  id_status     text not null default 'ninguna' check (id_status in ('ninguna','pendiente','verificada','rechazada')),
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Empleados (cada uno con su clave). La clave se guarda cifrada.
-- ---------------------------------------------------------------------
create table if not exists public.employees (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid references public.stores(id) on delete cascade,   -- null = administrador (todas las tiendas)
  nombre      text not null,
  pin_hash    text not null,
  rol         text not null default 'tienda' check (rol in ('tienda','admin')),
  activo      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Catálogo de servicios (lo define el administrador)
-- ---------------------------------------------------------------------
create table if not exists public.service_categories (
  id     text primary key,
  es     text not null,
  en     text not null,
  icon   text not null default 'tool',
  orden  int not null default 0
);

create table if not exists public.services (
  id          uuid primary key default gen_random_uuid(),
  cat_id      text not null references public.service_categories(id),
  es          text not null,
  en          text not null,
  desc_es     text not null default '',
  desc_en     text not null default '',
  icon        text not null default 'tool',
  price_type  text not null default 'fixed' check (price_type in ('fixed','amount','options')),
  base        numeric(10,2) not null default 0,         -- precio fijo
  amounts     numeric(10,2)[] not null default '{}',    -- montos sugeridos
  options     jsonb not null default '[]',              -- [{es,en,p}]
  fee         numeric(10,2) not null default 0,         -- comisión
  fields      jsonb not null default '[]',              -- [{k,es,en,type:'text'|'tel'|'select'|'photo',opts,digits,optional}]
  modes       text[] not null default '{digital}',      -- digital | store | curb | home
  eta_es      text not null default '',
  eta_en      text not null default '',
  points      boolean not null default true,
  activo      boolean not null default true,
  orden       int not null default 0,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Configuración general (una sola fila)
-- ---------------------------------------------------------------------
create table if not exists public.settings (
  id              int primary key default 1 check (id = 1),
  exchange_rate   numeric(10,4) not null default 18.50,  -- MXN por 1 USD
  rate_updated_at timestamptz not null default now(),
  send_fee        numeric(10,2) not null default 4.99,
  limit_l1        numeric(10,2) not null default 300,    -- máximo por envío sin identificación verificada
  limit_l2        numeric(10,2) not null default 1000,   -- máximo por envío con identificación verificada
  proveedor       text not null default 'Remesadora',
  brand           jsonb not null default '{"nombre":"Castillo Multiservices","corto":"Castillo"}'
);
insert into public.settings (id) values (1) on conflict do nothing;

-- ---------------------------------------------------------------------
-- Beneficiarios en México
-- ---------------------------------------------------------------------
create table if not exists public.beneficiaries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  nombre      text not null,
  apellidos   text not null default '',
  parentesco  text not null default '',
  telefono    text not null default '',
  estado      text not null default '',
  ciudad      text not null default '',
  metodo      text not null check (metodo in ('cuenta','efectivo')),
  banco       text not null default '',
  cuenta      text not null default '',     -- CLABE (18) o tarjeta (16)
  red         text not null default '',     -- red de retiro en efectivo
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Pedidos
-- ---------------------------------------------------------------------
create sequence if not exists public.order_folio_seq start 1001;

create table if not exists public.orders (
  id            uuid primary key default gen_random_uuid(),
  folio         text not null unique default ('A-' || nextval('public.order_folio_seq')),
  user_id       uuid not null references auth.users(id) on delete restrict,
  store_id      uuid not null references public.stores(id),
  kind          text not null check (kind in ('send','service','shop','abono')),
  service_id    uuid references public.services(id),
  service_name  jsonb,                 -- {es,en,icon,cat,opcion}
  data          jsonb not null default '[]',   -- respuestas del cliente [{k,es,en,type,value}]
  beneficiary   jsonb,                 -- copia del beneficiario al momento del envío
  monto         numeric(10,2) not null,
  fee           numeric(10,2) not null default 0,
  total         numeric(10,2) not null,
  rate          numeric(10,4),
  mxn           numeric(12,2),
  status        text not null default 'verificar' check (status in ('verificar','proceso','completado','rechazado')),
  captura_path  text,                  -- captura del pago Zelle (bucket capturas)
  ticket_path   text,                  -- comprobante de la tienda (bucket comprobantes)
  folio_prov    text not null default '',
  entrega       jsonb,                 -- {mode, time, address, zip}
  code          text,                  -- código de entrega de 4 dígitos
  attended_by   uuid references public.employees(id),
  attended_name text,
  cliente_nombre text not null default '',
  cliente_code   text not null default '',
  zelle_nombre   text not null default '',
  reject_reason  text not null default '',
  items          jsonb,                -- productos [{product_id, variant_id, name, label, qty, price}]
  paid_at        timestamptz,          -- cuándo la tienda confirmó el pago
  corte_id       uuid,                 -- corte de caja en el que se contó
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists orders_store_idx on public.orders (store_id, created_at desc);
create index if not exists orders_user_idx  on public.orders (user_id, created_at desc);

create table if not exists public.order_events (
  id         bigserial primary key,
  order_id   uuid not null references public.orders(id) on delete cascade,
  act        text not null,
  by_name    text not null default '',
  created_at timestamptz not null default now()
);

-- =====================================================================
-- Funciones auxiliares
-- =====================================================================
create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'cliente')
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select public.my_role() = 'admin'
$$;

-- ¿La cuenta actual puede operar la tienda indicada?
create or replace function public.is_store_staff(p_store uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and (role = 'admin' or (role = 'tienda' and store_id = p_store))
  )
$$;

-- Perfil automático al registrarse
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_code text;
begin
  loop
    v_code := 'CM-' || lpad((floor(random() * 1000000))::int::text, 6, '0');
    exit when not exists (select 1 from public.profiles where member_code = v_code);
  end loop;
  insert into public.profiles (id, nombre, apellidos, telefono, idioma, member_code)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', ''),
    coalesce(new.raw_user_meta_data->>'apellidos', ''),
    coalesce(new.raw_user_meta_data->>'telefono', ''),
    case when new.raw_user_meta_data->>'idioma' = 'en' then 'en' else 'es' end,
    v_code
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- El cliente no puede cambiarse el rol, la tienda asignada ni el estado de su identificación
create or replace function public.protect_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- auth.uid() nulo = SQL Editor o service_role (permitido)
  if auth.uid() is not null and not public.is_admin() then
    new.role := old.role;
    new.member_code := old.member_code;
    new.id_status := old.id_status;
    if old.role = 'tienda' then new.store_id := old.store_id; end if;
  end if;
  return new;
end $$;
drop trigger if exists protect_profile on public.profiles;
create trigger protect_profile before update on public.profiles
  for each row execute function public.protect_profile();

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
drop trigger if exists orders_touch on public.orders;
create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();

-- =====================================================================
-- Seguridad por filas (RLS)
-- =====================================================================
alter table public.stores             enable row level security;
alter table public.profiles           enable row level security;
alter table public.employees          enable row level security;
alter table public.service_categories enable row level security;
alter table public.services           enable row level security;
alter table public.settings           enable row level security;
alter table public.beneficiaries      enable row level security;
alter table public.orders             enable row level security;
alter table public.order_events       enable row level security;

-- Tiendas: todos ven las activas; el admin todo; la tienda edita la suya
drop policy if exists stores_read on public.stores;
create policy stores_read on public.stores for select using (activo or public.is_store_staff(id));
drop policy if exists stores_admin on public.stores;
create policy stores_admin on public.stores for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists stores_staff_update on public.stores;
create policy stores_staff_update on public.stores for update using (public.is_store_staff(id)) with check (public.is_store_staff(id));

-- Perfiles: cada quien el suyo; admin todos; la tienda ve a sus clientes por sus pedidos
drop policy if exists profiles_self on public.profiles;
create policy profiles_self on public.profiles for select using (
  id = auth.uid() or public.is_admin()
  or exists (select 1 from public.orders o where o.user_id = profiles.id and public.is_store_staff(o.store_id))
);
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

-- Empleados: solo el admin los ve y administra (la clave nunca sale cifrada al cliente)
drop policy if exists employees_admin on public.employees;
create policy employees_admin on public.employees for all using (public.is_admin()) with check (public.is_admin());

-- Catálogo y configuración: lectura pública, escritura admin
drop policy if exists cats_read on public.service_categories;
create policy cats_read on public.service_categories for select using (true);
drop policy if exists cats_admin on public.service_categories;
create policy cats_admin on public.service_categories for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists services_read on public.services;
create policy services_read on public.services for select using (activo or public.is_admin());
drop policy if exists services_admin on public.services;
create policy services_admin on public.services for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists settings_read on public.settings;
create policy settings_read on public.settings for select using (true);
drop policy if exists settings_admin on public.settings;
create policy settings_admin on public.settings for update using (public.is_admin()) with check (public.is_admin());

-- Beneficiarios: solo su dueño
drop policy if exists benef_owner on public.beneficiaries;
create policy benef_owner on public.beneficiaries for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Pedidos: el cliente ve los suyos; la tienda los de su sucursal. Se crean y cambian solo por funciones.
drop policy if exists orders_read on public.orders;
create policy orders_read on public.orders for select using (user_id = auth.uid() or public.is_store_staff(store_id));
drop policy if exists events_read on public.order_events;
create policy events_read on public.order_events for select using (
  exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_store_staff(o.store_id)))
);

-- =====================================================================
-- Funciones de negocio (el servidor calcula montos y valida pasos)
-- =====================================================================

-- Crear pedido de envío a México
create or replace function public.create_send_order(
  p_store uuid, p_beneficiary uuid, p_monto numeric, p_captura text, p_zelle_nombre text
) returns public.orders
language plpgsql security definer set search_path = public as $$
declare
  st public.stores; b public.beneficiaries; cfg public.settings; pr public.profiles; o public.orders; v_limit numeric;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  select * into st from public.stores where id = p_store and activo;
  if st.id is null or coalesce((st.mods->>'send')::boolean, true) = false then raise exception 'Esta tienda no ofrece envíos'; end if;
  if not st.abierta then raise exception 'La tienda está cerrada en este momento'; end if;
  select * into b from public.beneficiaries where id = p_beneficiary and user_id = auth.uid();
  if b.id is null then raise exception 'Beneficiario no encontrado'; end if;
  select * into cfg from public.settings where id = 1;
  select * into pr from public.profiles where id = auth.uid();
  if p_monto is null or p_monto <= 0 then raise exception 'Monto inválido'; end if;
  v_limit := case when pr.id_status = 'verificada' then cfg.limit_l2 else cfg.limit_l1 end;
  if p_monto > v_limit then raise exception 'El monto supera tu límite de % USD', v_limit; end if;
  if p_captura is null or p_captura not like auth.uid()::text || '/%' then raise exception 'Falta la captura del pago'; end if;

  insert into public.orders (user_id, store_id, kind, beneficiary, monto, fee, total, rate, mxn, captura_path,
                             cliente_nombre, cliente_code, zelle_nombre)
  values (auth.uid(), p_store, 'send', to_jsonb(b) - 'user_id', p_monto, cfg.send_fee, p_monto + cfg.send_fee,
          cfg.exchange_rate, round(p_monto * cfg.exchange_rate, 2), p_captura,
          trim(pr.nombre || ' ' || pr.apellidos), coalesce(pr.member_code, ''), coalesce(nullif(p_zelle_nombre, ''), trim(pr.nombre || ' ' || pr.apellidos)))
  returning * into o;
  insert into public.order_events (order_id, act, by_name) values (o.id, 'Pedido enviado por el cliente', o.cliente_nombre);
  return o;
end $$;

-- Crear pedido de servicio del catálogo
create or replace function public.create_service_order(
  p_store uuid, p_service uuid, p_option int, p_amount numeric, p_data jsonb,
  p_entrega jsonb, p_captura text, p_zelle_nombre text
) returns public.orders
language plpgsql security definer set search_path = public as $$
declare
  st public.stores; sv public.services; pr public.profiles; o public.orders;
  v_base numeric; v_opt jsonb; v_mode text; v_fee numeric; v_code text;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  select * into st from public.stores where id = p_store and activo;
  if st.id is null or coalesce((st.mods->>'svc')::boolean, true) = false then raise exception 'Esta tienda no ofrece servicios'; end if;
  if not st.abierta then raise exception 'La tienda está cerrada en este momento'; end if;
  select * into sv from public.services where id = p_service and activo;
  if sv.id is null or sv.id = any(st.svc_off) then raise exception 'Servicio no disponible en esta tienda'; end if;
  select * into pr from public.profiles where id = auth.uid();

  if sv.price_type = 'fixed' then v_base := sv.base;
  elsif sv.price_type = 'options' then
    v_opt := sv.options -> p_option;
    if v_opt is null then raise exception 'Elige una opción'; end if;
    v_base := (v_opt->>'p')::numeric;
  else
    v_base := p_amount;
  end if;
  if v_base is null or v_base <= 0 then raise exception 'Monto inválido'; end if;

  v_mode := coalesce(p_entrega->>'mode', sv.modes[1]);
  if not (v_mode = any(sv.modes)) then raise exception 'Forma de entrega no disponible'; end if;
  v_fee := sv.fee;
  if v_mode = 'home' then
    if coalesce((st.delivery->>'home')::boolean, false) = false then raise exception 'La tienda no entrega a domicilio'; end if;
    if not (coalesce((st.delivery->>'freeOver')::numeric, 0) > 0 and v_base >= (st.delivery->>'freeOver')::numeric) then
      v_fee := v_fee + coalesce((st.delivery->>'homeFee')::numeric, 0);
    end if;
  end if;
  if v_mode <> 'digital' then v_code := lpad((floor(random() * 10000))::int::text, 4, '0'); end if;
  if p_captura is null or p_captura not like auth.uid()::text || '/%' then raise exception 'Falta la captura del pago'; end if;

  insert into public.orders (user_id, store_id, kind, service_id, service_name, data, monto, fee, total, entrega, code,
                             captura_path, cliente_nombre, cliente_code, zelle_nombre)
  values (auth.uid(), p_store, 'service', sv.id,
          jsonb_build_object('es', sv.es, 'en', sv.en, 'icon', sv.icon, 'cat', sv.cat_id,
                             'opcion', case when v_opt is null then null else jsonb_build_object('es', v_opt->>'es', 'en', v_opt->>'en') end),
          coalesce(p_data, '[]'::jsonb), v_base, v_fee, v_base + v_fee,
          jsonb_build_object('mode', v_mode, 'time', p_entrega->>'time', 'address', p_entrega->>'address', 'zip', p_entrega->>'zip'),
          v_code, p_captura, trim(pr.nombre || ' ' || pr.apellidos), coalesce(pr.member_code, ''),
          coalesce(nullif(p_zelle_nombre, ''), trim(pr.nombre || ' ' || pr.apellidos)))
  returning * into o;
  insert into public.order_events (order_id, act, by_name) values (o.id, 'Pedido enviado por el cliente', o.cliente_nombre);
  return o;
end $$;

-- Validar la clave de un empleado para una tienda (no expone nada más que el nombre)
create or replace function public.check_employee_pin(p_store uuid, p_pin text)
returns table (id uuid, nombre text)
language sql stable security definer set search_path = public, extensions as $$
  select e.id, e.nombre from public.employees e
  where public.is_store_staff(p_store)
    and e.activo
    and (e.rol = 'admin' or e.store_id = p_store)
    and e.pin_hash = crypt(p_pin, e.pin_hash)
  limit 1
$$;

-- El empleado toma el pedido con su clave
create or replace function public.take_order(p_order uuid, p_pin text) returns public.orders
language plpgsql security definer set search_path = public as $$
declare o public.orders; e record;
begin
  select * into o from public.orders where id = p_order;
  if o.id is null or not public.is_store_staff(o.store_id) then raise exception 'Sin permiso'; end if;
  select * into e from public.check_employee_pin(o.store_id, p_pin);
  if e.id is null then raise exception 'Clave incorrecta o de otra sucursal'; end if;
  update public.orders set attended_by = e.id, attended_name = e.nombre where id = p_order returning * into o;
  insert into public.order_events (order_id, act, by_name) values (o.id, 'Tomó el pedido', e.nombre);
  return o;
end $$;

-- Cambiar el estado del pedido (tienda)
create or replace function public.advance_order(
  p_order uuid, p_status text, p_folio_prov text default null, p_ticket text default null,
  p_code text default null, p_reason text default null
) returns public.orders
language plpgsql security definer set search_path = public as $$
declare o public.orders; v_act text;
begin
  select * into o from public.orders where id = p_order for update;
  if o.id is null or not public.is_store_staff(o.store_id) then raise exception 'Sin permiso'; end if;
  if o.attended_by is null then raise exception 'Primero escribe tu clave de empleado'; end if;

  if p_status = 'proceso' and o.status = 'verificar' then
    v_act := 'Verificó el pago';
  elsif p_status = 'rechazado' and o.status in ('verificar','proceso') then
    v_act := 'Rechazó el pedido';
  elsif p_status = 'completado' and o.status = 'proceso' then
    if o.kind = 'send' and coalesce(nullif(trim(coalesce(p_folio_prov, o.folio_prov)), ''), '') = '' then
      raise exception 'Falta el folio del envío';
    end if;
    if o.code is not null and coalesce(o.entrega->>'mode', 'digital') <> 'digital' then
      if coalesce(p_code, '') <> o.code then raise exception 'El código de entrega no coincide'; end if;
    elsif coalesce(p_ticket, o.ticket_path) is null then
      raise exception 'Falta la foto del comprobante';
    end if;
    v_act := 'Completó y envió comprobante';
  else
    raise exception 'Cambio de estado no permitido (% → %)', o.status, p_status;
  end if;

  update public.orders set
    status = p_status,
    folio_prov = coalesce(p_folio_prov, folio_prov),
    ticket_path = coalesce(p_ticket, ticket_path),
    reject_reason = coalesce(p_reason, reject_reason)
  where id = p_order returning * into o;
  insert into public.order_events (order_id, act, by_name) values (o.id, v_act, o.attended_name);
  return o;
end $$;

-- El cliente avisa que ya llegó (recoger sin bajarse del carro)
create or replace function public.mark_arrived(p_order uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.orders set entrega = coalesce(entrega, '{}'::jsonb) || '{"arrived":true}'
  where id = p_order and user_id = auth.uid();
  insert into public.order_events (order_id, act, by_name)
  select id, 'El cliente ya llegó', cliente_nombre from public.orders where id = p_order and user_id = auth.uid();
end $$;

-- Administración de empleados (la clave se cifra en el servidor)
create or replace function public.admin_save_employee(
  p_id uuid, p_nombre text, p_store uuid, p_rol text, p_activo boolean, p_pin text
) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid;
begin
  if not public.is_admin() then raise exception 'Solo el administrador'; end if;
  if p_pin is not null and p_pin !~ '^\d{4,6}$' then raise exception 'La clave debe tener de 4 a 6 dígitos'; end if;
  if p_pin is not null and exists (
    select 1 from public.employees where activo and pin_hash = crypt(p_pin, pin_hash) and id is distinct from p_id
  ) then raise exception 'Esa clave ya la usa otro empleado'; end if;
  if p_id is null then
    if p_pin is null then raise exception 'Falta la clave'; end if;
    insert into public.employees (nombre, store_id, rol, activo, pin_hash)
    values (p_nombre, case when p_rol = 'admin' then null else p_store end, p_rol, coalesce(p_activo, true), crypt(p_pin, gen_salt('bf')))
    returning id into v_id;
  else
    update public.employees set
      nombre = p_nombre,
      store_id = case when p_rol = 'admin' then null else p_store end,
      rol = p_rol,
      activo = coalesce(p_activo, activo),
      pin_hash = case when p_pin is null then pin_hash else crypt(p_pin, gen_salt('bf')) end
    where id = p_id returning id into v_id;
  end if;
  return v_id;
end $$;

-- Asignar rol a una cuenta por su número de cliente o correo (admin)
create or replace function public.admin_set_role(p_lookup text, p_role text, p_store uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.is_admin() then raise exception 'Solo el administrador'; end if;
  select p.id into v_id from public.profiles p join auth.users u on u.id = p.id
  where upper(p.member_code) = upper(trim(p_lookup)) or lower(u.email) = lower(trim(p_lookup));
  if v_id is null then raise exception 'No encontramos esa cuenta'; end if;
  update public.profiles set role = p_role, store_id = case when p_role = 'tienda' then p_store else store_id end where id = v_id;
end $$;

-- Permisos de ejecución
revoke all on function public.create_send_order(uuid, uuid, numeric, text, text) from public, anon;
revoke all on function public.create_service_order(uuid, uuid, int, numeric, jsonb, jsonb, text, text) from public, anon;
revoke all on function public.check_employee_pin(uuid, text) from public, anon;
revoke all on function public.take_order(uuid, text) from public, anon;
revoke all on function public.advance_order(uuid, text, text, text, text, text) from public, anon;
revoke all on function public.mark_arrived(uuid) from public, anon;
revoke all on function public.admin_save_employee(uuid, text, uuid, text, boolean, text) from public, anon;
revoke all on function public.admin_set_role(text, text, uuid) from public, anon;
grant execute on function public.create_send_order(uuid, uuid, numeric, text, text) to authenticated;
grant execute on function public.create_service_order(uuid, uuid, int, numeric, jsonb, jsonb, text, text) to authenticated;
grant execute on function public.check_employee_pin(uuid, text) to authenticated;
grant execute on function public.take_order(uuid, text) to authenticated;
grant execute on function public.advance_order(uuid, text, text, text, text, text) to authenticated;
grant execute on function public.mark_arrived(uuid) to authenticated;
grant execute on function public.admin_save_employee(uuid, text, uuid, text, boolean, text) to authenticated;
grant execute on function public.admin_set_role(text, text, uuid) to authenticated;

-- =====================================================================
-- Almacenamiento
--   capturas:     captura del pago del cliente  → carpeta {user_id}/...
--   comprobantes: foto del comprobante que sube la tienda → carpeta {store_id}/...
--   publico:      fotos de tiendas, logo, portadas (lectura pública)
-- =====================================================================
insert into storage.buckets (id, name, public) values ('capturas', 'capturas', false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('comprobantes', 'comprobantes', false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('publico', 'publico', true) on conflict (id) do nothing;

drop policy if exists capturas_insert on storage.objects;
create policy capturas_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'capturas' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists capturas_read on storage.objects;
create policy capturas_read on storage.objects for select to authenticated using (
  bucket_id = 'capturas' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (select 1 from public.orders o
               where o.user_id::text = (storage.foldername(name))[1] and public.is_store_staff(o.store_id))
  )
);

drop policy if exists comprobantes_insert on storage.objects;
create policy comprobantes_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'comprobantes' and public.is_store_staff(((storage.foldername(name))[1])::uuid));
drop policy if exists comprobantes_read on storage.objects;
create policy comprobantes_read on storage.objects for select to authenticated using (
  bucket_id = 'comprobantes' and (
    public.is_store_staff(((storage.foldername(name))[1])::uuid)
    or exists (select 1 from public.orders o where o.ticket_path = name and o.user_id = auth.uid())
  )
);

drop policy if exists publico_write on storage.objects;
create policy publico_write on storage.objects for insert to authenticated
  with check (bucket_id = 'publico' and (public.is_admin() or public.my_role() = 'tienda'));

-- Tiempo real para que la tienda vea pedidos nuevos al instante
do $$ begin
  alter publication supabase_realtime add table public.orders;
exception when others then null; end $$;
