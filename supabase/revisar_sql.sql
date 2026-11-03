-- Castillo · ¿Qué SQL me falta?
-- Córrelo cuando quieras en Supabase → SQL Editor. Solo revisa, no cambia nada.
-- Te muestra cada archivo en orden con ✅ (ya corrió) o ❌ (falta). Corre los ❌ en ese mismo orden.
with col as (select table_name t, column_name c from information_schema.columns where table_schema = 'public')
select n as orden, archivo, case when ok then '✅ ya corrió' else '❌ FALTA' end as estado from (values
  (1,  'castillo_supabase_completo.sql (base: pedidos, tiendas, servicios)', to_regclass('public.orders') is not null and to_regclass('public.stores') is not null),
  (2,  'datos iniciales (tiendas y servicios)',        exists (select 1 from public.services) and exists (select 1 from public.stores)),
  (3,  'productos y corte',                            to_regclass('public.product_variants') is not null and to_regclass('public.cortes') is not null),
  (4,  'castillo_historias.sql',                       to_regclass('public.stories') is not null),
  (5,  'perfil automático',                            to_regprocedure('public.ensure_profile()') is not null or exists (select 1 from pg_proc where proname = 'ensure_profile')),
  (6,  'castillo_permisos.sql',                        has_table_privilege('authenticated', 'public.orders', 'select')),
  (7,  'castillo_apariencia.sql (apariencia y promociones)', to_regclass('public.promos') is not null),
  (8,  'castillo_zelle.sql',                           exists (select 1 from pg_proc where proname = 'attach_captura')),
  (9,  'castillo_foto_destacados.sql',                 to_regclass('public.featured') is not null),
  (10, 'castillo_bitacora.sql',                        to_regclass('public.audit_log') is not null),
  (11, 'castillo_calificaciones_boca_a_boca.sql',      to_regclass('public.ratings') is not null and to_regclass('public.posts') is not null),
  (12, 'castillo_borrar_publicacion.sql',              exists (select 1 from pg_proc where proname = 'admin_delete_post')),
  (13, 'castillo_codigo_letras.sql',                   exists (select 1 from pg_proc where proname = 'pickup_code')),
  (14, 'castillo_comunidad.sql',                       to_regclass('public.notifications') is not null and to_regclass('public.post_reports') is not null),
  (15, 'castillo_puntos_credito_ids.sql',              to_regclass('public.points_ledger') is not null and to_regclass('public.plans') is not null and to_regclass('public.id_docs') is not null),
  (16, 'castillo_ficha_productos.sql',                 exists (select 1 from col where t = 'products' and c = 'specs')),
  (17, 'castillo_personal_varias_tiendas.sql',         exists (select 1 from col where t = 'profiles' and c = 'store_ids') and to_regclass('public.caja_gastos') is not null),
  (18, 'castillo_paises_dias_especiales.sql',          exists (select 1 from col where t = 'beneficiaries' and c = 'pais') and exists (select 1 from col where t = 'settings' and c = 'paises')),
  (19, 'castillo_costos_cumpleanos.sql',               to_regclass('public.product_costs') is not null),
  (20, 'castillo_avisos_push.sql',                     to_regclass('public.push_subs') is not null)
) as v(n, archivo, ok)
order by n;
