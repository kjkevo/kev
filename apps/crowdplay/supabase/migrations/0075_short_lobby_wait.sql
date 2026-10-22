-- Shorter lobby wait (while autoplay is paused): the countdown starts at
-- 90 seconds when the first real player joins, and each new player adds
-- 30 seconds, up to 4 minutes after that first join.
do $$
declare d text;
begin
  d := pg_get_functiondef('public.tick'::regproc);
  d := replace(d,
$old$      update public.rooms set starts_at = now() + make_interval(secs => v_lobby_boarding_seconds)
        where id = v_room.id;$old$,
$new$      update public.rooms set starts_at = now() + interval '90 seconds'
        where id = v_room.id;$new$);
  if position($p$interval '90 seconds'$p$ in d) = 0 then
    raise exception 'tick patch did not apply';
  end if;
  execute d;
end $$;

create or replace function public.trivia_lobby_extend_on_join()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare
  v_first timestamptz;
begin
  if new.is_bot or public.feature_on('trivia_autoplay') then
    return new;
  end if;
  select min(pl.joined_at) into v_first from public.players pl
    where pl.room_id = new.room_id and not pl.is_bot and pl.left_at is null;
  update public.rooms r
    set starts_at = least(r.starts_at + interval '30 seconds', v_first + interval '4 minutes')
    where r.id = new.room_id and r.phase = 'lobby' and not r.queued
      and r.starts_at is not null and r.starts_at > now()
      and r.starts_at < v_first + interval '4 minutes';
  return new;
end;
$function$;

drop trigger if exists trivia_lobby_extend_on_join on public.players;
create trigger trivia_lobby_extend_on_join after insert on public.players
  for each row execute function public.trivia_lobby_extend_on_join();
