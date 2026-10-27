-- =====================================================================
-- Castillo Multiservices · Historias tipo TikTok / Instagram (igual que Viva)
--
-- El administrador (para todas las tiendas) o cada tienda (para la suya)
-- sube fotos o videos cortos. Los clientes los ven en Inicio.
--   * imagen o video (media_type)
--   * texto corto en español e inglés
--   * botón de acción opcional: un producto, un servicio, enviar dinero o la tienda
--   * caduca en 24 h, 3 días, 7 días, o queda "destacada" (expires_at nulo)
--   * se puede programar (starts_at en el futuro)
--   * cuenta vistas
-- =====================================================================

create table if not exists public.stories (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid references public.stores(id) on delete cascade,   -- null = todas las tiendas
  media_url   text not null check (media_url ~ '^https?://'),
  media_type  text not null default 'image' check (media_type in ('image', 'video')),
  caption_es  text check (caption_es is null or char_length(caption_es) <= 200),
  caption_en  text check (caption_en is null or char_length(caption_en) <= 200),
  link_type   text not null default 'none' check (link_type in ('none', 'product', 'service', 'send', 'shop')),
  link_id     uuid,
  starts_at   timestamptz not null default now(),
  expires_at  timestamptz,
  sort_order  int not null default 0,
  views       int not null default 0,
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id) on delete set null default auth.uid(),
  constraint stories_window check (expires_at is null or expires_at > starts_at)
);
create index if not exists stories_store_idx on public.stories (store_id, starts_at desc);

alter table public.stories enable row level security;

-- Cualquiera ve las vigentes (generales o de una tienda activa)
drop policy if exists stories_public_read on public.stories;
create policy stories_public_read on public.stories for select using (
  starts_at <= now()
  and (expires_at is null or expires_at > now())
  and (store_id is null or exists (select 1 from public.stores s where s.id = store_id and s.activo))
);
-- El administrador administra todas; cada tienda, las suyas
drop policy if exists stories_staff_all on public.stories;
create policy stories_staff_all on public.stories for all
  using (public.is_admin() or (store_id is not null and public.is_store_staff(store_id)))
  with check (public.is_admin() or (store_id is not null and public.is_store_staff(store_id)));

grant select on public.stories to anon, authenticated;
grant insert, update, delete on public.stories to authenticated;

-- Contar una vista (no expone nada más)
create or replace function public.story_view(p_story uuid) returns void
language sql security definer set search_path = public as $$
  update public.stories set views = views + 1
  where id = p_story and starts_at <= now() and (expires_at is null or expires_at > now());
$$;
revoke all on function public.story_view(uuid) from public;
grant execute on function public.story_view(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Archivos: bucket público `stories`, carpeta por tienda o "general".
-- 50 MB por archivo (máximo del plan gratuito); un video vertical de 15–30 s queda muy por debajo.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('stories', 'stories', true, 52428800,
        array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'])
on conflict (id) do nothing;

drop policy if exists stories_files_read on storage.objects;
create policy stories_files_read on storage.objects for select using (bucket_id = 'stories');

drop policy if exists stories_files_write on storage.objects;
create policy stories_files_write on storage.objects for insert to authenticated with check (
  bucket_id = 'stories' and (
    public.is_admin()
    or exists (select 1 from public.stores s where s.id::text = (storage.foldername(name))[1] and public.is_store_staff(s.id))
  )
);

drop policy if exists stories_files_delete on storage.objects;
create policy stories_files_delete on storage.objects for delete to authenticated using (
  bucket_id = 'stories' and (
    public.is_admin()
    or exists (select 1 from public.stores s where s.id::text = (storage.foldername(name))[1] and public.is_store_staff(s.id))
  )
);
