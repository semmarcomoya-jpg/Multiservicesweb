-- =====================================================================
-- Castillo Multiservices · Código para recoger con 4 LETRAS (como en Viva)
--   Ej. "UBUX". Sin letras que se confunden con números (no I, O, S, Z, B, G, Q).
--   La tienda lo escribe al entregar; da igual mayúsculas o minúsculas.
-- =====================================================================
create or replace function public.pickup_code() returns text language sql volatile as $$
  select string_agg(substr('ACDEFHJKLMNPRTUVWXY', 1 + floor(random() * 19)::int, 1), '')
  from generate_series(1, 4)
$$;

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
  if v_mode <> 'digital' then v_code := public.pickup_code(); end if;
  if p_captura is not null and p_captura not like auth.uid()::text || '/%' then raise exception 'Captura inválida'; end if;

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
  if p_captura is not null and p_captura not like auth.uid()::text || '/%' then raise exception 'Captura inválida'; end if;
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
  v_code := public.pickup_code();

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
      if upper(trim(coalesce(p_code, ''))) <> upper(o.code) then raise exception 'El código de entrega no coincide'; end if;
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
