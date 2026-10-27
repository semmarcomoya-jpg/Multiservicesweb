-- =====================================================================
-- Castillo Multiservices · Productos (se prenden y apagan) y corte de caja
-- =====================================================================

-- ---------------------------------------------------------------------
-- Catálogo de productos por tienda: familia → marca → modelo → variantes
-- ---------------------------------------------------------------------
create table if not exists public.product_families (
  id     text primary key,
  es     text not null,
  en     text not null,
  icon   text not null default 'bag',
  orden  int not null default 0
);

create table if not exists public.products (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid not null references public.stores(id) on delete cascade,
  family_id   text not null references public.product_families(id),
  marca       text not null default '',
  modelo      text not null,
  descripcion text not null default '',
  compat      text not null default '',     -- para accesorios: con qué modelos funciona
  foto_url    text,
  activo      boolean not null default true, -- prendido / apagado
  orden       int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists products_store_idx on public.products (store_id, orden);

create table if not exists public.product_variants (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  label       text not null default 'Estándar',   -- color, capacidad…
  price       numeric(10,2) not null check (price >= 0),
  stock       int not null default 0 check (stock >= 0),
  activo      boolean not null default true,
  orden       int not null default 0
);
create index if not exists variants_product_idx on public.product_variants (product_id, orden);

-- ---------------------------------------------------------------------
-- Cortes de caja (ventas cobradas por la app)
-- ---------------------------------------------------------------------
create table if not exists public.cortes (
  id             uuid primary key default gen_random_uuid(),
  store_id       uuid not null references public.stores(id) on delete cascade,
  desde          timestamptz,
  hasta          timestamptz not null default now(),
  employee_id    uuid references public.employees(id),
  employee_name  text not null default '',
  n_orders       int not null default 0,
  total          numeric(12,2) not null default 0,
  fees           numeric(12,2) not null default 0,
  resumen        jsonb not null default '{}',    -- {por_tipo:{...}, por_empleado:{...}}
  notas          text not null default '',
  created_at     timestamptz not null default now()
);
create index if not exists cortes_store_idx on public.cortes (store_id, hasta desc);

do $$ begin
  alter table public.orders add constraint orders_corte_fk foreign key (corte_id) references public.cortes(id);
exception when duplicate_object then null; end $$;
create index if not exists orders_corte_idx on public.orders (store_id, corte_id, paid_at);

-- ---------------------------------------------------------------------
-- Seguridad
-- ---------------------------------------------------------------------
alter table public.product_families enable row level security;
alter table public.products         enable row level security;
alter table public.product_variants enable row level security;
alter table public.cortes           enable row level security;

drop policy if exists fam_read on public.product_families;
create policy fam_read on public.product_families for select using (true);
drop policy if exists fam_admin on public.product_families;
create policy fam_admin on public.product_families for all using (public.is_admin()) with check (public.is_admin());

-- Clientes: solo productos prendidos de tiendas activas. Tienda: todos los suyos.
drop policy if exists products_read on public.products;
create policy products_read on public.products for select using (
  public.is_store_staff(store_id)
  or (activo and exists (select 1 from public.stores s where s.id = store_id and s.activo))
);
drop policy if exists products_staff on public.products;
create policy products_staff on public.products for all using (public.is_store_staff(store_id)) with check (public.is_store_staff(store_id));

drop policy if exists variants_read on public.product_variants;
create policy variants_read on public.product_variants for select using (
  exists (select 1 from public.products p where p.id = product_id and (public.is_store_staff(p.store_id) or (p.activo and activo)))
);
drop policy if exists variants_staff on public.product_variants;
create policy variants_staff on public.product_variants for all
  using (exists (select 1 from public.products p where p.id = product_id and public.is_store_staff(p.store_id)))
  with check (exists (select 1 from public.products p where p.id = product_id and public.is_store_staff(p.store_id)));

drop policy if exists cortes_read on public.cortes;
create policy cortes_read on public.cortes for select using (public.is_store_staff(store_id));

-- Fotos de productos: bucket público, carpeta {store_id}/...
drop policy if exists publico_read on storage.objects;
create policy publico_read on storage.objects for select using (bucket_id = 'publico');

-- ---------------------------------------------------------------------
-- Crear pedido de productos (el servidor calcula precios y aparta existencias)
-- p_items: [{"variant_id": "...", "qty": 1}, ...]
-- ---------------------------------------------------------------------
create or replace function public.create_shop_order(
  p_store uuid, p_items jsonb, p_entrega jsonb, p_captura text, p_zelle_nombre text
) returns public.orders
language plpgsql security definer set search_path = public as $$
declare
  st public.stores; pr public.profiles; o public.orders;
  it jsonb; v record; v_qty int; v_sub numeric := 0; v_lines jsonb := '[]'::jsonb;
  v_mode text; v_fee numeric := 0; v_code text;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  select * into st from public.stores where id = p_store and activo;
  if st.id is null or coalesce((st.mods->>'shop')::boolean, true) = false then raise exception 'Esta tienda no vende productos por la app'; end if;
  if not st.abierta then raise exception 'La tienda está cerrada en este momento'; end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then raise exception 'Tu carrito está vacío'; end if;
  if p_captura is null or p_captura not like auth.uid()::text || '/%' then raise exception 'Falta la captura del pago'; end if;
  select * into pr from public.profiles where id = auth.uid();

  for it in select * from jsonb_array_elements(p_items) loop
    v_qty := coalesce((it->>'qty')::int, 0);
    if v_qty < 1 or v_qty > 20 then raise exception 'Cantidad inválida'; end if;
    select pv.id, pv.label, pv.price, pv.stock, pv.activo as v_on, p.id as pid, p.activo as p_on, p.store_id,
           trim(p.marca || ' ' || p.modelo) as name
      into v
      from public.product_variants pv join public.products p on p.id = pv.product_id
     where pv.id = (it->>'variant_id')::uuid
     for update of pv;
    if v.id is null or v.store_id <> p_store then raise exception 'Producto no encontrado en esta tienda'; end if;
    if not v.v_on or not v.p_on then raise exception '% ya no está disponible', v.name; end if;
    if v.stock < v_qty then raise exception 'Solo quedan % de %', v.stock, v.name || ' ' || v.label; end if;
    update public.product_variants set stock = stock - v_qty where id = v.id;
    v_sub := v_sub + v.price * v_qty;
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'product_id', v.pid, 'variant_id', v.id, 'name', v.name, 'label', v.label, 'qty', v_qty, 'price', v.price));
  end loop;

  v_mode := coalesce(p_entrega->>'mode', 'store');
  if v_mode = 'store' and coalesce((st.delivery->>'pickup')::boolean, true) = false then raise exception 'La tienda no tiene recoger en tienda'; end if;
  if v_mode = 'curb' and coalesce((st.delivery->>'curb')::boolean, true) = false then raise exception 'La tienda no entrega en el carro'; end if;
  if v_mode = 'home' then
    if coalesce((st.delivery->>'home')::boolean, false) = false then raise exception 'La tienda no entrega a domicilio'; end if;
    if not (coalesce((st.delivery->>'freeOver')::numeric, 0) > 0 and v_sub >= (st.delivery->>'freeOver')::numeric) then
      v_fee := coalesce((st.delivery->>'homeFee')::numeric, 0);
    end if;
  end if;
  if v_mode not in ('store','curb','home') then raise exception 'Forma de entrega no disponible'; end if;
  v_code := lpad((floor(random() * 10000))::int::text, 4, '0');

  insert into public.orders (user_id, store_id, kind, items, monto, fee, total, entrega, code, captura_path,
                             cliente_nombre, cliente_code, zelle_nombre)
  values (auth.uid(), p_store, 'shop', v_lines, v_sub, v_fee, v_sub + v_fee,
          jsonb_build_object('mode', v_mode, 'time', p_entrega->>'time', 'address', p_entrega->>'address', 'zip', p_entrega->>'zip'),
          v_code, p_captura, trim(pr.nombre || ' ' || pr.apellidos), coalesce(pr.member_code, ''),
          coalesce(nullif(p_zelle_nombre, ''), trim(pr.nombre || ' ' || pr.apellidos)))
  returning * into o;
  insert into public.order_events (order_id, act, by_name) values (o.id, 'Pedido enviado por el cliente', o.cliente_nombre);
  return o;
end $$;

-- Al confirmar el pago se marca la hora (para el corte); si se rechaza un pedido de productos se regresan las existencias
create or replace function public.orders_status_side_effects() returns trigger
language plpgsql security definer set search_path = public as $$
declare it jsonb;
begin
  if new.status = 'proceso' and old.status = 'verificar' and new.paid_at is null then
    new.paid_at := now();
  end if;
  if new.status = 'rechazado' and old.status <> 'rechazado' and new.kind = 'shop' and new.items is not null then
    for it in select * from jsonb_array_elements(new.items) loop
      update public.product_variants set stock = stock + (it->>'qty')::int where id = (it->>'variant_id')::uuid;
    end loop;
  end if;
  return new;
end $$;
drop trigger if exists orders_status_side_effects on public.orders;
create trigger orders_status_side_effects before update of status on public.orders
  for each row execute function public.orders_status_side_effects();

-- ---------------------------------------------------------------------
-- Hacer corte: junta lo cobrado desde el último corte, lo resume y lo marca
-- ---------------------------------------------------------------------
create or replace function public.make_corte(p_store uuid, p_pin text, p_notas text default '')
returns public.cortes
language plpgsql security definer set search_path = public as $$
declare e record; c public.cortes; v_desde timestamptz; v_id uuid := gen_random_uuid();
begin
  if not public.is_store_staff(p_store) then raise exception 'Sin permiso'; end if;
  select * into e from public.check_employee_pin(p_store, p_pin);
  if e.id is null then raise exception 'Clave incorrecta o de otra sucursal'; end if;
  select max(hasta) into v_desde from public.cortes where store_id = p_store;

  perform 1 from public.orders where store_id = p_store and corte_id is null and paid_at is not null and status <> 'rechazado' for update;

  insert into public.cortes (id, store_id, desde, hasta, employee_id, employee_name, n_orders, total, fees, resumen, notas)
  select v_id, p_store, v_desde, now(), e.id, e.nombre, count(*), coalesce(sum(total), 0), coalesce(sum(fee), 0),
         jsonb_build_object(
           'por_tipo', coalesce((select jsonb_object_agg(k, jsonb_build_object('n', n, 'total', t)) from (
               select case when kind = 'service' then 'cat:' || coalesce(service_name->>'cat', 'otros') else kind end k, count(*) n, sum(total) t
               from public.orders where store_id = p_store and corte_id is null and paid_at is not null and status <> 'rechazado' group by 1) x), '{}'::jsonb),
           'por_empleado', coalesce((select jsonb_object_agg(k, jsonb_build_object('n', n, 'total', t)) from (
               select coalesce(attended_name, 'Sin asignar') k, count(*) n, sum(total) t
               from public.orders where store_id = p_store and corte_id is null and paid_at is not null and status <> 'rechazado' group by 1) y), '{}'::jsonb)
         ),
         coalesce(p_notas, '')
  from public.orders where store_id = p_store and corte_id is null and paid_at is not null and status <> 'rechazado'
  returning * into c;

  update public.orders set corte_id = v_id where store_id = p_store and corte_id is null and paid_at is not null and status <> 'rechazado';
  return c;
end $$;

revoke all on function public.create_shop_order(uuid, jsonb, jsonb, text, text) from public, anon;
revoke all on function public.make_corte(uuid, text, text) from public, anon;
grant execute on function public.create_shop_order(uuid, jsonb, jsonb, text, text) to authenticated;
grant execute on function public.make_corte(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- Datos iniciales de productos (edítalos desde Modo tienda → Productos)
-- ---------------------------------------------------------------------
insert into public.product_families (id, es, en, icon, orden) values
  ('cel',  'Celulares',          'Phones',        'phone',      1),
  ('acc',  'Accesorios',         'Accessories',   'headphones', 2),
  ('chip', 'Chips y planes',     'SIMs & plans',  'sim',        3),
  ('reg',  'Regalos y tarjetas', 'Gifts & cards', 'gift',       4),
  ('otro', 'Otros',              'Other',         'bag',        5)
on conflict (id) do nothing;

do $$
declare s uuid; p uuid;
begin
  for s in select id from public.stores loop
    insert into public.products (store_id, family_id, marca, modelo, descripcion, orden)
      values (s, 'cel', 'Samsung', 'Galaxy A15', 'Pantalla grande, buena batería. Desbloqueado.', 1) returning id into p;
    insert into public.product_variants (product_id, label, price, stock, orden) values
      (p, '128 GB · Negro', 189.99, 4, 1), (p, '128 GB · Azul', 189.99, 2, 2);
    insert into public.products (store_id, family_id, marca, modelo, descripcion, orden)
      values (s, 'cel', 'Motorola', 'Moto G54', 'Cámara de 50 MP y carga rápida.', 2) returning id into p;
    insert into public.product_variants (product_id, label, price, stock, orden) values (p, '256 GB · Grafito', 219.99, 3, 1);
    insert into public.products (store_id, family_id, marca, modelo, descripcion, compat, orden)
      values (s, 'acc', 'Genérica', 'Funda + mica', 'Funda resistente con mica de vidrio.', 'Galaxy A15, Moto G54', 3) returning id into p;
    insert into public.product_variants (product_id, label, price, stock, orden) values (p, 'Galaxy A15', 14.99, 10, 1), (p, 'Moto G54', 14.99, 8, 2);
    insert into public.products (store_id, family_id, marca, modelo, descripcion, orden)
      values (s, 'chip', 'Telcel', 'Chip con saldo', 'Chip para México con $100 MXN de saldo.', 4) returning id into p;
    insert into public.product_variants (product_id, label, price, stock, orden) values (p, 'Estándar', 9.99, 20, 1);
  end loop;
end $$;
