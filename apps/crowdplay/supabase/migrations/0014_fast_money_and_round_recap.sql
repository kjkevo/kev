-- Adds the Fast Money bonus round and round-winner recap data.
--
-- Fast Money: once regular rounds end, if there's a clear (non-tied) leader,
-- that team's two earliest-joined players (or one player playing both turns
-- if the team only has one) each get 60 seconds to answer the same 5 survey
-- questions -- one at a time, free-text, same matching rules as the main
-- game. Player 2 scores 0 on any question where they gave the exact same
-- answer as player 1 (the real show's "don't just copy" rule). The combined
-- total is added to that team's score. Interim guesses are kept in a
-- locked-down table (same trick as `feud_questions`) so player 2 can never
-- see player 1's answers before finishing their own turn -- if they were
-- visible via the normal realtime-readable feud_rooms row, anyone with
-- devtools open could peek ahead.
--
-- Round recap: every point where a round concludes (normal full-clear,
-- steal success/fail, idle timeout, or Fast Money) now records who won and
-- for how much, so the reveal screen can show "Team X won this round!"
-- instead of just the raw board.

alter table public.feud_rooms drop constraint feud_rooms_phase_check;
alter table public.feud_rooms add constraint feud_rooms_phase_check
  check (phase in ('lobby','play','steal','fast_money','reveal','leaderboard','final'));

alter table public.feud_rooms
  add column last_round_winner text check (last_round_winner in ('a','b')),
  add column last_round_points int,
  add column last_round_was_fast_money boolean not null default false,
  add column fast_money_played boolean not null default false,
  add column fast_money_team text check (fast_money_team in ('a','b')),
  add column fast_money_player1_id uuid references public.feud_players(id),
  add column fast_money_player2_id uuid references public.feud_players(id),
  add column fast_money_questions jsonb,
  add column fast_money_turn smallint,
  add column fast_money_current_index smallint,
  add column fast_money_current_prompt text,
  add column fast_money_turn_started_at timestamptz,
  add column fast_money_prompts jsonb,
  add column fast_money_answers jsonb not null default '[]'::jsonb,
  add column fast_money_total int;

create table public.feud_fast_money_guesses (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.feud_rooms(id) on delete cascade,
  slot smallint not null,
  player_id uuid not null references public.feud_players(id),
  guess text not null,
  matched boolean not null,
  points int not null,
  created_at timestamptz not null default now(),
  unique (room_id, slot)
);

alter table public.feud_fast_money_guesses enable row level security; -- locked: no policies, same as `feud_questions`

-- ---------------------------------------------------------------------
-- Fast Money lifecycle (postgres/service_role only -- driven by the
-- ticker and by submit_fast_money_guess, never called directly by anon)
-- ---------------------------------------------------------------------

create or replace function public.start_fast_money(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_room public.feud_rooms;
  v_winner text;
  v_p1 uuid;
  v_p2 uuid;
  v_question_ids jsonb;
  v_first_prompt text;
begin
  select * into v_room from public.feud_rooms where id = p_room_id for update;
  if not found then
    return;
  end if;

  if v_room.team_a_score = v_room.team_b_score then
    -- Tied: no clear team to send up, skip straight to final.
    update public.feud_rooms set fast_money_played = true, phase = 'final', phase_started_at = now()
      where id = p_room_id;
    return;
  end if;

  v_winner := case when v_room.team_a_score > v_room.team_b_score then 'a' else 'b' end;

  select pl.id into v_p1 from public.feud_players pl
    where pl.room_id = p_room_id and pl.team = v_winner order by pl.joined_at asc limit 1;
  select pl.id into v_p2 from public.feud_players pl
    where pl.room_id = p_room_id and pl.team = v_winner order by pl.joined_at asc offset 1 limit 1;
  if v_p2 is null then
    v_p2 := v_p1; -- Solo team: same player plays both turns.
  end if;

  select jsonb_agg(id) into v_question_ids from (
    select id from public.feud_questions order by last_used_at nulls first, random() limit 5
  ) picked;

  update public.feud_questions set last_used_at = now()
    where id in (select jsonb_array_elements_text(v_question_ids)::uuid);

  select q.prompt into v_first_prompt from public.feud_questions q where q.id = (v_question_ids->>0)::uuid;

  update public.feud_rooms set
    phase = 'fast_money',
    phase_started_at = now(),
    fast_money_team = v_winner,
    fast_money_player1_id = v_p1,
    fast_money_player2_id = v_p2,
    fast_money_questions = v_question_ids,
    fast_money_turn = 1,
    fast_money_current_index = 0,
    fast_money_current_prompt = v_first_prompt,
    fast_money_turn_started_at = now(),
    fast_money_prompts = null,
    fast_money_answers = '[]'::jsonb,
    fast_money_total = null
  where id = p_room_id;
end;
$function$;

create or replace function public.finish_fast_money_and_reveal(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_room public.feud_rooms;
  v_prompts jsonb;
  v_answers jsonb;
  v_total int;
begin
  select * into v_room from public.feud_rooms where id = p_room_id for update;
  if not found then
    return;
  end if;

  select jsonb_agg(q.prompt order by t.ord)
    into v_prompts
    from jsonb_array_elements_text(v_room.fast_money_questions) with ordinality as t(qid, ord)
    join public.feud_questions q on q.id = t.qid::uuid;

  select jsonb_agg(jsonb_build_object(
      'player', case when g.slot < 5 then 1 else 2 end,
      'prompt', v_prompts->(g.slot % 5),
      'guess', g.guess,
      'matched', g.matched,
      'points', g.points
    ) order by g.slot)
    into v_answers
    from public.feud_fast_money_guesses g
    where g.room_id = p_room_id;

  select coalesce(sum(points), 0) into v_total from public.feud_fast_money_guesses where room_id = p_room_id;

  if v_room.fast_money_team = 'a' then
    update public.feud_rooms set team_a_score = team_a_score + v_total where id = p_room_id;
  else
    update public.feud_rooms set team_b_score = team_b_score + v_total where id = p_room_id;
  end if;

  update public.feud_rooms set
    fast_money_prompts = v_prompts,
    fast_money_answers = coalesce(v_answers, '[]'::jsonb),
    fast_money_total = v_total,
    fast_money_played = true,
    last_round_winner = v_room.fast_money_team,
    last_round_points = v_total,
    last_round_was_fast_money = true,
    phase = 'reveal',
    phase_started_at = now()
  where id = p_room_id;

  delete from public.feud_fast_money_guesses where room_id = p_room_id;
end;
$function$;

create or replace function public.submit_fast_money_guess(
  p_room_id uuid,
  p_player_id uuid,
  p_client_token uuid,
  p_guess text
)
returns table(o_matched boolean, o_points int, o_phase text)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_room public.feud_rooms;
  v_player public.feud_players;
  v_current_qid uuid;
  v_answers jsonb;
  v_norm_guess text;
  v_norm_answer text;
  v_typo_budget int;
  v_match_index int := null;
  v_points int := 0;
  v_matched boolean := false;
  v_slot int;
  v_dup_guess text;
  i int;
begin
  select * into v_room from public.feud_rooms where id = p_room_id for update;
  if not found then
    raise exception 'ROOM_NOT_FOUND';
  end if;
  if v_room.phase <> 'fast_money' then
    raise exception 'NOT_ACCEPTING_GUESSES';
  end if;

  select * into v_player from public.feud_players
    where id = p_player_id and room_id = p_room_id and client_token = p_client_token;
  if not found then
    raise exception 'NOT_AUTHORIZED';
  end if;

  if v_room.fast_money_turn = 1 and v_player.id <> v_room.fast_money_player1_id then
    raise exception 'NOT_YOUR_TURN';
  end if;
  if v_room.fast_money_turn = 2 and v_player.id <> v_room.fast_money_player2_id then
    raise exception 'NOT_YOUR_TURN';
  end if;

  v_current_qid := (v_room.fast_money_questions->>v_room.fast_money_current_index)::uuid;
  select answers into v_answers from public.feud_questions where id = v_current_qid;
  v_norm_guess := public.normalize_feud_text(p_guess);

  if length(v_norm_guess) >= 2 then
    for i in 0 .. jsonb_array_length(v_answers) - 1 loop
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
    end loop;
  end if;

  if v_match_index is not null then
    v_matched := true;
    v_points := (v_answers->v_match_index->>'points')::int;
  end if;

  v_slot := case when v_room.fast_money_turn = 1 then v_room.fast_money_current_index else 5 + v_room.fast_money_current_index end;

  -- Duplicate-answer rule: player 2 scores 0 on a question if they gave the
  -- exact same answer player 1 already gave, regardless of correctness.
  if v_room.fast_money_turn = 2 then
    select guess into v_dup_guess from public.feud_fast_money_guesses
      where room_id = p_room_id and slot = v_room.fast_money_current_index;
    if v_dup_guess is not null and length(v_norm_guess) > 0
       and public.normalize_feud_text(v_dup_guess) = v_norm_guess then
      v_points := 0;
    end if;
  end if;

  insert into public.feud_fast_money_guesses (room_id, slot, player_id, guess, matched, points)
    values (p_room_id, v_slot, p_player_id, p_guess, v_matched, v_points)
    on conflict (room_id, slot) do update set guess = excluded.guess, matched = excluded.matched, points = excluded.points;

  if v_room.fast_money_current_index + 1 >= 5 then
    if v_room.fast_money_turn = 1 then
      update public.feud_rooms set
        fast_money_turn = 2,
        fast_money_current_index = 0,
        fast_money_current_prompt = (select prompt from public.feud_questions where id = (v_room.fast_money_questions->>0)::uuid),
        fast_money_turn_started_at = now()
      where id = p_room_id;
      return query select v_matched, v_points, 'fast_money'::text;
      return;
    else
      perform public.finish_fast_money_and_reveal(p_room_id);
      return query select v_matched, v_points, 'reveal'::text;
      return;
    end if;
  else
    update public.feud_rooms set
      fast_money_current_index = fast_money_current_index + 1,
      fast_money_current_prompt = (select prompt from public.feud_questions where id = (v_room.fast_money_questions->>(v_room.fast_money_current_index + 1))::uuid)
    where id = p_room_id;
    return query select v_matched, v_points, 'fast_money'::text;
    return;
  end if;
end;
$function$;

-- ---------------------------------------------------------------------
-- Round-recap bookkeeping in the main game's scoring paths
-- ---------------------------------------------------------------------

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
    if v_matched then
      if v_player.team = 'a' then
        update public.feud_rooms set team_a_score = team_a_score + v_room.pot + v_awarded, board = v_full_board,
          phase = 'reveal', phase_started_at = now(), last_action_at = now(),
          last_round_winner = 'a', last_round_points = v_room.pot + v_awarded, last_round_was_fast_money = false
          where id = p_room_id;
      else
        update public.feud_rooms set team_b_score = team_b_score + v_room.pot + v_awarded, board = v_full_board,
          phase = 'reveal', phase_started_at = now(), last_action_at = now(),
          last_round_winner = 'b', last_round_points = v_room.pot + v_awarded, last_round_was_fast_money = false
          where id = p_room_id;
      end if;
    else
      if v_room.controlling_team = 'a' then
        update public.feud_rooms set team_a_score = team_a_score + v_room.pot, board = v_full_board,
          phase = 'reveal', phase_started_at = now(), last_action_at = now(),
          last_round_winner = 'a', last_round_points = v_room.pot, last_round_was_fast_money = false
          where id = p_room_id;
      else
        update public.feud_rooms set team_b_score = team_b_score + v_room.pot, board = v_full_board,
          phase = 'reveal', phase_started_at = now(), last_action_at = now(),
          last_round_winner = 'b', last_round_points = v_room.pot, last_round_was_fast_money = false
          where id = p_room_id;
      end if;
    end if;
    return query select v_matched, v_awarded, v_room.strikes, 'reveal'::text, v_full_board;
    return;
  end if;

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
      declare
        v_final_team text := coalesce(v_room.controlling_team, v_player.team);
      begin
        if v_final_team = 'a' then
          update public.feud_rooms set team_a_score = team_a_score + pot, phase = 'reveal', phase_started_at = now(),
            last_round_winner = 'a', last_round_points = pot, last_round_was_fast_money = false
            where id = p_room_id;
        else
          update public.feud_rooms set team_b_score = team_b_score + pot, phase = 'reveal', phase_started_at = now(),
            last_round_winner = 'b', last_round_points = pot, last_round_was_fast_money = false
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
-- Ticker: drive Fast Money's timeout/turn-advance and gate the
-- leaderboard-to-final transition through it exactly once per game
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
  v_fast_money_turn_seconds constant int := 60;
  v_room record;
  v_answers jsonb;
  v_full_board jsonb;
  j int;
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
            phase = 'reveal', phase_started_at = now(),
            last_round_winner = 'a', last_round_points = v_room.pot, last_round_was_fast_money = false
            where id = v_room.id;
        elsif v_room.controlling_team = 'b' then
          update public.feud_rooms set team_b_score = team_b_score + pot, board = v_full_board,
            phase = 'reveal', phase_started_at = now(),
            last_round_winner = 'b', last_round_points = v_room.pot, last_round_was_fast_money = false
            where id = v_room.id;
        else
          update public.feud_rooms set board = v_full_board, phase = 'reveal', phase_started_at = now(),
            last_round_winner = null, last_round_points = 0, last_round_was_fast_money = false
            where id = v_room.id;
        end if;
      end if;

    elsif v_room.phase = 'fast_money' then
      if now() >= v_room.fast_money_turn_started_at + make_interval(secs => v_fast_money_turn_seconds) then
        for j in v_room.fast_money_current_index .. 4 loop
          insert into public.feud_fast_money_guesses (room_id, slot, player_id, guess, matched, points)
            values (v_room.id,
                    case when v_room.fast_money_turn = 1 then j else 5 + j end,
                    case when v_room.fast_money_turn = 1 then v_room.fast_money_player1_id else v_room.fast_money_player2_id end,
                    '(no answer)', false, 0)
            on conflict (room_id, slot) do nothing;
        end loop;

        if v_room.fast_money_turn = 1 then
          update public.feud_rooms set
            fast_money_turn = 2,
            fast_money_current_index = 0,
            fast_money_current_prompt = (select prompt from public.feud_questions where id = (v_room.fast_money_questions->>0)::uuid),
            fast_money_turn_started_at = now()
          where id = v_room.id;
        else
          perform public.finish_fast_money_and_reveal(v_room.id);
        end if;
      end if;

    elsif v_room.phase = 'reveal' then
      if now() >= v_room.phase_started_at + make_interval(secs => v_reveal_dwell) then
        update public.feud_rooms set phase = 'leaderboard', phase_started_at = now() where id = v_room.id;
      end if;

    elsif v_room.phase = 'leaderboard' then
      if now() >= v_room.phase_started_at + make_interval(secs => v_leaderboard_dwell) then
        if v_room.current_round_index >= v_room.total_rounds then
          if v_room.fast_money_played then
            update public.feud_rooms set phase = 'final', phase_started_at = now() where id = v_room.id;
          else
            perform public.start_fast_money(v_room.id);
          end if;
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
revoke execute on function public.start_fast_money(uuid) from anon, authenticated, public;
revoke execute on function public.finish_fast_money_and_reveal(uuid) from anon, authenticated, public;
