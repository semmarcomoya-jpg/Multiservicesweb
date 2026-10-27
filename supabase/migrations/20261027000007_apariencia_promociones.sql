-- =====================================================================
-- Castillo Multiservices · Apariencia y promociones (igual que la maqueta)
--   * settings.brand guarda: nombre, nombre corto, logo, portada, textos de portada,
--     fondo del encabezado de inicio y los fondos de cada sección (patrón, color o imagen).
--   * promos: tarjetas deslizables en Inicio que el administrador sube.
-- =====================================================================

update public.settings set brand = jsonb_build_object(
  'nombre', coalesce(brand->>'nombre', 'Castillo Multiservices'),
  'corto', coalesce(brand->>'corto', 'Castillo'),
  'cover_title_es', 'Tu familia, más cerca',
  'cover_title_en', 'Your family, closer',
  'cover_sub_es', 'Envía dinero a México, compra tu celular y paga tus servicios. Y gana puntos en cada movimiento.',
  'cover_sub_en', 'Send money to Mexico, buy your phone and pay your bills. And earn points with every move.'
) || coalesce(brand, '{}'::jsonb)
where id = 1;

create table if not exists public.promos (
  id        uuid primary key default gen_random_uuid(),
  title_es  text not null default '',
  title_en  text not null default '',
  sub_es    text not null default '',
  sub_en    text not null default '',
  go        text not null default 'shop' check (go in ('shop', 'send', 'services', 'none')),
  theme     text not null default 'shop' check (theme in ('shop', 'send', 'pts')),
  img_url   text,
  activo    boolean not null default true,
  orden     int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.promos enable row level security;
drop policy if exists promos_read on public.promos;
create policy promos_read on public.promos for select using (activo or public.is_admin());
drop policy if exists promos_admin on public.promos;
create policy promos_admin on public.promos for all using (public.is_admin()) with check (public.is_admin());
grant select on public.promos to anon, authenticated;
grant insert, update, delete on public.promos to authenticated;

insert into public.promos (title_es, title_en, sub_es, sub_en, go, theme, orden)
select * from (values
  ('Celulares desde $34.99', 'Phones from $34.99', 'Recoge hoy en tu tienda', 'Pick up today at your store', 'shop', 'shop', 1),
  ('Doble de puntos en envíos', 'Double points on transfers', 'Todos los viernes de este mes', 'Every Friday this month', 'send', 'send', 2)
) v(a, b, c, d, e, f, g)
where not exists (select 1 from public.promos);
