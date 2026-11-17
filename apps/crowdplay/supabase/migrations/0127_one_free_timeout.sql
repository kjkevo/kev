-- Bad bar Wi-Fi: the first time a real player's turn runs out in a Drop Line
-- or Wild Match game, they get 20 more seconds instead of the game moving for
-- them ("<name> gets extra time"). The next time, it moves for them as before.
alter table public.dl_players add column if not exists grace_used boolean not null default false;
alter table public.wm_players add column if not exists grace_used boolean not null default false;

do $x$
declare f text; g text;
begin
  select pg_get_functiondef('public.dl_tick'::regproc) into f;
  g := E'      if not p.is_bot and p.left_at is null then\n        perform public.dl_log(r.id, p.nickname || '' ran out of time'');';
  if position(g in f) = 0 then raise exception 'dl_tick anchor'; end if;
  execute replace(f, g,
    E'      if not p.is_bot and p.left_at is null then\n'
    || E'        if not p.grace_used then\n'
    || E'          update public.dl_players set grace_used = true where id = p.id;\n'
    || E'          update public.dl_rooms set turn_limit = turn_limit + 20 where id = r.id;\n'
    || E'          perform public.dl_log(r.id, p.nickname || '' gets extra time'');\n'
    || E'          continue;\n'
    || E'        end if;\n'
    || E'        perform public.dl_log(r.id, p.nickname || '' ran out of time'');');

  select pg_get_functiondef('public.wm_tick'::regproc) into f;
  g := E'      perform public.wm_log(r.id, p.nickname || '' ran out of time'');';
  if position(g in f) = 0 then raise exception 'wm_tick anchor'; end if;
  execute replace(f, g,
    E'      if not p.grace_used then\n'
    || E'        update public.wm_players set grace_used = true where id = p.id;\n'
    || E'        update public.wm_rooms set turn_started_at = now() - interval ''5 seconds'' where id = r.id;\n'
    || E'        perform public.wm_log(r.id, p.nickname || '' gets extra time'');\n'
    || E'        continue;\n'
    || E'      end if;\n'
    || g);
end $x$;
