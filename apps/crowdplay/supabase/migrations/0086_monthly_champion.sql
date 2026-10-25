-- Champion of the month on the main menu: the real player (by device) with
-- the most trivia wins at the venue this month. Games that ended early for
-- being idle don't count. The " ·3bb7" tag added to duplicate names is
-- dropped for display.
create or replace function public.get_monthly_champion(p_venue text)
returns table(o_nickname text, o_avatar_id text, o_emoji text, o_image_url text, o_wins int, o_games int, o_month text)
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
    select r.id, r.phase_started_at as ended_at
    from public.rooms r
    where r.venue_id = v.id and r.phase = 'final' and r.created_at >= v_month_start
      and coalesce(r.ended_reason, '') <> 'idle'
      and exists (select 1 from public.room_questions rq where rq.room_id = r.id)
  ), plays as (
    select p.device_key as ident, p.nickname, p.avatar_id, g.ended_at,
      (t.score > 0 and t.score = (select max(t2.score) from public.teams t2 where t2.room_id = g.id)) as won
    from games g
    join public.players p on p.room_id = g.id and not p.is_bot and p.device_key is not null
    join public.teams t on t.id = p.team_id
  ), tally as (
    select ident, count(*) filter (where won)::int wins, count(*)::int games, max(ended_at) filter (where won) last_win
    from plays group by ident
  ), best as (
    select * from tally where wins > 0 order by wins desc, last_win desc limit 1
  )
  select regexp_replace(latest.nickname, ' ·[0-9a-z]{4}$', ''), latest.avatar_id, a.emoji, a.image_url, b.wins, b.games,
    to_char(now() at time zone v.timezone, 'FMMonth')
  from best b
  cross join lateral (
    select pl.nickname, pl.avatar_id from plays pl where pl.ident = b.ident order by pl.ended_at desc limit 1
  ) latest
  left join public.avatars a on a.id = latest.avatar_id;
end;
$function$;
grant execute on function public.get_monthly_champion(text) to anon, authenticated;
