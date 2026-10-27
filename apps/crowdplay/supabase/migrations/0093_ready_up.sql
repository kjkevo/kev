-- "Ready" in the trivia lobby: each real player taps Ready when set. Once
-- every real player in the lobby is ready the countdown jumps to 5 seconds;
-- otherwise the countdown runs as before, so nobody can stall the game.
-- (This replaces "everyone voted on the category" as the early start.)
alter table public.players add column if not exists ready boolean not null default false;
grant select (ready) on public.players to anon, authenticated;

create or replace function public.set_player_ready(p_room_id uuid, p_player_id uuid, p_client_token uuid, p_ready boolean)
returns void language plpgsql security definer set search_path to 'public' as $function$
begin
  if not exists (select 1 from public.rooms r where r.id = p_room_id and r.phase = 'lobby') then
    raise exception 'NOT_IN_LOBBY';
  end if;
  update public.players set ready = p_ready
    where id = p_player_id and room_id = p_room_id and client_token = p_client_token and left_at is null and not is_bot;
  if not found then
    raise exception 'NOT_AUTHORIZED';
  end if;
end;
$function$;
grant execute on function public.set_player_ready(uuid, uuid, uuid, boolean) to anon, authenticated;

do $patch$
declare d text; n text;
begin
  d := pg_get_functiondef('public.tick()'::regprocedure);
  n := replace(d, $a$        select count(*) into v_active from public.players pl
          where pl.room_id = v_room.id and pl.left_at is null;
        select count(*) into v_done from public.category_votes cv
          join public.players pl on pl.id = cv.player_id
          where cv.room_id = v_room.id and pl.left_at is null and cv.choice_pack_id is not null;$a$,
  $a$        -- Every real player tapped Ready: start in 5 seconds.
        select count(*), count(*) filter (where pl.ready) into v_active, v_done from public.players pl
          where pl.room_id = v_room.id and pl.left_at is null and not pl.is_bot;$a$);
  if n = d then raise exception 'tick ready patch did not apply'; end if;
  execute n;
end $patch$;
