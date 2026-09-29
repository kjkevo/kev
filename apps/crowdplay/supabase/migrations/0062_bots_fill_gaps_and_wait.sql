-- Bots only fill gaps, and let real players answer first.
--
-- Filling (lobby only, venues with bots on): bots top the room up to 12
-- players (3 teams of 4). Every real player who joins replaces a bot; at 12
-- or more real players there are no bots. Bots play on their own teams and
-- never join a real player's team. Once a game starts its bots stay for it.
--
-- Answering:
-- * Bots on their own team answer a few seconds after every real player in
--   the room has answered, or late in the timer if people are still thinking.
-- * Bots on a real player's team (only if a player joined theirs) go along
--   with that player's answer, so they can never outvote them; if nobody on
--   the team has answered by about 75% of the time, they answer on their own.
-- * Sudden death: bots take 8-15 seconds instead of 3-10.

create or replace function public.trivia_is_bot(p_nickname text)
returns boolean language sql immutable as $$ select p_nickname like 'BOT %' $$;

-- Adds or removes lobby bots so humans + bots = 12 (no bots at 12+ humans).
create or replace function public.trivia_bot_fill(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_fill_to constant int := 12;
  v_bot_team_size constant int := 4;
  v_names constant text[] := array['BOT Ava','BOT Ben','BOT Cleo','BOT Dev','BOT Fay','BOT Gus','BOT Hana','BOT Ivan',
                                   'BOT Jo','BOT Kai','BOT Lou','BOT Max','BOT Nia','BOT Oz','BOT Pip','BOT Quinn'];
  v_room public.rooms;
  v_humans int;
  v_bots int;
  v_target int;
  v_team uuid;
  v_name text;
  v_extra record;
  i int;
begin
  select * into v_room from public.rooms where id = p_room_id;
  if v_room.phase <> 'lobby' then
    return;
  end if;
  select count(*) filter (where not public.trivia_is_bot(pl.nickname)),
         count(*) filter (where public.trivia_is_bot(pl.nickname))
    into v_humans, v_bots
    from public.players pl where pl.room_id = p_room_id and pl.left_at is null;
  v_target := greatest(0, v_fill_to - v_humans);

  -- Too many: remove bots, emptiest bot teams first, then drop empty teams.
  if v_bots > v_target then
    for v_extra in
      select pl.id from public.players pl
      where pl.room_id = p_room_id and pl.left_at is null and public.trivia_is_bot(pl.nickname)
      order by (select count(*) from public.players p2 where p2.team_id = pl.team_id and p2.left_at is null), pl.joined_at desc
      limit v_bots - v_target
    loop
      delete from public.players where id = v_extra.id;
    end loop;
    delete from public.teams t where t.room_id = p_room_id
      and not exists (select 1 from public.players pl where pl.team_id = t.id);
    return;
  end if;

  -- Too few: fill bot-only teams up to 4, then start new bot teams.
  for i in 1 .. (v_target - v_bots) loop
    select n into v_name from unnest(v_names) n
      where not exists (select 1 from public.players pl where pl.room_id = p_room_id and lower(pl.nickname) = lower(n))
      limit 1;
    exit when v_name is null;
    v_team := null;
    select t.id into v_team from public.teams t
      where t.room_id = p_room_id and not t.locked
        and exists (select 1 from public.players pl where pl.team_id = t.id and pl.left_at is null)
        and not exists (select 1 from public.players pl where pl.team_id = t.id and pl.left_at is null and not public.trivia_is_bot(pl.nickname))
        and (select count(*) from public.players pl where pl.team_id = t.id and pl.left_at is null) < v_bot_team_size
      order by t.created_at limit 1;
    begin
      if v_team is not null then
        perform public.join_room(v_room.code, v_name, v_team, null,
          case when hashtext(v_name) % 2 = 0 then 'jungle-scout' else 'crystal-titan' end, null);
      else
        perform public.join_room(v_room.code, v_name, null, public.trivia_fun_team_name(p_room_id),
          case when hashtext(v_name) % 2 = 0 then 'jungle-scout' else 'crystal-titan' end, null);
      end if;
    exception when others then
      exit; -- room or team limits reached
    end;
  end loop;
end;
$$;

create or replace function public.trivia_bot_autopilot()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  b record;
  r record;
  ans text;
  acc numeric;
  v_limit int;
  v_age numeric;
  v_humans_left int;
  v_mate_answer text;
  v_mate_at timestamptz;
  v_mates int;
  v_last_human_at timestamptz;
  v_go boolean;
begin
  -- Keep the boarding lobby topped up to 12 players.
  for r in select ro.id from rooms ro join venues ve on ve.id = ro.venue_id and ve.active and ve.test_bots
           where not ro.retired and not ro.queued and ro.phase = 'lobby' loop
    perform trivia_bot_fill(r.id);
  end loop;

  -- Category vote: once every real player has voted.
  for b in select p.id, p.client_token, ro.id room_id, ro.category_options opts from players p join rooms ro on ro.id=p.room_id
           where not ro.retired and ro.phase='lobby' and trivia_is_bot(p.nickname) and p.left_at is null
             and not exists (select 1 from category_votes cv where cv.player_id=p.id)
             and exists (select 1 from players h where h.room_id=ro.id and not trivia_is_bot(h.nickname) and h.left_at is null)
             and not exists (select 1 from players h where h.room_id=ro.id and not trivia_is_bot(h.nickname) and h.left_at is null
                             and not exists (select 1 from category_votes cv where cv.player_id=h.id)) loop
    perform cast_vote(b.room_id, b.id, b.client_token, b.opts[1 + floor(random()*array_length(b.opts,1))::int]);
  end loop;

  -- Answers: real players first.
  for b in select p.id, p.client_token, p.nickname, p.team_id, ro.id room_id, ro.question_started_at, q.id qid, q.choices,
                  q.correct_index, q.difficulty, q.time_limit_seconds
           from players p join rooms ro on ro.id=p.room_id
           join room_questions rq on rq.room_id=ro.id and rq.order_index=ro.current_question_index
           join questions q on q.id=rq.question_id
           where not ro.retired and ro.phase='question' and trivia_is_bot(p.nickname) and p.left_at is null
             and now() >= ro.question_started_at + interval '3 seconds'
             and not exists (select 1 from answers a where a.player_id=p.id and a.question_id=q.id) loop
    v_limit := coalesce(b.time_limit_seconds, 35);
    v_age := extract(epoch from now() - b.question_started_at);
    v_go := false;
    ans := null;

    -- Real teammates? Go along with the first one who answered.
    select count(*) into v_mates from players h
      where h.team_id = b.team_id and h.left_at is null and not trivia_is_bot(h.nickname);
    if v_mates > 0 then
      select a.answer_text, a.answered_at into v_mate_answer, v_mate_at from answers a join players h on h.id = a.player_id
        where a.question_id = b.qid and h.team_id = b.team_id and not trivia_is_bot(h.nickname) and a.answer_text is not null
        order by a.answered_at limit 1;
      if v_mate_answer is not null and now() >= v_mate_at + make_interval(secs => 2 + abs(hashtext(b.id::text || b.qid::text)) % 4) then
        ans := v_mate_answer;
        v_go := true;
      elsif v_mate_answer is null and v_age >= v_limit * 0.75 + abs(hashtext(b.id::text || b.qid::text)) % 3 then
        v_go := true;
      end if;
    else
      -- Own team: after every real player in the room has answered, or late.
      select count(*) into v_humans_left from players h
        where h.room_id = b.room_id and h.left_at is null and h.team_id is not null and not trivia_is_bot(h.nickname)
          and not exists (select 1 from answers a where a.player_id = h.id and a.question_id = b.qid);
      select max(a.answered_at) into v_last_human_at from answers a join players h on h.id = a.player_id
        where a.question_id = b.qid and h.room_id = b.room_id and not trivia_is_bot(h.nickname);
      if v_humans_left = 0 and now() >= coalesce(v_last_human_at, b.question_started_at)
                                         + make_interval(secs => 2 + abs(hashtext(b.id::text || b.qid::text)) % 5) then
        v_go := true;
      elsif v_age >= v_limit * 0.55 + abs(hashtext(b.id::text || b.qid::text)) % greatest(1, (v_limit * 0.3)::int) then
        v_go := true;
      end if;
    end if;
    continue when not v_go;

    if ans is null then
      acc := 0.4 + (abs(hashtext(b.nickname)) % 50) / 100.0 - case when b.difficulty='hard' then 0.3 else 0 end;
      if random() < acc then
        ans := b.choices->>b.correct_index;
        if random() < 0.2 and length(ans) > 5 then ans := overlay(ans placing '' from 3 + floor(random()*(length(ans)-4))::int for 1); end if;
      else
        ans := b.choices->>((b.correct_index + 1 + floor(random()*3)::int) % 4);
      end if;
    end if;
    begin perform cast_team_vote(b.room_id, b.id, b.client_token, b.qid, lower(ans)); exception when others then null; end;
  end loop;

  perform trivia_bot_sudden_death();
end $$;

-- Sudden death: bots take 8-15 seconds, so a real player isn't rushed.
create or replace function public.trivia_bot_sudden_death()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  b record;
  v_ans text;
begin
  for b in
    select p.id, p.client_token, r.id room_id, q.choices, q.correct_index
    from public.rooms r
    join public.questions q on q.id = r.sd_question_id
    join public.players p on p.id = any(r.sd_player_ids)
    where not r.retired and r.phase = 'sudden_death' and public.trivia_is_bot(p.nickname) and p.left_at is null
      and now() >= r.sd_started_at + make_interval(secs => 8 + abs(hashtext(p.id::text || r.sd_round::text)) % 8)
      and not exists (select 1 from public.sudden_death_answers a where a.room_id = r.id and a.round = r.sd_round and a.player_id = p.id)
  loop
    v_ans := case when random() < 0.6 then b.choices->>b.correct_index
                  else b.choices->>((b.correct_index + 1 + floor(random() * 3)::int) % 4) end;
    begin
      perform public.submit_sudden_death_answer(b.room_id, b.id, b.client_token, v_ans);
    exception when others then null;
    end;
  end loop;
end;
$$;

-- At game start ("nobody plays alone"): a lone bot only joins another bot
-- team, or sits the game out; a lone real player prefers a team with real
-- players. (Patches finalize_voting_and_start from 0060 in place.)
do $$
declare d text;
begin
  d := pg_get_functiondef('public.finalize_voting_and_start'::regproc);
  d := replace(d, E'    select pl.id player_id, pl.team_id from public.players pl\n',
                  E'    select pl.id player_id, pl.team_id, public.trivia_is_bot(pl.nickname) is_bot from public.players pl\n');
  d := replace(d, E'    select t.id into v_target from public.teams t\n      where t.room_id = p_room_id and t.id <> v_alone.team_id\n        and (select count(*) from public.players p2 where p2.team_id = t.id and p2.left_at is null) between 1 and v_max_team_size - 1\n      order by random() limit 1;\n    if v_target is not null then\n      update public.players set team_id = v_target where id = v_alone.player_id;\n    end if;',
    E'    -- A lone bot only joins another bot team (or sits out); a lone real\n    -- player prefers a team with real players on it.\n    v_target := null;\n    select t.id into v_target from public.teams t\n      where t.room_id = p_room_id and t.id <> v_alone.team_id\n        and (select count(*) from public.players p2 where p2.team_id = t.id and p2.left_at is null) between 1 and v_max_team_size - 1\n        and (not v_alone.is_bot or not exists (select 1 from public.players p2 where p2.team_id = t.id and p2.left_at is null\n                                                 and not public.trivia_is_bot(p2.nickname)))\n      order by exists (select 1 from public.players p2 where p2.team_id = t.id and p2.left_at is null\n                        and not public.trivia_is_bot(p2.nickname)) desc, random()\n      limit 1;\n    if v_target is not null then\n      update public.players set team_id = v_target where id = v_alone.player_id;\n    elsif v_alone.is_bot then\n      delete from public.players where id = v_alone.player_id;\n    end if;');
  if position('v_alone.is_bot' in d) = 0 then
    raise exception 'finalize_voting_and_start patch did not apply';
  end if;
  execute d;
end $$;
