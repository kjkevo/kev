-- Phones could read every player's client_token (lets you act as them) and
-- device_key (tied to paid characters). Hide those columns from the public
-- roles; the game reads everything else, and joins hand each phone its own
-- token. Realtime respects column privileges too.
revoke select on public.players from anon, authenticated;
grant select (id, room_id, nickname, score, joined_at, team_members, left_at, team_id, avatar_id, is_bot)
  on public.players to anon, authenticated;

revoke select on public.feud_players from anon, authenticated;
grant select (id, room_id, team, nickname, joined_at, avatar_id) on public.feud_players to anon, authenticated;

revoke select on public.bingo_players from anon, authenticated;
grant select (id, room_id, nickname, joined_at, card, marked, score, bingo_at, avatar_id) on public.bingo_players to anon, authenticated;

-- Internal game functions (run by the game clock, never by phones) can no
-- longer be called from outside: before this, anyone could restart a venue's
-- games, add bots or force sudden death.
do $$
declare f record;
begin
  for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('restart_trivia_now', 'trivia_bot_fill', 'trivia_bot_topup',
      'trivia_bot_sudden_death', 'trivia_start_sudden_death', 'trivia_sudden_death_step',
      'trivia_sudden_death_next_round', 'game_events_on_room', 'game_events_on_team_answer',
      'trivia_lobby_extend_on_join')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;

alter function public.default_bingo_marked set search_path = public;
alter function public.check_bingo_win set search_path = public;
