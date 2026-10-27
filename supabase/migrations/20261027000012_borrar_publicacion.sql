-- =====================================================================
-- Castillo Multiservices · El administrador puede borrar definitivamente
-- una publicación de Boca a boca (con sus respuestas). Queda en la Bitácora
-- con el texto que tenía y el motivo.
-- =====================================================================
create or replace function public.admin_delete_post(p_post uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare p public.posts; pr public.profiles;
begin
  if not public.is_admin() then raise exception 'Solo el administrador puede borrar publicaciones'; end if;
  select * into p from public.posts where id = p_post;
  if p.id is null then raise exception 'Publicación no encontrada'; end if;
  select * into pr from public.profiles where id = auth.uid();
  delete from public.posts where id = p_post;
  insert into public.audit_log (user_id, user_name, user_role, tabla, accion, registro, titulo, store_id, cambios)
  values (auth.uid(), coalesce(nullif(trim(pr.nombre || ' ' || pr.apellidos), ''), pr.member_code, ''), 'admin', 'posts', 'borrar',
          p.id::text, left(p.author_name || ': ' || p.text, 120), p.store_id,
          jsonb_build_object('motivo', coalesce(nullif(p_reason, ''), 'otro'), 'autor', p.author_name, 'texto', p.text, 'tipo', p.kind));
end $$;
revoke all on function public.admin_delete_post(uuid, text) from public, anon;
grant execute on function public.admin_delete_post(uuid, text) to authenticated;
