-- =====================================================================
-- Castillo Multiservices · Comunidad viva
--   1. Avisos dentro de la app (campanita): te responden, le sirvió a alguien, cambia tu pedido…
--   2. Los clientes comentan las publicaciones de otros (no solo la tienda).
--   3. Promedio de estrellas por tienda (store_scores) para Inicio y para elegir tienda.
--   4. Fotos en las publicaciones (bucket "comunidad").
--   5. Botón "Reportar" (la tienda y el administrador reciben aviso).
--   6. Sello "Cliente verificado" (ya tuvo un pedido completado en esa tienda).
--   7. "Avisos útiles" para la comunidad (consulado, ferias, trámites), de una tienda o de todas.
-- =====================================================================

-- ---------- Publicaciones: foto, verificado, reportes, avisos útiles
alter table public.posts add column if not exists photo_url text;
alter table public.posts add column if not exists verified boolean not null default false;
alter table public.posts add column if not exists reports int not null default 0;
alter table public.posts alter column store_id drop not null;   -- null = aviso para todas las tiendas
alter table public.posts drop constraint if exists posts_kind_check;
alter table public.posts add constraint posts_kind_check check (kind in ('reco', 'prod', 'promo', 'sug', 'store', 'aviso'));

drop policy if exists posts_read on public.posts;
create policy posts_read on public.posts for select using (
  (not hidden and (store_id is null or exists (select 1 from public.stores s where s.id = store_id and s.activo)))
  or user_id = auth.uid() or public.is_admin() or (store_id is not null and public.is_store_staff(store_id))
);

-- ---------- Comentarios (respuestas de clientes y de la tienda)
alter table public.post_replies add column if not exists is_store boolean not null default true;
alter table public.post_replies add column if not exists author_foto text;
alter table public.post_replies add column if not exists hidden boolean not null default false;
alter table public.post_replies add column if not exists hide_reason text not null default '';
alter table public.post_replies alter column is_store set default false;

drop policy if exists replies_read on public.post_replies;
create policy replies_read on public.post_replies for select using (
  exists (select 1 from public.posts p where p.id = post_id)   -- hereda lo que se puede ver del post
  and (not hidden or user_id = auth.uid() or public.is_admin()
       or exists (select 1 from public.posts p where p.id = post_id and p.store_id is not null and public.is_store_staff(p.store_id)))
);

-- ---------- Reportes
create table if not exists public.post_reports (
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  reason     text not null default 'otro',
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.post_reports enable row level security;
drop policy if exists reports_own on public.post_reports;
create policy reports_own on public.post_reports for select using (user_id = auth.uid() or public.is_admin());
grant select on public.post_reports to authenticated;

-- ---------- Avisos dentro de la app
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  kind       text not null default 'info',
  title      text not null,
  body       text not null default '',
  link       text not null default '',
  ref_id     uuid,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notif_user_idx on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
drop policy if exists notif_own on public.notifications;
create policy notif_own on public.notifications for select using (user_id = auth.uid());
drop policy if exists notif_read on public.notifications;
create policy notif_read on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, update on public.notifications to authenticated;

create or replace function public.notify(p_user uuid, p_kind text, p_title text, p_body text, p_link text, p_ref uuid)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, kind, title, body, link, ref_id)
  select p_user, p_kind, left(p_title, 140), left(coalesce(p_body, ''), 300), coalesce(p_link, ''), p_ref
  where p_user is not null
$$;
revoke all on function public.notify(uuid, text, text, text, text, uuid) from public, anon, authenticated;

-- Avisar a la tienda (cuentas de esa sucursal) y a los administradores
create or replace function public.notify_staff(p_store uuid, p_kind text, p_title text, p_body text, p_link text, p_ref uuid)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, kind, title, body, link, ref_id)
  select pr.id, p_kind, left(p_title, 140), left(coalesce(p_body, ''), 300), coalesce(p_link, ''), p_ref
  from public.profiles pr
  where pr.role = 'admin' or (pr.role = 'tienda' and p_store is not null and pr.store_id = p_store)
$$;
revoke all on function public.notify_staff(uuid, text, text, text, text, uuid) from public, anon, authenticated;

-- Marcar todos como leídos
create or replace function public.mark_notifications_read() returns void
language sql security definer set search_path = public as $$
  update public.notifications set read_at = now() where user_id = auth.uid() and read_at is null
$$;
grant execute on function public.mark_notifications_read() to authenticated;

-- ---------- Publicar (con foto, verificado y avisos útiles)
drop function if exists public.create_post(uuid, text, int, text, text, uuid, text);
create or replace function public.create_post(p_store uuid, p_kind text, p_stars int, p_text text, p_ref_type text, p_ref_id uuid, p_ref_label text, p_photo text default null)
returns public.posts language plpgsql security definer set search_path = public as $$
declare st public.stores; pr public.profiles; p public.posts; v_staff boolean; v_name text; v_foto text;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  if p_kind not in ('reco', 'prod', 'promo', 'sug', 'store', 'aviso') then raise exception 'Tipo inválido'; end if;
  if p_store is null then
    if not (p_kind = 'aviso' and public.is_admin()) then raise exception 'Elige la tienda'; end if;
    v_staff := true;
  else
    select * into st from public.stores where id = p_store and activo;
    if st.id is null then raise exception 'Tienda no encontrada'; end if;
    v_staff := public.is_admin() or public.is_store_staff(p_store);
    if coalesce((st.mods->>'comm')::boolean, true) = false and not v_staff then raise exception 'Esta tienda no tiene Boca a boca'; end if;
  end if;
  if p_kind in ('store', 'aviso') and not v_staff then raise exception 'Solo la tienda publica avisos'; end if;
  if char_length(trim(coalesce(p_text, ''))) = 0 then raise exception 'Escribe tu publicación'; end if;
  if p_kind not in ('store', 'aviso') and public.has_sensitive(p_text) then
    raise exception 'Por tu seguridad, quita números de cuenta, teléfonos o correos.';
  end if;
  if p_kind = 'reco' and (p_stars is null or p_stars < 1 or p_stars > 5) then raise exception 'Elige cuántas estrellas'; end if;
  if p_photo is not null and p_photo !~ '^https?://' then raise exception 'Foto inválida'; end if;
  select * into pr from public.profiles where id = auth.uid();
  if p_kind in ('store', 'aviso') then
    v_name := coalesce(st.nombre, (select brand->>'nombre' from public.settings where id = 1), 'Castillo Multiservices');
    v_foto := (st.fotos)[1];
  else
    v_name := trim(coalesce(pr.nombre, '') || ' ' || left(coalesce(pr.apellidos, ''), 1) || case when coalesce(pr.apellidos, '') <> '' then '.' else '' end);
    v_foto := pr.foto_url;
  end if;
  insert into public.posts (store_id, user_id, author_name, author_foto, kind, stars, text, ref_type, ref_id, ref_label, photo_url, verified)
  values (p_store, auth.uid(), coalesce(nullif(v_name, ''), 'Cliente'), v_foto, p_kind,
          case when p_kind = 'reco' then p_stars else 0 end, left(trim(p_text), 600),
          case when p_ref_id is null then null else p_ref_type end, p_ref_id, left(coalesce(p_ref_label, ''), 120), p_photo,
          p_kind not in ('store', 'aviso') and exists (select 1 from public.orders o where o.user_id = auth.uid() and o.store_id = p_store and o.status = 'completado'))
  returning * into p;
  return p;
end $$;
revoke all on function public.create_post(uuid, text, int, text, text, uuid, text, text) from public, anon;
grant execute on function public.create_post(uuid, text, int, text, text, uuid, text, text) to authenticated;

-- ---------- Comentar (cliente o tienda)
create or replace function public.comment_post(p_post uuid, p_text text) returns public.post_replies
language plpgsql security definer set search_path = public as $$
declare p public.posts; st public.stores; pr public.profiles; r public.post_replies; v_staff boolean; v_name text;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  select * into p from public.posts where id = p_post;
  if p.id is null then raise exception 'Publicación no encontrada'; end if;
  v_staff := public.is_admin() or (p.store_id is not null and public.is_store_staff(p.store_id));
  if p.hidden and not v_staff then raise exception 'Esta publicación ya no está disponible'; end if;
  if char_length(trim(coalesce(p_text, ''))) = 0 then raise exception 'Escribe tu comentario'; end if;
  if not v_staff and public.has_sensitive(p_text) then raise exception 'Por tu seguridad, quita números de cuenta, teléfonos o correos.'; end if;
  select * into pr from public.profiles where id = auth.uid();
  if v_staff then
    select * into st from public.stores where id = p.store_id;
    v_name := coalesce(st.nombre, 'Castillo Multiservices') || coalesce(' · ' || nullif(pr.nombre, ''), '');
  else
    v_name := trim(coalesce(pr.nombre, '') || ' ' || left(coalesce(pr.apellidos, ''), 1) || case when coalesce(pr.apellidos, '') <> '' then '.' else '' end);
  end if;
  insert into public.post_replies (post_id, author_name, author_foto, is_store, text)
  values (p_post, coalesce(nullif(v_name, ''), 'Cliente'), case when v_staff then null else pr.foto_url end, v_staff, left(trim(p_text), 500))
  returning * into r;
  return r;
end $$;
revoke all on function public.comment_post(uuid, text) from public, anon;
grant execute on function public.comment_post(uuid, text) to authenticated;

-- La respuesta "oficial" de la tienda sigue funcionando igual
create or replace function public.reply_post(p_post uuid, p_text text) returns public.post_replies
language plpgsql security definer set search_path = public as $$
declare p public.posts;
begin
  select * into p from public.posts where id = p_post;
  if p.id is null then raise exception 'Publicación no encontrada'; end if;
  if not (public.is_admin() or (p.store_id is not null and public.is_store_staff(p.store_id))) then raise exception 'Solo la tienda responde'; end if;
  return public.comment_post(p_post, p_text);
end $$;

create or replace function public.moderate_reply(p_reply uuid, p_hide boolean, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare r public.post_replies; p public.posts;
begin
  select * into r from public.post_replies where id = p_reply;
  if r.id is null then raise exception 'Comentario no encontrado'; end if;
  select * into p from public.posts where id = r.post_id;
  if not (public.is_admin() or (p.store_id is not null and public.is_store_staff(p.store_id))) then raise exception 'Sin permiso'; end if;
  if p_hide and coalesce(p_reason, '') not in ('ofensivo', 'spam', 'datos', 'otro') then raise exception 'Elige el motivo para ocultar'; end if;
  update public.post_replies set hidden = p_hide, hide_reason = case when p_hide then p_reason else '' end where id = p_reply;
end $$;
revoke all on function public.moderate_reply(uuid, boolean, text) from public, anon;
grant execute on function public.moderate_reply(uuid, boolean, text) to authenticated;

-- El autor borra su comentario
create or replace function public.delete_my_comment(p_reply uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.post_replies where id = p_reply and user_id = auth.uid();
  if not found then raise exception 'No puedes borrar este comentario'; end if;
end $$;
revoke all on function public.delete_my_comment(uuid) from public, anon;
grant execute on function public.delete_my_comment(uuid) to authenticated;

-- ---------- Reportar
create or replace function public.report_post(p_post uuid, p_reason text) returns int
language plpgsql security definer set search_path = public as $$
declare p public.posts; n int;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  select * into p from public.posts where id = p_post;
  if p.id is null then raise exception 'Publicación no encontrada'; end if;
  if p.user_id = auth.uid() then raise exception 'No puedes reportar tu propia publicación'; end if;
  insert into public.post_reports (post_id, user_id, reason)
  values (p_post, auth.uid(), case when p_reason in ('ofensivo', 'spam', 'datos', 'otro') then p_reason else 'otro' end)
  on conflict do nothing;
  if not found then return p.reports; end if;
  select count(*) into n from public.post_reports where post_id = p_post;
  update public.posts set reports = n where id = p_post;
  perform public.notify_staff(p.store_id, 'report', 'Reportaron una publicación de Boca a boca',
    p.author_name || ': ' || left(p.text, 120), case when p.store_id is null then '/admin/comunidad' else '/tienda/comunidad' end, p.id);
  return n;
end $$;
revoke all on function public.report_post(uuid, text) from public, anon;
grant execute on function public.report_post(uuid, text) to authenticated;

-- ---------- Estrellas por tienda (para Inicio y para elegir tienda)
create or replace function public.store_scores()
returns table (store_id uuid, promedio numeric, total bigint)
language sql stable security definer set search_path = public as $$
  select p.store_id, round(avg(p.stars)::numeric, 1), count(*)
  from public.posts p join public.stores s on s.id = p.store_id and s.activo
  where p.kind = 'reco' and p.stars > 0 and not p.hidden
  group by p.store_id
$$;
grant execute on function public.store_scores() to anon, authenticated;

-- ---------- Disparadores de avisos
create or replace function public.notif_on_reply() returns trigger
language plpgsql security definer set search_path = public as $$
declare p public.posts;
begin
  select * into p from public.posts where id = new.post_id;
  if p.user_id is not null and p.user_id is distinct from new.user_id then
    perform public.notify(p.user_id, 'reply',
      case when new.is_store then 'La tienda respondió tu publicación' else new.author_name || ' comentó tu publicación' end,
      left(new.text, 160), '/comunidad?post=' || p.id, p.id);
  end if;
  return null;
end $$;
drop trigger if exists notif_reply on public.post_replies;
create trigger notif_reply after insert on public.post_replies for each row execute function public.notif_on_reply();

create or replace function public.notif_on_like() returns trigger
language plpgsql security definer set search_path = public as $$
declare p public.posts;
begin
  select * into p from public.posts where id = new.post_id;
  if p.user_id is not null and p.user_id <> new.user_id
     and not exists (select 1 from public.notifications n where n.user_id = p.user_id and n.kind = 'like' and n.ref_id = p.id and n.read_at is null) then
    perform public.notify(p.user_id, 'like', 'A alguien le sirvió tu publicación', left(p.text, 120), '/comunidad?post=' || p.id, p.id);
  end if;
  return null;
end $$;
drop trigger if exists notif_like on public.post_likes;
create trigger notif_like after insert on public.post_likes for each row execute function public.notif_on_like();

create or replace function public.notif_on_hide() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.hidden and not old.hidden and new.user_id is not null and new.kind not in ('store', 'aviso') then
    perform public.notify(new.user_id, 'hidden', 'Ocultamos tu publicación',
      case new.hide_reason when 'ofensivo' then 'Motivo: lenguaje ofensivo.' when 'spam' then 'Motivo: spam o publicidad.'
                           when 'datos' then 'Motivo: tenía datos personales.' else 'Si tienes dudas, pregunta en tu tienda.' end,
      '/comunidad', new.id);
  end if;
  return null;
end $$;
drop trigger if exists notif_hide on public.posts;
create trigger notif_hide after update of hidden on public.posts for each row execute function public.notif_on_hide();

create or replace function public.notif_on_order() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    perform public.notify(new.user_id, 'order',
      'Pedido ' || new.folio || ': ' || case new.status when 'proceso' then 'pago confirmado' when 'completado' then '¡listo!' when 'rechazado' then 'no se pudo completar' else new.status end,
      case new.status when 'proceso' then 'Ya estamos trabajando en tu pedido.' when 'completado' then 'Toca para ver tu comprobante y calificar cómo te atendieron.'
                      when 'rechazado' then coalesce(nullif(new.reject_reason, ''), 'Comunícate con tu tienda.') else '' end,
      '/pedido/' || new.id, new.id);
  end if;
  return null;
end $$;
drop trigger if exists notif_order on public.orders;
create trigger notif_order after update of status on public.orders for each row execute function public.notif_on_order();

-- Pedido nuevo: aviso a la tienda
create or replace function public.notif_on_new_order() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.notify_staff(new.store_id, 'new_order', 'Pedido nuevo ' || new.folio || ' · $' || new.total,
    coalesce(nullif(new.cliente_nombre, ''), 'Cliente') || ' · pago por confirmar', '/tienda/pedido/' || new.id, new.id);
  return null;
end $$;
drop trigger if exists notif_new_order on public.orders;
create trigger notif_new_order after insert on public.orders for each row execute function public.notif_on_new_order();

-- ---------- Fotos de la comunidad
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('comunidad', 'comunidad', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
drop policy if exists comunidad_read on storage.objects;
create policy comunidad_read on storage.objects for select using (bucket_id = 'comunidad');
drop policy if exists comunidad_write on storage.objects;
create policy comunidad_write on storage.objects for insert to authenticated
  with check (bucket_id = 'comunidad' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists comunidad_delete on storage.objects;
create policy comunidad_delete on storage.objects for delete to authenticated
  using (bucket_id = 'comunidad' and (storage.foldername(name))[1] = auth.uid()::text);

-- Trazabilidad de comentarios ocultos
do $$
begin
  if to_regprocedure('public.audit_row()') is not null then
    drop trigger if exists audit_post_replies on public.post_replies;
    create trigger audit_post_replies after update on public.post_replies for each row execute function public.audit_row();
  end if;
end $$;
