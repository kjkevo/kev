-- Featured champion for the venue's QR display: someone who won 3+ trivia
-- games in a row this month (venue time). Players have no accounts, so a
-- player is identified across games by their phone (players.device_key,
-- linked right after joining). While test bots are on at a venue, bots count
-- too (by bot name) so the panel can be seen before real players arrive.

alter table public.players add column if not exists device_key text;
create index if not exists players_device_key_idx on public.players (device_key) where device_key is not null;

create or replace function public.link_player_device(p_room_id uuid, p_player_id uuid, p_client_token uuid, p_device_key text)
returns void language plpgsql security definer set search_path to 'public' as $function$
begin
  if length(coalesce(p_device_key, '')) not between 8 and 64 then
    return;
  end if;
  update public.players set device_key = p_device_key
    where id = p_player_id and room_id = p_room_id and client_token = p_client_token and device_key is null;
end;
$function$;
grant execute on function public.link_player_device(uuid, uuid, uuid, text) to anon, authenticated;

create or replace function public.get_trivia_champion(p_venue text)
returns table(o_nickname text, o_avatar_id text, o_emoji text, o_image_url text, o_streak int, o_last_win timestamptz)
language plpgsql stable security definer set search_path to 'public' as $function$
declare
  v public.venues;
  v_month_start timestamptz;
begin
  v := public.venue_by_slug(p_venue);
  if v.id is null then
    return;
  end if;
  v_month_start := date_trunc('month', now() at time zone v.timezone) at time zone v.timezone;

  return query
  with games as (
    -- Finished trivia games at this venue this month (played to the last question).
    select r.id, r.phase_started_at as ended_at
    from public.rooms r
    where r.venue_id = v.id and r.phase = 'final' and r.created_at >= v_month_start
      and r.current_question_index + 1 >= (select count(*) from public.room_questions rq where rq.room_id = r.id)
      and exists (select 1 from public.room_questions rq where rq.room_id = r.id)
  ), plays as (
    select coalesce(p.device_key, 'bot:' || p.nickname) as ident, p.nickname, p.avatar_id, g.ended_at,
      (t.score > 0 and t.score = (select max(t2.score) from public.teams t2 where t2.room_id = g.id)) as won
    from games g
    join public.players p on p.room_id = g.id
    join public.teams t on t.id = p.team_id
    where (p.device_key is not null) or (v.test_bots and p.nickname like 'BOT %')
  ), ordered as (
    select pl.*,
      row_number() over (partition by pl.ident order by pl.ended_at)
        - row_number() over (partition by pl.ident, pl.won order by pl.ended_at) as grp
    from plays pl
  ), streaks as (
    select o.ident, count(*)::int as streak, max(o.ended_at) as last_win
    from ordered o where o.won
    group by o.ident, o.grp
    having count(*) >= 3
  ), best as (
    select s.* from streaks s order by s.streak desc, s.last_win desc limit 1
  )
  select latest.nickname, latest.avatar_id, a.emoji, a.image_url, b.streak, b.last_win
  from best b
  cross join lateral (
    select pl.nickname, pl.avatar_id from plays pl where pl.ident = b.ident order by pl.ended_at desc limit 1
  ) latest
  left join public.avatars a on a.id = latest.avatar_id;
end;
$function$;
grant execute on function public.get_trivia_champion(text) to anon, authenticated;
