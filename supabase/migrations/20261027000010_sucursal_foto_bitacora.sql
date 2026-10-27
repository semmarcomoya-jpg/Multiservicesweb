-- =====================================================================
-- Castillo Multiservices · Foto de sucursal y bitácora (trazabilidad)
--   * Fotos de sucursal: ya existe stores.fotos (la primera es la portada); se suben a "publico/tiendas".
--   * audit_log: quién cambió qué, cuándo y desde qué sucursal, en todo lo que
--     configuran el administrador y las tiendas. Los pedidos ya guardan su propio
--     historial (order_events) con el empleado que hizo cada paso.
-- =====================================================================

create table if not exists public.audit_log (
  id         bigserial primary key,
  at         timestamptz not null default now(),
  user_id    uuid default auth.uid(),
  user_name  text not null default '',
  user_role  text not null default '',
  tabla      text not null,
  accion     text not null check (accion in ('crear', 'cambiar', 'borrar')),
  registro   text not null default '',
  titulo     text not null default '',
  store_id   uuid,
  cambios    jsonb not null default '{}'
);
create index if not exists audit_at_idx on public.audit_log (at desc);
create index if not exists audit_store_idx on public.audit_log (store_id, at desc);

alter table public.audit_log enable row level security;
drop policy if exists audit_read on public.audit_log;
-- El administrador ve todo; cada tienda ve lo de su sucursal
create policy audit_read on public.audit_log for select using (
  public.is_admin() or (store_id is not null and public.is_store_staff(store_id))
);
grant select on public.audit_log to authenticated;
-- Nadie la edita ni la borra desde la app: solo la llenan los disparadores

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
    if tg_table_name = 'profiles' and not (diff ?| array['role', 'store_id', 'id_status']) then return null; end if;
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

do $$
declare t text;
begin
  foreach t in array array['stores', 'services', 'service_categories', 'settings', 'products', 'product_variants',
                           'promos', 'featured', 'stories', 'employees', 'profiles', 'cortes'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists audit_%1$s on public.%1$I', t);
      execute format('create trigger audit_%1$s after insert or update or delete on public.%1$I for each row execute function public.audit_row()', t);
    end if;
  end loop;
end $$;
