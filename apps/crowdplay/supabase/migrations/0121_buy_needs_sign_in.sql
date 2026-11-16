-- Buying a character needs a signed-in account first, so it's never lost
-- with a cleared browser or a new phone (sign in again to get it back).
do $x$
declare f text; g text;
begin
  select pg_get_functiondef('public.start_purchase'::regproc) into f;
  g := E'  if p_item_type = ''avatar'' then\n';
  if position(g in f) = 0 then raise exception 'start_purchase anchor'; end if;
  execute replace(f, g,
    E'  if not exists (select 1 from public.profile_devices d join public.profiles p on p.id = d.profile_id\n'
    || E'                 where d.device_key = p_device_key and p.user_id is not null) then\n'
    || E'    raise exception ''SIGN_IN_FIRST'';\n  end if;\n' || g);
end $x$;
