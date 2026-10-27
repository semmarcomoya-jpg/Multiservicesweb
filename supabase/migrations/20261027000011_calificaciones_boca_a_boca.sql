-- =====================================================================
-- Castillo Multiservices · Calificaciones y Boca a boca (igual que la maqueta)
--   * ratings: al completarse un pedido, el cliente califica a quien lo atendió
--     (estrellas, etiquetas como "Rápido" y comentario). 1–2 ★ quedan "para dar seguimiento".
--   * posts: publicaciones de Boca a boca por tienda (recomendación con estrellas,
--     producto, promoción, sugerencia, o aviso de la tienda). Se publican al momento;
--     la tienda o el administrador ocultan solo lo ofensivo, spam o datos personales.
--   * post_replies: respuestas públicas de la tienda. post_likes: "me gusta".
-- =====================================================================

-- ---------- Calificaciones
create table if not exists public.ratings (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null unique references public.orders(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  store_id      uuid not null references public.stores(id) on delete cascade,
  employee_id   uuid references public.employees(id) on delete set null,
  employee_name text not null default '',
  stars         int not null check (stars between 1 and 5),
  tags          text[] not null default '{}',
  comment       text not null default '' check (char_length(comment) <= 500),
  followed_up   boolean not null default false,
  followed_by   text not null default '',
  followed_at   timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists ratings_store_idx on public.ratings (store_id, created_at desc);

alter table public.ratings enable row level security;
drop policy if exists ratings_read on public.ratings;
create policy ratings_read on public.ratings for select using (
  user_id = auth.uid() or public.is_admin() or public.is_store_staff(store_id)
);
drop policy if exists ratings_follow on public.ratings;
create policy ratings_follow on public.ratings for update
  using (public.is_admin() or public.is_store_staff(store_id))
  with check (public.is_admin() or public.is_store_staff(store_id));
grant select, update on public.ratings to authenticated;

create or replace function public.rate_order(p_order uuid, p_stars int, p_tags text[], p_comment text)
returns public.ratings language plpgsql security definer set search_path = public as $$
declare o public.orders; r public.ratings;
begin
  select * into o from public.orders where id = p_order and user_id = auth.uid();
  if o.id is null then raise exception 'Pedido no encontrado'; end if;
  if o.status <> 'completado' then raise exception 'Podrás calificar cuando tu pedido esté listo'; end if;
  if exists (select 1 from public.ratings where order_id = p_order) then raise exception 'Ya calificaste este pedido'; end if;
  if p_stars is null or p_stars < 1 or p_stars > 5 then raise exception 'Elige de 1 a 5 estrellas'; end if;
  insert into public.ratings (order_id, user_id, store_id, employee_id, employee_name, stars, tags, comment)
  values (o.id, auth.uid(), o.store_id, o.attended_by, coalesce(o.attended_name, ''), p_stars,
          coalesce((select array_agg(left(t, 30)) from unnest(coalesce(p_tags, '{}')) t limit 6), '{}'),
          left(trim(coalesce(p_comment, '')), 500))
  returning * into r;
  return r;
end $$;
revoke all on function public.rate_order(uuid, int, text[], text) from public, anon;
grant execute on function public.rate_order(uuid, int, text[], text) to authenticated;

-- ---------- Boca a boca
create table if not exists public.posts (
  id           uuid primary key default gen_random_uuid(),
  store_id     uuid not null references public.stores(id) on delete cascade,
  user_id      uuid references auth.users(id) on delete set null default auth.uid(),
  author_name  text not null default '',
  author_foto  text,
  kind         text not null check (kind in ('reco', 'prod', 'promo', 'sug', 'store')),
  stars        int not null default 0 check (stars between 0 and 5),
  text         text not null check (char_length(text) between 1 and 600),
  ref_type     text check (ref_type in ('product', 'service')),
  ref_id       uuid,
  ref_label    text not null default '',
  likes        int not null default 0,
  hidden       boolean not null default false,
  hide_reason  text not null default '' check (hide_reason in ('', 'ofensivo', 'spam', 'datos', 'otro')),
  hidden_by    text not null default '',
  created_at   timestamptz not null default now()
);
create index if not exists posts_store_idx on public.posts (store_id, created_at desc);

create table if not exists public.post_replies (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.posts(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete set null default auth.uid(),
  author_name text not null default '',
  text        text not null check (char_length(text) between 1 and 500),
  created_at  timestamptz not null default now()
);
create index if not exists replies_post_idx on public.post_replies (post_id, created_at);

create table if not exists public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (post_id, user_id)
);

alter table public.posts enable row level security;
alter table public.post_replies enable row level security;
alter table public.post_likes enable row level security;

drop policy if exists posts_read on public.posts;
create policy posts_read on public.posts for select using (
  (not hidden and exists (select 1 from public.stores s where s.id = store_id and s.activo))
  or user_id = auth.uid() or public.is_admin() or public.is_store_staff(store_id)
);
drop policy if exists replies_read on public.post_replies;
create policy replies_read on public.post_replies for select using (
  exists (select 1 from public.posts p where p.id = post_id)  -- hereda lo que se puede ver del post
);
drop policy if exists likes_read on public.post_likes;
create policy likes_read on public.post_likes for select using (user_id = auth.uid());
grant select on public.posts, public.post_replies to anon, authenticated;
grant select on public.post_likes to authenticated;
-- Escribir solo por las funciones de abajo (validan quién eres)

-- ¿El texto trae teléfonos, correos o números de cuenta? (protección del cliente)
create or replace function public.has_sensitive(t text) returns boolean language sql immutable as $$
  select t ~ '\d[\d\s().-]{7,}\d' or t ~* '\S+@\S+\.\S+'
$$;

create or replace function public.create_post(p_store uuid, p_kind text, p_stars int, p_text text, p_ref_type text, p_ref_id uuid, p_ref_label text)
returns public.posts language plpgsql security definer set search_path = public as $$
declare st public.stores; pr public.profiles; p public.posts; v_staff boolean; v_name text;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  select * into st from public.stores where id = p_store and activo;
  if st.id is null then raise exception 'Tienda no encontrada'; end if;
  v_staff := public.is_admin() or public.is_store_staff(p_store);
  if coalesce((st.mods->>'comm')::boolean, true) = false and not v_staff then raise exception 'Esta tienda no tiene Boca a boca'; end if;
  if p_kind = 'store' and not v_staff then raise exception 'Solo la tienda publica avisos'; end if;
  if p_kind not in ('reco', 'prod', 'promo', 'sug', 'store') then raise exception 'Tipo inválido'; end if;
  if char_length(trim(coalesce(p_text, ''))) = 0 then raise exception 'Escribe tu publicación'; end if;
  if p_kind <> 'store' and public.has_sensitive(p_text) then
    raise exception 'Por tu seguridad, quita números de cuenta, teléfonos o correos.';
  end if;
  if p_kind = 'reco' and (p_stars is null or p_stars < 1 or p_stars > 5) then raise exception 'Elige cuántas estrellas'; end if;
  select * into pr from public.profiles where id = auth.uid();
  v_name := case when p_kind = 'store' then st.nombre
                 else trim(coalesce(pr.nombre, '') || ' ' || left(coalesce(pr.apellidos, ''), 1) || case when coalesce(pr.apellidos, '') <> '' then '.' else '' end) end;
  insert into public.posts (store_id, user_id, author_name, author_foto, kind, stars, text, ref_type, ref_id, ref_label)
  values (p_store, auth.uid(), coalesce(nullif(v_name, ''), 'Cliente'), case when p_kind = 'store' then (st.fotos)[1] else pr.foto_url end,
          p_kind, case when p_kind = 'reco' then p_stars else 0 end, left(trim(p_text), 600),
          case when p_ref_id is null then null else p_ref_type end, p_ref_id, left(coalesce(p_ref_label, ''), 120))
  returning * into p;
  return p;
end $$;

create or replace function public.reply_post(p_post uuid, p_text text) returns public.post_replies
language plpgsql security definer set search_path = public as $$
declare p public.posts; st public.stores; pr public.profiles; r public.post_replies;
begin
  select * into p from public.posts where id = p_post;
  if p.id is null then raise exception 'Publicación no encontrada'; end if;
  if not (public.is_admin() or public.is_store_staff(p.store_id)) then raise exception 'Solo la tienda responde'; end if;
  if char_length(trim(coalesce(p_text, ''))) = 0 then raise exception 'Escribe tu respuesta'; end if;
  select * into st from public.stores where id = p.store_id;
  select * into pr from public.profiles where id = auth.uid();
  insert into public.post_replies (post_id, author_name, text)
  values (p_post, st.nombre || coalesce(' · ' || nullif(pr.nombre, ''), ''), left(trim(p_text), 500))
  returning * into r;
  return r;
end $$;

create or replace function public.moderate_post(p_post uuid, p_hide boolean, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare p public.posts; pr public.profiles;
begin
  select * into p from public.posts where id = p_post;
  if p.id is null then raise exception 'Publicación no encontrada'; end if;
  if not (public.is_admin() or public.is_store_staff(p.store_id)) then raise exception 'Sin permiso'; end if;
  if p_hide and coalesce(p_reason, '') not in ('ofensivo', 'spam', 'datos', 'otro') then raise exception 'Elige el motivo para ocultar'; end if;
  select * into pr from public.profiles where id = auth.uid();
  update public.posts set hidden = p_hide, hide_reason = case when p_hide then p_reason else '' end,
         hidden_by = case when p_hide then trim(coalesce(pr.nombre, '') || ' ' || coalesce(pr.apellidos, '')) else '' end
   where id = p_post;
end $$;

create or replace function public.toggle_like(p_post uuid) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  if exists (select 1 from public.post_likes where post_id = p_post and user_id = auth.uid()) then
    delete from public.post_likes where post_id = p_post and user_id = auth.uid();
  else
    insert into public.post_likes (post_id, user_id) values (p_post, auth.uid());
  end if;
  select count(*) into n from public.post_likes where post_id = p_post;
  update public.posts set likes = n where id = p_post;
  return n;
end $$;

-- El autor puede borrar su propia publicación
create or replace function public.delete_my_post(p_post uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.posts where id = p_post and user_id = auth.uid() and kind <> 'store';
  if not found then raise exception 'No puedes borrar esta publicación'; end if;
end $$;

revoke all on function public.create_post(uuid, text, int, text, text, uuid, text) from public, anon;
revoke all on function public.reply_post(uuid, text) from public, anon;
revoke all on function public.moderate_post(uuid, boolean, text) from public, anon;
revoke all on function public.toggle_like(uuid) from public, anon;
revoke all on function public.delete_my_post(uuid) from public, anon;
grant execute on function public.create_post(uuid, text, int, text, text, uuid, text) to authenticated;
grant execute on function public.reply_post(uuid, text) to authenticated;
grant execute on function public.moderate_post(uuid, boolean, text) to authenticated;
grant execute on function public.toggle_like(uuid) to authenticated;
grant execute on function public.delete_my_post(uuid) to authenticated;

-- Trazabilidad: quién ocultó/mostró publicaciones y quién dio seguimiento a calificaciones
do $$
declare t text;
begin
  if to_regprocedure('public.audit_row()') is not null then
    foreach t in array array['posts', 'ratings'] loop
      execute format('drop trigger if exists audit_%1$s on public.%1$I', t);
      execute format('create trigger audit_%1$s after update on public.%1$I for each row execute function public.audit_row()', t);
    end loop;
  end if;
end $$;
