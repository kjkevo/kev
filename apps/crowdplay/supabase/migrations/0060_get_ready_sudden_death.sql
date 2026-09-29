-- 1. A 5-second "Get ready" before question 1 (phones and the TV show the
--    category and a countdown; the question appears when it hits zero).
-- 2. Look-alike questions: short topic words like "god" now count, so "God of
--    Mischief" and "God of Thunder" don't land in the same game.
-- 3. Sudden death when teams tie for 1st: each tied team sends up one
--    teammate, they all answer the same question, and anyone who gets it
--    wrong while someone else gets it right is out. Last team standing wins
--    (plus 100 points). Up to 5 rounds, rotating teammates.

-- 1. Get ready ---------------------------------------------------------------

create or replace function public.finalize_voting_and_start(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_max_team_size constant int := 5;
  v_room public.rooms;
  v_winner uuid;
  v_question_ids uuid[] := '{}';
  v_questions_per_game constant int := 20;
  v_per_difficulty constant int := 10;
  v_alone record;
  v_target uuid;
  v_pass int;
  c record;
  v_answer_words text[] := '{}';
  v_prompt_words text[] := '{}';
  v_topic_pairs text[] := '{}';
  v_topics text[] := '{}';
  v_easy int := 0;
  v_hard int := 0;
  v_a text[];
  v_p text[];
  v_pairs text[];
  v_t text[];
begin
  select * into v_room from public.rooms where id = p_room_id for update;
  if not found or v_room.phase <> 'lobby' then
    return;
  end if;

  -- Nobody plays alone if another team has room: move anyone still on a
  -- team by themselves onto a random team with space.
  for v_alone in
    select pl.id player_id, pl.team_id from public.players pl
    where pl.room_id = p_room_id and pl.left_at is null and pl.team_id is not null
      and (select count(*) from public.players p2 where p2.team_id = pl.team_id and p2.left_at is null) = 1
    order by pl.joined_at
  loop
    continue when (select count(*) from public.players p2 where p2.team_id = v_alone.team_id and p2.left_at is null) <> 1;
    select t.id into v_target from public.teams t
      where t.room_id = p_room_id and t.id <> v_alone.team_id
        and (select count(*) from public.players p2 where p2.team_id = t.id and p2.left_at is null) between 1 and v_max_team_size - 1
      order by random() limit 1;
    if v_target is not null then
      update public.players set team_id = v_target where id = v_alone.player_id;
    end if;
  end loop;
  delete from public.teams t where t.room_id = p_room_id
    and not exists (select 1 from public.players pl where pl.team_id = t.id);

  update public.teams set locked = true where room_id = p_room_id;

  select cv.choice_pack_id into v_winner
    from public.category_votes cv
    where cv.room_id = p_room_id and cv.choice_pack_id is not null
    group by cv.choice_pack_id
    order by count(*) desc, random()
    limit 1;

  if v_winner is null and v_room.category_options is not null then
    v_winner := v_room.category_options[1 + floor(random() * array_length(v_room.category_options, 1))::int];
  end if;

  -- Least recently used first, half easy and half hard. A question is
  -- skipped if its answer shares a word with an answer already picked
  -- (Netflix, Netflix), if its answer is named in a picked question or the
  -- other way round (Berlin Wall, capital of Germany), or if it is about the
  -- same topic as a picked question (two capitals, two mountain ranges).
  -- Each later pass relaxes a rule so a small category still fills the game:
  -- pass 1 drops the easy/hard balance, pass 2 allows two per topic,
  -- pass 3 drops the topic rules but still never repeats an answer,
  -- pass 4 drops everything.
  for v_pass in 0..4 loop
    exit when coalesce(array_length(v_question_ids, 1), 0) >= v_questions_per_game;
    for c in
      select q.id, q.difficulty, q.prompt, q.choices->>q.correct_index answer
      from public.questions q
      where q.pack_id = v_winner and q.active and not q.id = any(v_question_ids)
      order by q.last_used_at nulls first, random()
    loop
      exit when coalesce(array_length(v_question_ids, 1), 0) >= v_questions_per_game;
      continue when v_pass = 0 and ((c.difficulty = 'hard' and v_hard >= v_per_difficulty)
                                    or (c.difficulty <> 'hard' and v_easy >= v_per_difficulty));
      select coalesce(array_agg(distinct t), '{}') into v_a
        from unnest(public.trivia_tokens(c.answer)) t where not public.trivia_generic_token(t);
      v_p := public.trivia_topic_tokens(c.prompt);
      select coalesce(array_agg(v_p[i] || ' ' || v_p[i + 1]), '{}') into v_pairs
        from generate_series(1, coalesce(array_length(v_p, 1), 0) - 1) i;
      v_t := public.trivia_topic_words(c.prompt);
      if (v_pass < 4 and (
           v_a && v_answer_words
        or exists (select 1 from unnest(v_a) t where t !~ '^[0-9]+$' and t = any(v_prompt_words))
        or exists (select 1 from unnest(v_answer_words) t where t !~ '^[0-9]+$' and t = any(v_p))
        or exists (select 1 from public.questions q2 where q2.id = any(v_question_ids) and lower(q2.prompt) = lower(c.prompt))
      )) or (v_pass < 3 and (
           v_pairs && v_topic_pairs
        or (v_pass < 2 and v_t && v_topics)
        or (v_pass = 2 and exists (select 1 from unnest(v_t) w where (select count(*) from unnest(v_topics) x where x = w) >= 2))
      )) then
        continue;
      end if;
      v_question_ids := v_question_ids || c.id;
      v_answer_words := v_answer_words || v_a;
      v_prompt_words := v_prompt_words || v_p;
      v_topic_pairs := v_topic_pairs || v_pairs;
      v_topics := v_topics || v_t;
      if c.difficulty = 'hard' then v_hard := v_hard + 1; else v_easy := v_easy + 1; end if;
    end loop;
  end loop;

  select array_agg(x order by random()) into v_question_ids from unnest(v_question_ids) x;

  update public.questions set last_used_at = now() where id = any(v_question_ids);

  insert into public.room_questions (room_id, order_index, question_id)
  select p_room_id, ord - 1, qid from unnest(v_question_ids) with ordinality as t(qid, ord);

  update public.rooms set
    winning_category_id = v_winner,
    phase = 'question',
    current_question_index = 0,
    -- 5 seconds of "Get ready" (category shown) before question 1's clock starts.
    question_started_at = now() + interval '5 seconds',
    phase_started_at = now(),
    revealed_correct_index = null
  where id = p_room_id;
end;
$$;

-- 2. Look-alike questions ------------------------------------------------------

create or replace function public.trivia_topic_words(p text)
returns text[]
language sql
immutable
as $$
  select coalesce(array_agg(distinct t), '{}') from unnest(public.trivia_topic_tokens(p)) t
  where length(t) >= 3 and t !~ '[0-9]' and not public.trivia_generic_token(t)
    and not t = any(array[
      'largest','smallest','longest','tallest','biggest','highest','fastest','greatest','earth','time','year',
      'popular','hit','song','album','artist','singer','actor','actress','character','role','star','title',
      'sport','player','release','released','launch','launched','played','play','playing','start','end',
      'made','make','used','use','type','kind','part','home','number','score','point','called','word',
      'american','british','english','french','italian','japanese','spanish','german','worldwide','based',
      'series','serie','famou','known','name','about','after','become','became','include','includes','shape','shaped',
      'ingredient','dish','base','origin','originate','originated','originating','area','field','match','colorful','social','platform',
      'all','any','can','get','got','out','own','set','way','top','its','not','but','our','one','two','via','per','yes','off','far',
      'say','says','said','who','why','how','was','are','did','has','had','his','her','him','she','you','they','them','also'
    ]);
$$;

-- 3. Sudden death ------------------------------------------------------------

alter table public.rooms drop constraint if exists rooms_phase_check;
alter table public.rooms add constraint rooms_phase_check
  check (phase = any (array['lobby', 'question', 'reveal', 'leaderboard', 'sudden_death', 'final']));

alter table public.rooms
  add column if not exists sd_round int not null default 0,
  add column if not exists sd_question_id uuid references public.questions(id),
  add column if not exists sd_player_ids uuid[] not null default '{}',
  add column if not exists sd_team_ids uuid[] not null default '{}',
  add column if not exists sd_started_at timestamptz,
  add column if not exists sd_last_result jsonb,
  add column if not exists sd_winner_team_id uuid references public.teams(id) on delete set null,
  add column if not exists sd_used_question_ids uuid[] not null default '{}',
  add column if not exists sd_used_player_ids uuid[] not null default '{}';

-- One answer per chosen player per round. Nobody can read these directly;
-- results are published in rooms.sd_last_result once a round is decided.
create table if not exists public.sudden_death_answers (
  room_id uuid not null references public.rooms(id) on delete cascade,
  round int not null,
  player_id uuid not null references public.players(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  answer_text text,
  correct boolean not null default false,
  answered_at timestamptz not null default now(),
  primary key (room_id, round, player_id)
);
alter table public.sudden_death_answers enable row level security;

-- Seconds each sudden death question is open.
create or replace function public.trivia_sd_seconds() returns int language sql immutable as $$ select 20 $$;

-- Starts the next round: a fresh question (easy ones first, from the game's
-- category if any are left) and one teammate from each team still in,
-- rotating so the same person isn't up every round.
create or replace function public.trivia_sudden_death_next_round(p_room_id uuid, p_delay int)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_room public.rooms;
  v_qid uuid;
  v_players uuid[] := '{}';
  v_team uuid;
  v_pid uuid;
begin
  select * into v_room from public.rooms where id = p_room_id for update;

  select q.id into v_qid from public.questions q
    where q.active
      and not exists (select 1 from public.room_questions rq where rq.room_id = p_room_id and rq.question_id = q.id)
      and not q.id = any(v_room.sd_used_question_ids)
    order by (q.pack_id = v_room.winning_category_id) desc, (q.difficulty = 'easy') desc, random()
    limit 1;

  foreach v_team in array v_room.sd_team_ids loop
    select pl.id into v_pid from public.players pl
      where pl.team_id = v_team and pl.left_at is null
      order by (pl.id = any(v_room.sd_used_player_ids)), random()
      limit 1;
    if v_pid is not null then
      v_players := v_players || v_pid;
    end if;
  end loop;

  update public.rooms set
    sd_round = sd_round + 1,
    sd_question_id = v_qid,
    sd_player_ids = v_players,
    sd_started_at = now() + make_interval(secs => p_delay),
    sd_used_question_ids = sd_used_question_ids || v_qid,
    sd_used_player_ids = sd_used_player_ids || v_players
  where id = p_room_id;
end;
$$;

-- Called when the last question is scored. Returns true if teams are tied
-- for 1st and sudden death has started.
create or replace function public.trivia_start_sudden_death(p_room_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_top int;
  v_tied uuid[];
begin
  select max(t.score) into v_top from public.teams t
    where t.room_id = p_room_id
      and exists (select 1 from public.players pl where pl.team_id = t.id and pl.left_at is null);
  if v_top is null or v_top <= 0 then
    return false;
  end if;
  select array_agg(t.id order by t.created_at) into v_tied from public.teams t
    where t.room_id = p_room_id and t.score = v_top
      and exists (select 1 from public.players pl where pl.team_id = t.id and pl.left_at is null);
  if coalesce(array_length(v_tied, 1), 0) < 2 then
    return false;
  end if;

  update public.rooms set
    phase = 'sudden_death', phase_started_at = now(),
    sd_round = 0, sd_team_ids = v_tied, sd_player_ids = '{}', sd_last_result = null, sd_winner_team_id = null,
    sd_used_question_ids = '{}', sd_used_player_ids = '{}'
  where id = p_room_id;
  -- 6 seconds to announce the tie before the first sudden death question.
  perform public.trivia_sudden_death_next_round(p_room_id, 6);
  return true;
end;
$$;

-- A chosen player's one answer for the current round.
create or replace function public.submit_sudden_death_answer(p_room_id uuid, p_player_id uuid, p_client_token uuid, p_answer_text text)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_room public.rooms;
  v_player public.players;
begin
  select * into v_player from public.players
    where id = p_player_id and room_id = p_room_id and client_token = p_client_token and left_at is null;
  if not found then
    raise exception 'NOT_AUTHORIZED';
  end if;
  select * into v_room from public.rooms where id = p_room_id;
  if v_room.phase <> 'sudden_death' or not p_player_id = any(v_room.sd_player_ids) then
    raise exception 'NOT_YOUR_TURN';
  end if;
  if now() < v_room.sd_started_at or now() > v_room.sd_started_at + make_interval(secs => public.trivia_sd_seconds() + 1) then
    raise exception 'VOTING_CLOSED';
  end if;
  if length(trim(coalesce(p_answer_text, ''))) = 0 then
    raise exception 'EMPTY_ANSWER';
  end if;
  insert into public.sudden_death_answers (room_id, round, player_id, team_id, answer_text, correct)
    values (p_room_id, v_room.sd_round, p_player_id, v_player.team_id, left(trim(p_answer_text), 200),
            public.trivia_answer_matches(p_answer_text, v_room.sd_question_id))
    on conflict do nothing;
  return true;
end;
$$;
grant execute on function public.submit_sudden_death_answer(uuid, uuid, uuid, text) to anon, authenticated;

-- Game clock step while in sudden death: once every chosen player has
-- answered (or time is up), decide the round.
create or replace function public.trivia_sudden_death_step(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_room public.rooms;
  v_answered int;
  v_result jsonb;
  v_right uuid[];
  v_alive uuid[];
  v_winner uuid;
  v_correct text;
begin
  select * into v_room from public.rooms where id = p_room_id for update;
  if v_room.phase <> 'sudden_death' or now() < v_room.sd_started_at then
    return;
  end if;
  select count(*) into v_answered from public.sudden_death_answers a
    where a.room_id = p_room_id and a.round = v_room.sd_round and a.player_id = any(v_room.sd_player_ids);
  if v_answered < coalesce(array_length(v_room.sd_player_ids, 1), 0)
     and now() < v_room.sd_started_at + make_interval(secs => public.trivia_sd_seconds()) then
    return;
  end if;

  select q.choices->>q.correct_index into v_correct from public.questions q where q.id = v_room.sd_question_id;

  -- Everyone who was up this round, with their answer (none = wrong).
  select jsonb_build_object(
      'round', v_room.sd_round,
      'correct_answer', v_correct,
      'players', coalesce(jsonb_agg(jsonb_build_object(
        'team_id', t.id, 'team_name', t.name, 'player_id', pl.id, 'nickname', pl.nickname,
        'avatar_id', pl.avatar_id, 'answer', a.answer_text, 'correct', coalesce(a.correct, false))
        order by a.answered_at nulls last), '[]'::jsonb)),
    array_agg(t.id) filter (where coalesce(a.correct, false))
    into v_result, v_right
    from unnest(v_room.sd_player_ids) pid
    join public.players pl on pl.id = pid
    join public.teams t on t.id = pl.team_id
    left join public.sudden_death_answers a on a.room_id = p_room_id and a.round = v_room.sd_round and a.player_id = pid;

  -- First to get it wrong loses: if some got it right and some didn't, only
  -- the right ones stay in. All right or all wrong: another round.
  v_alive := v_room.sd_team_ids;
  if coalesce(array_length(v_right, 1), 0) > 0 and array_length(v_right, 1) < array_length(v_alive, 1) then
    v_alive := v_right;
  end if;

  if array_length(v_alive, 1) = 1 then
    v_winner := v_alive[1];
  elsif v_room.sd_round >= 5 then
    -- Still tied after 5 rounds: the fastest right answer in the last round, else a coin flip.
    select a.team_id into v_winner from public.sudden_death_answers a
      where a.room_id = p_room_id and a.round = v_room.sd_round and a.correct and a.team_id = any(v_alive)
      order by a.answered_at limit 1;
    if v_winner is null then
      v_winner := v_alive[1 + floor(random() * array_length(v_alive, 1))::int];
    end if;
  end if;

  if v_winner is not null then
    insert into public.team_answers (room_id, team_id, question_id, answer_text, correct, points_awarded, vote_count)
      values (p_room_id, v_winner, v_room.sd_question_id, 'Sudden death win', true, 100, 1)
      on conflict (team_id, question_id) do nothing;
    perform public.finalize_final_scores(p_room_id);
    update public.rooms set
      sd_last_result = v_result || jsonb_build_object('winner_team_id', v_winner),
      sd_team_ids = v_alive, sd_winner_team_id = v_winner,
      phase = 'final', phase_started_at = now()
    where id = p_room_id;
  else
    update public.rooms set sd_last_result = v_result, sd_team_ids = v_alive where id = p_room_id;
    -- 7 seconds to show who got it right before the next question.
    perform public.trivia_sudden_death_next_round(p_room_id, 7);
  end if;
end;
$$;

-- The "winner" feed event also fires when a game ends in sudden death.
create or replace function public.game_events_on_room()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_team public.teams;
begin
  if new.phase = 'question' and old.phase = 'lobby' then
    insert into public.game_events (venue_id, room_id, kind, text)
      values (new.venue_id, new.id, 'started',
        'Game on! ' || (select count(*) from public.teams t where t.room_id = new.id
          and exists (select 1 from public.players pl where pl.team_id = t.id and pl.left_at is null)) || ' teams are playing');
  elsif new.phase = 'sudden_death' and old.phase = 'question' then
    insert into public.game_events (venue_id, room_id, kind, text)
      values (new.venue_id, new.id, 'started', 'Tie for 1st! Sudden death between '
        || (select string_agg(t.name, ' and ' order by t.created_at) from public.teams t where t.id = any(new.sd_team_ids)));
  elsif new.phase = 'final' and old.phase in ('question', 'sudden_death') then
    select * into v_team from public.teams t where t.room_id = new.id order by t.score desc, t.created_at limit 1;
    if v_team.id is not null and v_team.score > 0 then
      insert into public.game_events (venue_id, room_id, kind, team_id, text)
        values (new.venue_id, new.id, 'winner', v_team.id, v_team.name || ' won with ' || to_char(v_team.score, 'FM999,999')
          || case when new.sd_winner_team_id is not null then ' in sudden death' else '' end);
    end if;
  end if;
  return new;
end;
$$;

-- Game clock: a tie for 1st after the last question goes to sudden death.
create or replace function public.tick()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
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
          if not public.trivia_start_sudden_death(v_room.id) then
            update public.rooms set phase = 'final', phase_started_at = now() where id = v_room.id;
          end if;
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

    elsif v_room.phase = 'sudden_death' then
      perform public.trivia_sudden_death_step(v_room.id);

    elsif v_room.phase = 'final' then
      if now() >= v_room.phase_started_at + make_interval(secs => v_final_dwell) then
        update public.rooms set retired = true where id = v_room.id;
      end if;
    end if;

  end loop;

  for v_venue in select ve.id from public.venues ve where ve.active and not ve.asleep loop
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

    if not exists (
      select 1 from public.rooms r
      where r.venue_id = v_venue.id and not r.retired and r.phase = 'lobby' and not public.trivia_room_full(r.id)
    ) and (select count(*) from public.rooms r where r.venue_id = v_venue.id and not r.retired and r.queued) < v_max_queued then
      select cr.room_id into v_next from public.create_room(null, v_venue.id) cr;
      update public.rooms set queued = true, queued_at = clock_timestamp() where id = v_next;
    end if;
  end loop;
end;
$$;

-- Test bots answer sudden death questions too (right about 60% of the time).
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
    where not r.retired and r.phase = 'sudden_death' and p.nickname like 'BOT %' and p.left_at is null
      and now() >= r.sd_started_at + make_interval(secs => 3 + abs(hashtext(p.id::text || r.sd_round::text)) % 8)
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

-- Bots also play sudden death.
create or replace function public.trivia_bot_autopilot()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare b record; r record; ans text; acc numeric; v_team uuid;
begin
  for r in select ro.id, ro.code from rooms ro join venues ve on ve.id = ro.venue_id and ve.active and ve.test_bots
           where not ro.retired and ro.phase='lobby'
             and not exists (select 1 from players p where p.room_id=ro.id and p.nickname like 'BOT %') loop
    perform join_room(r.code, 'BOT Ava', null, 'Quizzly Bears', 'jungle-scout', null);
    select id into v_team from teams where room_id=r.id and name='Quizzly Bears';
    perform join_room(r.code, 'BOT Ben', v_team, null, 'crystal-titan', null);
    perform join_room(r.code, 'BOT Cleo', v_team, null, 'jungle-scout', null);
    perform join_room(r.code, n, null, null, case when hashtext(n) % 2 = 0 then 'jungle-scout' else 'crystal-titan' end, null)
      from unnest(array['BOT Fay','BOT Gus','BOT Hana','BOT Ivan','BOT Jo','BOT Dev']) n;
  end loop;
  for b in select p.id, p.client_token, ro.id room_id, ro.category_options opts from players p join rooms ro on ro.id=p.room_id
           where not ro.retired and ro.phase='lobby' and p.nickname like 'BOT %' and p.left_at is null
             and not exists (select 1 from category_votes cv where cv.player_id=p.id)
             and exists (select 1 from players h where h.room_id=ro.id and h.nickname not like 'BOT %' and h.left_at is null)
             and not exists (select 1 from players h where h.room_id=ro.id and h.nickname not like 'BOT %' and h.left_at is null
                             and not exists (select 1 from category_votes cv where cv.player_id=h.id)) loop
    perform cast_vote(b.room_id, b.id, b.client_token, b.opts[1 + floor(random()*array_length(b.opts,1))::int]);
  end loop;
  for b in select p.id, p.client_token, p.nickname, ro.id room_id, q.id qid, q.choices, q.correct_index, q.difficulty
           from players p join rooms ro on ro.id=p.room_id
           join room_questions rq on rq.room_id=ro.id and rq.order_index=ro.current_question_index
           join questions q on q.id=rq.question_id
           where not ro.retired and ro.phase='question' and p.nickname like 'BOT %' and p.left_at is null
             and now() >= ro.question_started_at + make_interval(secs => 3 + abs(hashtext(p.id::text || q.id::text)) % 15)
             and not exists (select 1 from answers a where a.player_id=p.id and a.question_id=q.id) loop
    acc := 0.4 + (abs(hashtext(b.nickname)) % 50) / 100.0 - case when b.difficulty='hard' then 0.3 else 0 end;
    if random() < acc then
      ans := b.choices->>b.correct_index;
      if random() < 0.2 and length(ans) > 5 then ans := overlay(ans placing '' from 3 + floor(random()*(length(ans)-4))::int for 1); end if;
    else
      ans := b.choices->>((b.correct_index + 1 + floor(random()*3)::int) % 4);
    end if;
    begin perform cast_team_vote(b.room_id, b.id, b.client_token, b.qid, lower(ans)); exception when others then null; end;
  end loop;
  perform trivia_bot_sudden_death();
end $$;
