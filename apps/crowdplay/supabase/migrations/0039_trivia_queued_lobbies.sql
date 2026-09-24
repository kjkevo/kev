-- Queued lobbies for busy nights. While a game is running (or the open
-- lobby is full at 8 teams of 5), people can sign up for the next game
-- instead of waiting to be let in. A queued lobby has no start time yet;
-- if it fills up, another opens behind it. When the current game finishes,
-- the oldest queued lobby becomes the live one and its 4-minute countdown
-- starts, so latecomers still get a chance to join it.

alter table public.rooms add column if not exists queued boolean not null default false;
-- Line order for queued lobbies (clock time, so two opened in one tick still sort).
alter table public.rooms add column if not exists queued_at timestamptz;
grant select (queued, queued_at) on public.rooms to anon, authenticated;

create index if not exists rooms_venue_live_idx on public.rooms (venue_id, created_at) where not retired;

-- A lobby is full once it holds 8 teams of 5.
create or replace function public.trivia_room_full(p_room_id uuid)
returns boolean language sql stable security definer set search_path to 'public' as $function$
  select (select count(*) from public.players pl where pl.room_id = p_room_id and pl.left_at is null) >= 40;
$function$;
revoke execute on function public.trivia_room_full(uuid) from anon, authenticated, public;

-- The upcoming games at a venue, in the order they'll be played, and how
-- far along the game on now is. rounds_to_wait = games still to finish
-- before this one starts.
create or replace function public.trivia_queue(p_venue_id uuid)
returns table(o_room_id uuid, o_code text, o_rounds_to_wait int, o_players int, o_teams int, o_full boolean,
              o_current_phase text, o_current_question int, o_current_total int)
language sql stable security definer set search_path to 'public' as $function$
  with cur as (
    select r.id, r.phase, r.current_question_index,
      (select count(*)::int from public.room_questions rq where rq.room_id = r.id) total
    from public.rooms r
    where r.venue_id = p_venue_id and not r.retired and not r.queued
    order by r.created_at desc limit 1
  )
  select q.id, q.code, (row_number() over (order by q.queued_at, q.created_at))::int,
    (select count(*)::int from public.players pl where pl.room_id = q.id and pl.left_at is null),
    public.trivia_live_team_count(q.id),
    public.trivia_room_full(q.id),
    (select phase from cur), (select current_question_index + 1 from cur), (select total from cur)
  from public.rooms q
  where q.venue_id = p_venue_id and not q.retired and q.queued
  order by q.queued_at, q.created_at;
$function$;
grant execute on function public.trivia_queue(uuid) to anon, authenticated;

create or replace function public.tick()
returns void language plpgsql security definer set search_path to 'public' as $function$
declare
  v_final_dwell constant int := 20;
  v_lobby_boarding_seconds constant int := 240;
  v_skip_to_seconds constant int := 5;
  v_max_queued constant int := 6;
  v_room record;
  v_venue record;
  v_total int;
  v_question_id uuid;
  v_active int;
  v_done int;
  v_next uuid;
begin
  for v_room in select * from public.rooms where not retired and not queued loop

    if v_room.phase = 'lobby' and v_room.starts_at is not null then
      if v_room.starts_at <= now() then
        perform public.finalize_voting_and_start(v_room.id);
      elsif v_room.starts_at > now() + make_interval(secs => v_skip_to_seconds) then
        select count(*) into v_active from public.players pl
          where pl.room_id = v_room.id and pl.left_at is null;
        select count(*) into v_done from public.category_votes cv
          join public.players pl on pl.id = cv.player_id
          where cv.room_id = v_room.id and pl.left_at is null and cv.choice_pack_id is not null;
        if v_active > 0 and v_done >= v_active then
          update public.rooms set starts_at = now() + make_interval(secs => v_skip_to_seconds)
            where id = v_room.id;
        end if;
      end if;

    elsif v_room.phase = 'question' then
      select q.time_limit_seconds, q.id into v_total, v_question_id
        from public.room_questions rq join public.questions q on q.id = rq.question_id
        where rq.room_id = v_room.id and rq.order_index = v_room.current_question_index;

      if now() >= v_room.question_started_at + make_interval(secs => v_total) then
        perform public.finalize_question_scoring(v_room.id);

        select count(*) into v_total from public.room_questions where room_id = v_room.id;
        if v_room.current_question_index + 1 >= v_total then
          perform public.finalize_final_scores(v_room.id);
          update public.rooms set phase = 'final', phase_started_at = now() where id = v_room.id;
        else
          update public.rooms set
            phase = 'question', current_question_index = v_room.current_question_index + 1,
            question_started_at = now(), phase_started_at = now(), revealed_correct_index = null
          where id = v_room.id;
        end if;

      elsif v_room.question_started_at + make_interval(secs => v_total)
            > now() + make_interval(secs => v_skip_to_seconds) then
        select count(*) into v_active from public.players pl
          where pl.room_id = v_room.id and pl.left_at is null and pl.team_id is not null;
        select count(*) into v_done from public.answers a
          join public.players pl on pl.id = a.player_id
          where a.question_id = v_question_id and pl.room_id = v_room.id
            and pl.left_at is null and pl.team_id is not null;
        if v_active > 0 and v_done >= v_active then
          update public.rooms set
            question_started_at = now() - make_interval(secs => v_total - v_skip_to_seconds),
            phase_started_at = now() - make_interval(secs => v_total - v_skip_to_seconds)
          where id = v_room.id;
        end if;
      end if;

    elsif v_room.phase = 'final' then
      if now() >= v_room.phase_started_at + make_interval(secs => v_final_dwell) then
        update public.rooms set retired = true where id = v_room.id;
      end if;
    end if;

  end loop;

  for v_venue in select ve.id from public.venues ve where ve.active loop
    -- No live game: the next game in line goes live and starts boarding
    -- (or a fresh lobby opens if nobody queued up).
    if not exists (select 1 from public.rooms r where r.venue_id = v_venue.id and not r.retired and not r.queued) then
      v_next := null;
      select r.id into v_next from public.rooms r
        where r.venue_id = v_venue.id and not r.retired and r.queued
        order by r.queued_at, r.created_at limit 1
        for update skip locked;
      if v_next is not null then
        update public.rooms set queued = false, phase_started_at = now(),
          starts_at = now() + make_interval(secs => v_lobby_boarding_seconds)
          where id = v_next;
      else
        perform public.create_room(now() + make_interval(secs => v_lobby_boarding_seconds), v_venue.id);
      end if;
    end if;

    -- Nowhere to join (a game is running, or every lobby is full): open
    -- the next lobby in line.
    if not exists (
      select 1 from public.rooms r
      where r.venue_id = v_venue.id and not r.retired and r.phase = 'lobby' and not public.trivia_room_full(r.id)
    ) and (select count(*) from public.rooms r where r.venue_id = v_venue.id and not r.retired and r.queued) < v_max_queued then
      -- Two statements: an update can't see a row its own subquery inserts.
      select cr.room_id into v_next from public.create_room(null, v_venue.id) cr;
      update public.rooms set queued = true, queued_at = clock_timestamp() where id = v_next;
    end if;
  end loop;
end;
$function$;

-- Watchdog: queued lobbies are expected to have no start time and to sit
-- alongside the live game, so leave them out of those two checks.
do $$
declare
  v_def text;
  v_old text;
begin
  v_def := pg_get_functiondef('public.ops_watchdog()'::regprocedure);

  v_old := 'where not r.retired and r.id <> (select r2.id from public.rooms r2 where not r2.retired and r2.venue_id = r.venue_id order by r2.created_at desc limit 1)';
  if position(v_old in v_def) = 0 then
    raise exception 'ops_watchdog() duplicate-room check not found';
  end if;
  v_def := replace(v_def, v_old,
    'where not r.retired and not r.queued and r.id <> (select r2.id from public.rooms r2 where not r2.retired and not r2.queued and r2.venue_id = r.venue_id order by r2.created_at desc limit 1)');

  v_old := 'from public.rooms where not retired and phase = ''lobby'' and starts_at is null loop';
  if position(v_old in v_def) = 0 then
    raise exception 'ops_watchdog() lobby-start check not found';
  end if;
  v_def := replace(v_def, v_old, 'from public.rooms where not retired and not queued and phase = ''lobby'' and starts_at is null loop');

  execute v_def;
end;
$$;
