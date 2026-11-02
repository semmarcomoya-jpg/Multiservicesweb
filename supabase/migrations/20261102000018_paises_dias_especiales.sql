-- =====================================================================
-- Castillo Multiservices · Envíos a varios países y días especiales
--   * Cada país tiene su moneda, tipo de cambio y comisión (los pone el admin)
--   * La persona que recibe tiene país; el envío usa el tipo de cambio de su país
--   * El perfil del cliente guarda su país y su estado (para su tarjeta de días especiales)
--   * El admin puede agregar días especiales propios (por país y estado)
-- Córrelo una vez en Supabase → SQL Editor (después de castillo_personal_varias_tiendas.sql).
-- =====================================================================

-- Países a los que se envía. México sigue usando "Tipo de cambio" y "comisión" de siempre.
alter table public.settings add column if not exists paises jsonb not null default '[
  {"c":"MX","on":true,"cur":"MXN","rate":0,"fee":0},
  {"c":"GT","on":true,"cur":"GTQ","rate":7.70,"fee":4.99},
  {"c":"SV","on":true,"cur":"USD","rate":1,"fee":4.99},
  {"c":"HN","on":true,"cur":"HNL","rate":25.20,"fee":4.99},
  {"c":"NI","on":false,"cur":"NIO","rate":36.60,"fee":4.99},
  {"c":"CO","on":false,"cur":"COP","rate":4000,"fee":4.99},
  {"c":"DO","on":false,"cur":"DOP","rate":60.50,"fee":4.99},
  {"c":"EC","on":false,"cur":"USD","rate":1,"fee":4.99},
  {"c":"PE","on":false,"cur":"PEN","rate":3.75,"fee":4.99}
]';
-- Días especiales propios: [{"m":5,"d":5,"es":"Batalla de Puebla","en":"Battle of Puebla","pais":"MX","estado":"Puebla"}]
alter table public.settings add column if not exists dias jsonb not null default '[]';

alter table public.beneficiaries add column if not exists pais text not null default 'MX';
alter table public.orders add column if not exists pais text;
alter table public.orders add column if not exists moneda text;
update public.orders set pais = 'MX', moneda = 'MXN' where kind = 'send' and pais is null;

alter table public.profiles add column if not exists pais text;
alter table public.profiles add column if not exists estado text not null default '';

-- Envío: usa el país de quien recibe
create or replace function public.create_send_order(
  p_store uuid, p_beneficiary uuid, p_monto numeric, p_captura text, p_zelle_nombre text
) returns public.orders
language plpgsql security definer set search_path = public as $$
declare
  st public.stores; b public.beneficiaries; cfg public.settings; pr public.profiles; o public.orders; v_limit numeric;
  v_pais jsonb; v_rate numeric; v_fee numeric; v_cur text;
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
  if p_captura is not null and p_captura not like auth.uid()::text || '/%' then raise exception 'Captura inválida'; end if;

  if coalesce(b.pais, 'MX') = 'MX' then
    v_rate := cfg.exchange_rate; v_fee := cfg.send_fee; v_cur := 'MXN';
  else
    select x into v_pais from jsonb_array_elements(cfg.paises) x where x->>'c' = b.pais limit 1;
    if v_pais is null or coalesce((v_pais->>'on')::boolean, false) = false then raise exception 'Por ahora no enviamos a ese país'; end if;
    v_rate := (v_pais->>'rate')::numeric; v_fee := coalesce((v_pais->>'fee')::numeric, cfg.send_fee); v_cur := coalesce(v_pais->>'cur', 'USD');
    if v_rate is null or v_rate <= 0 then raise exception 'Falta el tipo de cambio de ese país'; end if;
  end if;

  insert into public.orders (user_id, store_id, kind, beneficiary, monto, fee, total, rate, mxn, captura_path,
                             cliente_nombre, cliente_code, zelle_nombre, pais, moneda)
  values (auth.uid(), p_store, 'send', to_jsonb(b) - 'user_id', p_monto, v_fee, p_monto + v_fee,
          v_rate, round(p_monto * v_rate, 2), p_captura,
          trim(pr.nombre || ' ' || pr.apellidos), coalesce(pr.member_code, ''), coalesce(nullif(p_zelle_nombre, ''), trim(pr.nombre || ' ' || pr.apellidos)),
          coalesce(b.pais, 'MX'), v_cur)
  returning * into o;
  insert into public.order_events (order_id, act, by_name) values (o.id, 'Pedido enviado por el cliente', o.cliente_nombre);
  return o;
end $$;
