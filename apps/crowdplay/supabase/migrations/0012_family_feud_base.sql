-- Base schema + autonomous game loop for Family Feud, CrowdPlay's second
-- game. Mirrors trivia's proven architecture as closely as it makes sense
-- to: SECURITY DEFINER RPCs are the only mutation path, the raw answer key
-- lives in a locked-down table (RLS enabled, zero policies -- same trick as
-- `questions`), and a pg_cron ticker drives the whole game hands-off, the
-- same "roller coaster" philosophy as trivia's tick().
--
-- Gameplay is simplified from the real show for this first pass: two teams
-- (players pick or get auto-balanced onto Team Red / Team Blue), a survey
-- prompt with 5-6 hidden answers, and a single "first correct guess wins
-- control" face-off instead of a strict two-podium buzzer race. Once a team
-- has control, any of its players can keep guessing; 3 wrong guesses passes
-- one steal attempt to the other team; either way the round then reveals
-- and the pot is awarded. No "Fast Money" bonus round yet -- that's a
-- fundamentally different single-player-under-a-clock mechanic and is left
-- for a follow-up pass.

-- ---------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------

create table public.feud_questions (
  id uuid primary key default gen_random_uuid(),
  prompt text not null,
  answers jsonb not null, -- [{"text": "...", "points": 30}, ...] ordered highest points first
  last_used_at timestamptz
);

create table public.feud_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  phase text not null default 'lobby'
    check (phase in ('lobby','play','steal','reveal','leaderboard','final')),
  created_at timestamptz not null default now(),
  starts_at timestamptz,
  phase_started_at timestamptz not null default now(),
  last_action_at timestamptz not null default now(),
  current_round_index int not null default 0,
  total_rounds int not null default 6,
  current_question_id uuid references public.feud_questions(id),
  current_prompt text,
  board jsonb not null default '[]'::jsonb, -- [{"revealed": bool, "text": string|null, "points": int|null}, ...]
  controlling_team text check (controlling_team in ('a','b')),
  strikes smallint not null default 0,
  pot int not null default 0,
  team_a_name text not null default 'Team Red',
  team_b_name text not null default 'Team Blue',
  team_a_score int not null default 0,
  team_b_score int not null default 0,
  last_guess jsonb, -- {"nickname": "...", "team": "a", "guess": "...", "matched": bool}
  retired boolean not null default false
);

create table public.feud_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.feud_rooms(id) on delete cascade,
  team text not null check (team in ('a','b')),
  nickname text not null,
  client_token uuid not null default gen_random_uuid(),
  joined_at timestamptz not null default now(),
  unique (room_id, nickname)
);

alter table public.feud_questions enable row level security; -- locked: no policies, same as `questions`
alter table public.feud_rooms enable row level security;
alter table public.feud_players enable row level security;

create policy "feud_rooms readable" on public.feud_rooms for select using (true);
create policy "feud_players readable" on public.feud_players for select using (true);

alter publication supabase_realtime add table public.feud_rooms;
alter publication supabase_realtime add table public.feud_players;

-- ---------------------------------------------------------------------
-- Matching helper
-- ---------------------------------------------------------------------

create extension if not exists fuzzystrmatch;

create or replace function public.normalize_feud_text(p_text text)
returns text
language sql
immutable
as $$
  select trim(regexp_replace(lower(coalesce(p_text, '')), '[^a-z0-9 ]', '', 'g'));
$$;

-- ---------------------------------------------------------------------
-- Room lifecycle
-- ---------------------------------------------------------------------

create or replace function public.create_feud_room(p_starts_at timestamptz default null)
returns table(room_id uuid, code text)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_code text;
  v_room public.feud_rooms;
begin
  loop
    v_code := upper(substr(md5(random()::text), 1, 5));
    begin
      insert into public.feud_rooms (code, starts_at)
        values (v_code, p_starts_at)
        returning * into v_room;
      exit;
    exception when unique_violation then
    end;
  end loop;

  return query select v_room.id, v_room.code;
end;
$function$;

create or replace function public.start_feud_round(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_room public.feud_rooms;
  v_question public.feud_questions;
  v_board jsonb;
  v_slot_count int;
  i int;
begin
  select * into v_room from public.feud_rooms where id = p_room_id for update;
  if not found then
    return;
  end if;

  select * into v_question from public.feud_questions
    order by last_used_at nulls first, random()
    limit 1;
  if not found then
    return;
  end if;

  update public.feud_questions set last_used_at = now() where id = v_question.id;

  v_slot_count := jsonb_array_length(v_question.answers);
  v_board := '[]'::jsonb;
  for i in 0 .. v_slot_count - 1 loop
    v_board := v_board || jsonb_build_object('revealed', false, 'text', null, 'points', null);
  end loop;

  update public.feud_rooms set
    current_question_id = v_question.id,
    current_prompt = v_question.prompt,
    board = v_board,
    controlling_team = null,
    strikes = 0,
    pot = 0,
    last_guess = null,
    current_round_index = v_room.current_round_index + 1,
    phase = 'play',
    phase_started_at = now(),
    last_action_at = now()
  where id = p_room_id;
end;
$function$;

-- ---------------------------------------------------------------------
-- Player-facing RPCs
-- ---------------------------------------------------------------------

create or replace function public.join_feud_room(p_code text, p_nickname text, p_team text default null)
returns table(player_id uuid, client_token uuid, room_id uuid, team text)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_room public.feud_rooms;
  v_player public.feud_players;
  v_team text;
  v_team_a_count int;
  v_team_b_count int;
begin
  select * into v_room from public.feud_rooms where code = upper(p_code) for update;
  if not found then
    raise exception 'ROOM_NOT_FOUND';
  end if;
  if v_room.phase <> 'lobby' then
    raise exception 'ROOM_ALREADY_STARTED';
  end if;
  if length(trim(p_nickname)) < 1 or length(p_nickname) > 30 then
    raise exception 'INVALID_NICKNAME';
  end if;

  select count(*) filter (where pl.team = 'a'), count(*) filter (where pl.team = 'b')
    into v_team_a_count, v_team_b_count
    from public.feud_players pl where pl.room_id = v_room.id;

  if v_team_a_count >= 25 and v_team_b_count >= 25 then
    raise exception 'ROOM_FULL';
  end if;

  if p_team in ('a', 'b') and (case when p_team = 'a' then v_team_a_count else v_team_b_count end) < 25 then
    v_team := p_team;
  else
    -- No preference given, or their preferred team is full -- auto-balance.
    v_team := case
      when v_team_a_count >= 25 then 'b'
      when v_team_b_count >= 25 then 'a'
      when v_team_a_count <= v_team_b_count then 'a'
      else 'b'
    end;
  end if;

  insert into public.feud_players (room_id, team, nickname)
    values (v_room.id, v_team, trim(p_nickname))
    returning * into v_player;

  return query select v_player.id, v_player.client_token, v_player.room_id, v_player.team;
exception when unique_violation then
  raise exception 'NICKNAME_TAKEN';
end;
$function$;

create or replace function public.submit_feud_guess(
  p_room_id uuid,
  p_player_id uuid,
  p_client_token uuid,
  p_guess text
)
returns table(o_matched boolean, o_points_awarded int, o_strikes smallint, o_phase text, o_board jsonb)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_room public.feud_rooms;
  v_player public.feud_players;
  v_question public.feud_questions;
  v_answers jsonb;
  v_board jsonb;
  v_full_board jsonb;
  v_norm_guess text;
  v_norm_answer text;
  v_slot_points int;
  v_typo_budget int;
  i int;
  v_match_index int := null;
  v_awarded int := 0;
  v_matched boolean := false;
begin
  select * into v_room from public.feud_rooms where id = p_room_id for update;
  if not found then
    raise exception 'ROOM_NOT_FOUND';
  end if;
  if v_room.phase not in ('play', 'steal') then
    raise exception 'NOT_ACCEPTING_GUESSES';
  end if;

  select * into v_player from public.feud_players
    where id = p_player_id and room_id = p_room_id and client_token = p_client_token;
  if not found then
    raise exception 'NOT_AUTHORIZED';
  end if;

  if v_room.phase = 'play' and v_room.controlling_team is not null and v_player.team <> v_room.controlling_team then
    raise exception 'NOT_YOUR_TURN';
  end if;
  if v_room.phase = 'steal' and v_player.team = v_room.controlling_team then
    raise exception 'NOT_YOUR_TURN';
  end if;

  select * into v_question from public.feud_questions where id = v_room.current_question_id;
  v_answers := v_question.answers;
  v_board := v_room.board;
  v_norm_guess := public.normalize_feud_text(p_guess);

  select jsonb_agg(jsonb_build_object('revealed', true, 'text', elem->>'text', 'points', (elem->>'points')::int))
    into v_full_board
    from jsonb_array_elements(v_answers) as elem;

  -- Case-insensitive already (normalize lowercases everything); this adds
  -- tolerance for a letter or two being off, scaled to the answer's length.
  -- Requiring the same first letter blocks genuinely-different short words
  -- that happen to be one edit away (e.g. "curse" vs "Nurse", "bake" vs
  -- "cake") from being mistaken for a typo -- real typos essentially never
  -- change the first letter, so this costs almost nothing for legitimate
  -- misspellings while closing that false-positive class.
  if length(v_norm_guess) >= 2 then
    for i in 0 .. jsonb_array_length(v_answers) - 1 loop
      if (v_board->i->>'revealed')::boolean is not true then
        v_norm_answer := public.normalize_feud_text(v_answers->i->>'text');
        v_typo_budget := case
          when length(v_norm_answer) <= 4 then 1
          when length(v_norm_answer) <= 9 then 2
          else 3
        end;
        if v_norm_guess = v_norm_answer
           or (length(v_norm_guess) >= 3 and v_norm_answer like '%' || v_norm_guess || '%')
           or (length(v_norm_answer) >= 3 and v_norm_guess like '%' || v_norm_answer || '%')
           or (
             left(v_norm_guess, 1) = left(v_norm_answer, 1)
             and levenshtein(v_norm_guess, v_norm_answer) <= v_typo_budget
           )
        then
          v_match_index := i;
          exit;
        end if;
      end if;
    end loop;
  end if;

  if v_match_index is not null then
    v_matched := true;
    v_slot_points := (v_answers->v_match_index->>'points')::int;
    v_awarded := v_slot_points;
    v_board := jsonb_set(v_board, array[v_match_index::text],
      jsonb_build_object('revealed', true, 'text', v_answers->v_match_index->>'text', 'points', v_slot_points));
  end if;

  update public.feud_rooms set last_guess = jsonb_build_object(
    'nickname', v_player.nickname, 'team', v_player.team, 'guess', p_guess, 'matched', v_matched
  ) where id = p_room_id;

  if v_room.phase = 'steal' then
    -- One shot: whatever happens, the round resolves right now. Reveal the
    -- whole board -- the round is over, so there's nothing left to protect.
    if v_matched then
      if v_player.team = 'a' then
        update public.feud_rooms set team_a_score = team_a_score + v_room.pot + v_awarded, board = v_full_board,
          phase = 'reveal', phase_started_at = now(), last_action_at = now() where id = p_room_id;
      else
        update public.feud_rooms set team_b_score = team_b_score + v_room.pot + v_awarded, board = v_full_board,
          phase = 'reveal', phase_started_at = now(), last_action_at = now() where id = p_room_id;
      end if;
    else
      if v_room.controlling_team = 'a' then
        update public.feud_rooms set team_a_score = team_a_score + v_room.pot, board = v_full_board,
          phase = 'reveal', phase_started_at = now(), last_action_at = now() where id = p_room_id;
      else
        update public.feud_rooms set team_b_score = team_b_score + v_room.pot, board = v_full_board,
          phase = 'reveal', phase_started_at = now(), last_action_at = now() where id = p_room_id;
      end if;
    end if;
    return query select v_matched, v_awarded, v_room.strikes, 'reveal'::text, v_full_board;
    return;
  end if;

  -- phase = 'play'
  if v_matched then
    if v_room.controlling_team is null then
      update public.feud_rooms set controlling_team = v_player.team, pot = pot + v_awarded, board = v_board,
        last_action_at = now() where id = p_room_id;
    else
      update public.feud_rooms set pot = pot + v_awarded, board = v_board, last_action_at = now()
        where id = p_room_id;
    end if;

    if not exists (
      select 1 from jsonb_array_elements(v_board) as slot where (slot->>'revealed')::boolean is not true
    ) then
      -- Board fully cleared -- round over, pot goes to whichever team just took control/continued.
      declare
        v_final_team text := coalesce(v_room.controlling_team, v_player.team);
      begin
        if v_final_team = 'a' then
          update public.feud_rooms set team_a_score = team_a_score + pot, phase = 'reveal', phase_started_at = now()
            where id = p_room_id;
        else
          update public.feud_rooms set team_b_score = team_b_score + pot, phase = 'reveal', phase_started_at = now()
            where id = p_room_id;
        end if;
      end;
      return query select true, v_awarded, v_room.strikes, 'reveal'::text, v_board;
      return;
    end if;

    return query select true, v_awarded, v_room.strikes, 'play'::text, v_board;
    return;
  else
    if v_room.controlling_team is null then
      -- Face-off miss: no controller yet, nobody's charged a strike.
      return query select false, 0, v_room.strikes, 'play'::text, v_board;
      return;
    end if;

    if v_room.strikes + 1 >= 3 then
      update public.feud_rooms set strikes = 3, phase = 'steal', phase_started_at = now(), last_action_at = now()
        where id = p_room_id;
      return query select false, 0, 3::smallint, 'steal'::text, v_board;
      return;
    else
      update public.feud_rooms set strikes = strikes + 1, last_action_at = now() where id = p_room_id;
      return query select false, 0, (v_room.strikes + 1)::smallint, 'play'::text, v_board;
      return;
    end if;
  end if;
end;
$function$;

-- ---------------------------------------------------------------------
-- Autonomous ticker
-- ---------------------------------------------------------------------

create or replace function public.tick_feud()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_reveal_dwell constant int := 6;
  v_leaderboard_dwell constant int := 6;
  v_final_dwell constant int := 20;
  v_lobby_boarding_seconds constant int := 20;
  v_idle_timeout_seconds constant int := 45;
  v_room record;
  v_answers jsonb;
  v_full_board jsonb;
begin
  for v_room in select * from public.feud_rooms where phase <> 'final' or not retired loop

    if v_room.phase = 'lobby' and v_room.starts_at is not null and v_room.starts_at <= now() then
      perform public.start_feud_round(v_room.id);

    elsif v_room.phase in ('play', 'steal') then
      if now() >= v_room.last_action_at + make_interval(secs => v_idle_timeout_seconds) then
        select answers into v_answers from public.feud_questions where id = v_room.current_question_id;
        select jsonb_agg(jsonb_build_object('revealed', true, 'text', elem->>'text', 'points', (elem->>'points')::int))
          into v_full_board
          from jsonb_array_elements(v_answers) as elem;

        if v_room.controlling_team = 'a' then
          update public.feud_rooms set team_a_score = team_a_score + pot, board = v_full_board,
            phase = 'reveal', phase_started_at = now() where id = v_room.id;
        elsif v_room.controlling_team = 'b' then
          update public.feud_rooms set team_b_score = team_b_score + pot, board = v_full_board,
            phase = 'reveal', phase_started_at = now() where id = v_room.id;
        else
          update public.feud_rooms set board = v_full_board, phase = 'reveal', phase_started_at = now()
            where id = v_room.id;
        end if;
      end if;

    elsif v_room.phase = 'reveal' then
      if now() >= v_room.phase_started_at + make_interval(secs => v_reveal_dwell) then
        update public.feud_rooms set phase = 'leaderboard', phase_started_at = now() where id = v_room.id;
      end if;

    elsif v_room.phase = 'leaderboard' then
      if now() >= v_room.phase_started_at + make_interval(secs => v_leaderboard_dwell) then
        if v_room.current_round_index >= v_room.total_rounds then
          update public.feud_rooms set phase = 'final', phase_started_at = now() where id = v_room.id;
        else
          perform public.start_feud_round(v_room.id);
        end if;
      end if;

    elsif v_room.phase = 'final' and not v_room.retired then
      if now() >= v_room.phase_started_at + make_interval(secs => v_final_dwell) then
        update public.feud_rooms set retired = true where id = v_room.id;
      end if;
    end if;

  end loop;

  if not exists (select 1 from public.feud_rooms where not retired) then
    perform public.create_feud_room(now() + make_interval(secs => v_lobby_boarding_seconds));
  end if;
end;
$function$;

revoke execute on function public.tick_feud() from anon, authenticated, public;
revoke execute on function public.start_feud_round(uuid) from anon, authenticated, public;
revoke execute on function public.create_feud_room(timestamptz) from anon, authenticated, public;

select cron.schedule('family_feud_autonomous_tick', '5 seconds', 'select public.tick_feud();');

-- ---------------------------------------------------------------------
-- Seed content -- original "survey says" style prompts, not copied from
-- any show's actual archive.
-- ---------------------------------------------------------------------

insert into public.feud_questions (prompt, answers) values
('Name something you might forget when packing for a trip.',
  '[{"text":"Toothbrush","points":28},{"text":"Phone charger","points":24},{"text":"Socks","points":18},{"text":"Passport","points":16},{"text":"Sunscreen","points":9},{"text":"Medication","points":5}]'),
('Name a reason someone might be late to work.',
  '[{"text":"Traffic","points":32},{"text":"Overslept","points":26},{"text":"Car trouble","points":18},{"text":"Forgot something at home","points":14},{"text":"Bad weather","points":6},{"text":"Lost keys","points":4}]'),
('Name something you''d find in a gym bag.',
  '[{"text":"Sneakers","points":27},{"text":"Towel","points":22},{"text":"Water bottle","points":20},{"text":"Change of clothes","points":17},{"text":"Deodorant","points":9},{"text":"Headphones","points":5}]'),
('Name a food people often eat with their hands.',
  '[{"text":"Pizza","points":30},{"text":"Burger","points":24},{"text":"Fries","points":18},{"text":"Chicken wings","points":15},{"text":"Tacos","points":8},{"text":"Sandwich","points":5}]'),
('Name something people do to relax after a long day.',
  '[{"text":"Watch TV","points":29},{"text":"Take a nap","points":22},{"text":"Take a bath","points":17},{"text":"Read a book","points":15},{"text":"Exercise","points":10},{"text":"Listen to music","points":7}]'),
('Name a job where you have to wear a uniform.',
  '[{"text":"Police officer","points":26},{"text":"Nurse","points":23},{"text":"Firefighter","points":19},{"text":"Chef","points":16},{"text":"Soldier","points":10},{"text":"Pilot","points":6}]'),
('Name something you might do at a birthday party.',
  '[{"text":"Sing Happy Birthday","points":28},{"text":"Blow out candles","points":24},{"text":"Open presents","points":20},{"text":"Eat cake","points":16},{"text":"Play games","points":8},{"text":"Take photos","points":4}]'),
('Name a place where you have to be quiet.',
  '[{"text":"Library","points":34},{"text":"Movie theater","points":25},{"text":"Church","points":18},{"text":"Hospital","points":12},{"text":"Funeral","points":7},{"text":"Classroom","points":4}]'),
('Name something you might see at a wedding.',
  '[{"text":"The bride","points":24},{"text":"A cake","points":20},{"text":"Flowers","points":18},{"text":"Guests dancing","points":16},{"text":"A ring","points":14},{"text":"A DJ","points":8}]'),
('Name something people do to stay cool in the summer.',
  '[{"text":"Swim","points":30},{"text":"Use air conditioning","points":26},{"text":"Drink cold drinks","points":17},{"text":"Use a fan","points":14},{"text":"Wear light clothes","points":8},{"text":"Eat ice cream","points":5}]'),
('Name a household chore people put off doing.',
  '[{"text":"Laundry","points":26},{"text":"Cleaning the bathroom","points":22},{"text":"Dishes","points":19},{"text":"Vacuuming","points":16},{"text":"Mowing the lawn","points":11},{"text":"Dusting","points":6}]'),
('Name something you might bring to a picnic.',
  '[{"text":"Sandwiches","points":26},{"text":"A blanket","points":22},{"text":"Drinks","points":19},{"text":"Chips","points":16},{"text":"Fruit","points":11},{"text":"A cooler","points":6}]'),
('Name a reason someone would call in sick to work.',
  '[{"text":"They''re actually sick","points":34},{"text":"A hangover","points":20},{"text":"Mental health day","points":18},{"text":"Family emergency","points":16},{"text":"They''re too tired","points":8},{"text":"Car trouble","points":4}]'),
('Name something you do right before going to bed.',
  '[{"text":"Brush your teeth","points":30},{"text":"Set an alarm","points":24},{"text":"Check your phone","points":18},{"text":"Turn off the lights","points":15},{"text":"Read","points":8},{"text":"Lock the doors","points":5}]'),
('Name a popular topping for ice cream.',
  '[{"text":"Sprinkles","points":26},{"text":"Chocolate syrup","points":23},{"text":"Whipped cream","points":19},{"text":"Nuts","points":16},{"text":"Cherries","points":10},{"text":"Caramel","points":6}]'),
('Name something you''d take to the beach.',
  '[{"text":"Sunscreen","points":27},{"text":"Towel","points":23},{"text":"Swimsuit","points":19},{"text":"Sunglasses","points":15},{"text":"Umbrella","points":10},{"text":"Cooler","points":6}]');
