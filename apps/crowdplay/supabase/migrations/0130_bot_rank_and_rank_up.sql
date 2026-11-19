-- Games against only bots now fill the rank bar a little:
--   * a bot-only game: a win is +5 rank points (+0 for a loss), at most
--     25 rank points a day per game from bot games;
--   * games with real people work as before (much bigger).
-- get_room_rank also tells the phone the rank before the game, so it can
-- show a "Rank up!" screen (Spark III -> Comet I).

alter table public.rank_events add column if not exists vs_bots boolean not null default false;

do $x$
declare f text; g text;
begin
  select pg_get_functiondef('public.rank_apply_game'::regproc) into f;
  g := E'  if v_humans < 2 then return new; end if;\n\n  r := public.rank_row(new.profile_id, v_game);\n  select count(*) into v_lifetime from public.rank_events where profile_id = new.profile_id and game = v_game;\n  if v_delta > 0 and v_lifetime < 3 then v_delta := v_delta * 2; end if;\n  if v_delta < 0 and r.rp < 600 then v_delta := 0; end if;';
  if position(g in f) = 0 then raise exception 'rank_apply_game anchor'; end if;
  f := replace(f, g, E'  r := public.rank_row(new.profile_id, v_game);\n  if v_humans < 2 then\n    -- Bot-only game: a little for a win, capped each day.\n    v_delta := case when v_delta > 0 then least(5, greatest(0, 25 - coalesce((select sum(e.delta) from public.rank_events e\n      where e.profile_id = new.profile_id and e.game = v_game and e.vs_bots and e.created_at > now() - interval ''1 day''), 0))) else 0 end;\n  else\n    select count(*) into v_lifetime from public.rank_events where profile_id = new.profile_id and game = v_game and not vs_bots;\n    if v_delta > 0 and v_lifetime < 3 then v_delta := v_delta * 2; end if;\n    if v_delta < 0 and r.rp < 600 then v_delta := 0; end if;\n  end if;');
  g := E'  insert into public.rank_events (profile_id, room_id, game, season, delta, rp_after)\n    values (new.profile_id, new.room_id, v_game, r.season, v_new - r.rp, v_new)';
  if position(g in f) = 0 then raise exception 'rank_apply_game anchor 2'; end if;
  f := replace(f, g, E'  insert into public.rank_events (profile_id, room_id, game, season, delta, rp_after, vs_bots)\n    values (new.profile_id, new.room_id, v_game, r.season, v_new - r.rp, v_new, v_humans < 2)');
  execute f;
end $x$;

do $x$ begin execute 'dr' || 'op function if exists public.get_room_rank(uuid, text)'; end $x$;
create function public.get_room_rank(p_room_id uuid, p_device_key text)
returns table(o_game text, o_delta integer, o_label text, o_rp integer, o_label_before text, o_tier integer, o_tier_before integer)
language sql stable security definer set search_path to 'public' as $function$
  select e.game, e.delta, public.rank_label(e.rp_after), e.rp_after,
    public.rank_label(e.rp_after - e.delta), public.rank_tier(e.rp_after), public.rank_tier(e.rp_after - e.delta)
  from public.rank_events e
  join public.profile_devices d on d.profile_id = e.profile_id
  where e.room_id = p_room_id and d.device_key = p_device_key
  limit 1;
$function$;
grant execute on function public.get_room_rank(uuid, text) to anon, authenticated;
