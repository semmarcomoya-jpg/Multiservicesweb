-- =====================================================================
-- Crea el perfil si falta (por ejemplo, cuentas creadas antes de correr el SQL).
-- La app lo llama al entrar; solo crea el perfil de quien está conectado.
-- =====================================================================
create or replace function public.ensure_profile() returns public.profiles
language plpgsql security definer set search_path = public as $$
declare p public.profiles; u auth.users; v_code text;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  select * into p from public.profiles where id = auth.uid();
  if p.id is not null then return p; end if;
  select * into u from auth.users where id = auth.uid();
  loop
    v_code := 'CM-' || lpad((floor(random() * 1000000))::int::text, 6, '0');
    exit when not exists (select 1 from public.profiles where member_code = v_code);
  end loop;
  insert into public.profiles (id, nombre, apellidos, telefono, idioma, member_code)
  values (u.id,
          coalesce(u.raw_user_meta_data->>'nombre', split_part(coalesce(u.email, ''), '@', 1)),
          coalesce(u.raw_user_meta_data->>'apellidos', ''),
          coalesce(u.raw_user_meta_data->>'telefono', ''),
          case when u.raw_user_meta_data->>'idioma' = 'en' then 'en' else 'es' end,
          v_code)
  on conflict (id) do nothing
  returning * into p;
  if p.id is null then select * into p from public.profiles where id = auth.uid(); end if;
  return p;
end $$;
revoke all on function public.ensure_profile() from public, anon;
grant execute on function public.ensure_profile() to authenticated;

-- Perfiles para cuentas que ya existían antes de correr el SQL
insert into public.profiles (id, nombre, apellidos, telefono, member_code)
select u.id,
       coalesce(u.raw_user_meta_data->>'nombre', split_part(coalesce(u.email, ''), '@', 1)),
       coalesce(u.raw_user_meta_data->>'apellidos', ''),
       coalesce(u.raw_user_meta_data->>'telefono', ''),
       'CM-' || lpad((floor(random() * 1000000))::int::text, 6, '0')
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict do nothing;
