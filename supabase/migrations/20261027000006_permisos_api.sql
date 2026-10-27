-- =====================================================================
-- Permisos para que la app pueda usar las tablas (Data API).
-- Los proyectos nuevos de Supabase ya no los dan solos. La seguridad real
-- la siguen dando las reglas RLS de cada tabla: cada quien solo ve lo suyo.
-- =====================================================================
grant usage on schema public to anon, authenticated;

-- Cuentas con sesión: pueden intentar leer/escribir; RLS decide qué filas
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Visitantes sin sesión: solo el catálogo público
grant select on public.stores, public.services, public.service_categories, public.settings,
               public.product_families, public.products, public.product_variants, public.stories
  to anon;

-- Funciones (todas validan quién llama por dentro)
grant execute on all functions in schema public to anon, authenticated;

-- Lo mismo para tablas y funciones que se creen después
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant usage, select on sequences to authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;
