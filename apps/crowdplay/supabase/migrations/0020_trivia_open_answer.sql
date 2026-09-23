-- Three changes to trivia, all requested together:
--
-- 1. Open-answer questions instead of multiple choice. No content rewrite
--    needed -- the correct choice's text (choices[correct_index]) becomes
--    the correct answer, matched against a typed guess the same
--    typo-tolerant way Family Feud already matches guesses (reusing
--    normalize_feud_text + a levenshtein budget). A team's answer is
--    whichever normalized text got the most teammate votes.
-- 2. Question timer 15s -> 30s (typing takes longer than tapping a button,
--    and 15s already felt too fast even for multiple choice).
-- 3. The category vote (already run during the lobby, before the first
--    question -- that part was already correct) expands from a random
--    2-of-8 binary pick to a real vote across all 8 categories.

-- ---------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------

alter table public.answers add column answer_text text;
alter table public.answers alter column choice_index drop not null;

alter table public.team_answers add column answer_text text;

alter table public.rooms add column category_options uuid[];

alter table public.category_votes add column choice_pack_id uuid references public.question_packs(id);

update public.questions set time_limit_seconds = 30;
alter table public.questions alter column time_limit_seconds set default 30;

-- ---------------------------------------------------------------------
-- Room creation: offer every category, not just a random 2
-- ---------------------------------------------------------------------

create or replace function public.create_room(p_starts_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
returns table(room_id uuid, code text, host_secret uuid)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_code text;
  v_room public.rooms;
  v_secret uuid;
  v_category_options uuid[];
begin
  select array_agg(id order by random()) into v_category_options from public.question_packs;

  loop
    v_code := upper(substr(md5(random()::text), 1, 5));
    begin
      insert into public.rooms (code, starts_at, category_option_a, category_option_b, category_options)
        values (v_code, p_starts_at, v_category_options[1], v_category_options[2], v_category_options)
        returning * into v_room;
      exit;
    exception when unique_violation then
    end;
  end loop;

  insert into public.room_hosts (room_id) values (v_room.id)
    returning room_hosts.host_secret into v_secret;

  return query select v_room.id, v_room.code, v_secret;
end;
$function$;

-- ---------------------------------------------------------------------
-- Category voting: vote for a pack directly instead of a binary index
-- ---------------------------------------------------------------------

drop function if exists public.cast_vote(uuid, uuid, uuid, smallint);

create or replace function public.cast_vote(
  p_room_id uuid,
  p_player_id uuid,
  p_client_token uuid,
  p_pack_id uuid
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_room public.rooms;
begin
  select * into v_room from public.rooms where id = p_room_id;
  if not found or v_room.phase <> 'lobby' then
    raise exception 'VOTING_CLOSED';
  end if;
  perform 1 from public.players pl
    where pl.id = p_player_id and pl.room_id = p_room_id and pl.client_token = p_client_token;
  if not found then
    raise exception 'NOT_AUTHORIZED';
  end if;
  if v_room.category_options is null or not (p_pack_id = any(v_room.category_options)) then
    raise exception 'INVALID_CHOICE';
  end if;

  insert into public.category_votes (room_id, player_id, choice, choice_pack_id)
    values (p_room_id, p_player_id, 0, p_pack_id)
    on conflict (room_id, player_id) do update set choice_pack_id = excluded.choice_pack_id, voted_at = now();
end;
$function$;

create or replace function public.finalize_voting_and_start(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_room public.rooms;
  v_winner uuid;
  v_question_ids uuid[];
  v_questions_per_game constant int := 20;
  v_small_team record;
  v_member record;
  v_new_team_id uuid;
  v_new_team_name text;
begin
  select * into v_room from public.rooms where id = p_room_id for update;
  if not found or v_room.phase <> 'lobby' then
    return;
  end if;

  for v_small_team in
    select t.id from public.teams t
    where t.room_id = p_room_id and t.kind = 'self' and not t.locked
      and (select count(*) from public.players pl where pl.team_id = t.id and pl.left_at is null) < 3
  loop
    for v_member in select pl.id from public.players pl where pl.team_id = v_small_team.id and pl.left_at is null loop
      select o_team_id, o_team_name into v_new_team_id, v_new_team_name from public.auto_bucket_team(p_room_id);
      update public.players set team_id = v_new_team_id where id = v_member.id;
    end loop;
    delete from public.teams where id = v_small_team.id;
  end loop;

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

  select array_agg(id order by random()) into v_question_ids from (
    select id from public.questions where pack_id = v_winner
    order by last_used_at nulls first, random()
    limit v_questions_per_game
  ) picked;

  update public.questions set last_used_at = now() where id = any(v_question_ids);

  insert into public.room_questions (room_id, order_index, question_id)
  select p_room_id, ord - 1, qid from unnest(v_question_ids) with ordinality as t(qid, ord);

  update public.rooms set
    winning_category_id = v_winner,
    phase = 'question',
    current_question_index = 0,
    question_started_at = now(),
    phase_started_at = now(),
    revealed_correct_index = null
  where id = p_room_id;
end;
$function$;

-- ---------------------------------------------------------------------
-- Voting on the question itself: typed text instead of a choice index
-- ---------------------------------------------------------------------

drop function if exists public.cast_team_vote(uuid, uuid, uuid, uuid, smallint);

create or replace function public.cast_team_vote(
  p_room_id uuid,
  p_player_id uuid,
  p_client_token uuid,
  p_question_id uuid,
  p_answer_text text
)
returns table(o_recorded boolean)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_room public.rooms;
  v_expected_question_id uuid;
begin
  select * into v_room from public.rooms where id = p_room_id;
  if not found then
    raise exception 'ROOM_NOT_FOUND';
  end if;
  if v_room.phase <> 'question' then
    raise exception 'NOT_ACCEPTING_ANSWERS';
  end if;
  if length(trim(coalesce(p_answer_text, ''))) < 1 or length(p_answer_text) > 200 then
    raise exception 'INVALID_ANSWER';
  end if;

  perform 1 from public.players pl
    where pl.id = p_player_id and pl.room_id = p_room_id and pl.client_token = p_client_token and pl.left_at is null;
  if not found then
    raise exception 'NOT_AUTHORIZED';
  end if;

  select rq.question_id into v_expected_question_id from public.room_questions rq
    where rq.room_id = p_room_id and rq.order_index = v_room.current_question_index;
  if v_expected_question_id is null or v_expected_question_id <> p_question_id then
    raise exception 'STALE_QUESTION';
  end if;

  insert into public.answers (room_id, question_id, player_id, choice_index, answer_text, correct, points_awarded)
    values (p_room_id, p_question_id, p_player_id, null, trim(p_answer_text), false, 0)
    on conflict (question_id, player_id) do nothing;

  return query select found;
end;
$function$;

-- ---------------------------------------------------------------------
-- Scoring: same "hidden until final" design as before, just matching
-- normalized typed text against the correct choice's text instead of
-- tallying a choice_index. Reuses Family Feud's normalize_feud_text and
-- the same typo-tolerance rule (same-first-letter guard + Levenshtein
-- budget scaled to answer length, plus substring matches).
-- ---------------------------------------------------------------------

create or replace function public.finalize_question_scoring(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_room public.rooms;
  v_question_id uuid;
  v_correct_text text;
  v_norm_correct text;
  v_norm_guess text;
  v_typo_budget int;
  v_team record;
  v_tally record;
  v_winning_text text;
  v_winning_count int;
  v_points int;
  v_is_match boolean;
begin
  select * into v_room from public.rooms where id = p_room_id for update;
  if not found then
    return;
  end if;

  select rq.question_id into v_question_id from public.room_questions rq
    where rq.room_id = p_room_id and rq.order_index = v_room.current_question_index;
  if v_question_id is null then
    return;
  end if;

  select (q.choices->>q.correct_index) into v_correct_text from public.questions q where q.id = v_question_id;
  v_norm_correct := public.normalize_feud_text(v_correct_text);

  for v_team in
    select distinct pl.team_id from public.players pl
    where pl.room_id = p_room_id and pl.team_id is not null and pl.left_at is null
  loop
    v_winning_text := null;
    v_winning_count := 0;

    for v_tally in
      select (array_agg(a.answer_text order by a.answered_at asc))[1] as sample, count(*) as votes
      from public.answers a
      join public.players pl on pl.id = a.player_id
      where a.question_id = v_question_id and pl.team_id = v_team.team_id and pl.left_at is null
        and a.answer_text is not null
      group by public.normalize_feud_text(a.answer_text)
      order by count(*) desc, min(a.answered_at) asc
    loop
      v_winning_text := v_tally.sample;
      v_winning_count := v_tally.votes;
      exit;
    end loop;

    v_is_match := false;
    if v_winning_text is not null then
      v_norm_guess := public.normalize_feud_text(v_winning_text);
      v_typo_budget := case
        when length(v_norm_correct) <= 4 then 1
        when length(v_norm_correct) <= 9 then 2
        else 3
      end;
      if length(v_norm_guess) >= 2 and (
        v_norm_guess = v_norm_correct
        or (length(v_norm_guess) >= 3 and v_norm_correct like '%' || v_norm_guess || '%')
        or (length(v_norm_correct) >= 3 and v_norm_guess like '%' || v_norm_correct || '%')
        or (
          left(v_norm_guess, 1) = left(v_norm_correct, 1)
          and levenshtein(v_norm_guess, v_norm_correct) <= v_typo_budget
        )
      ) then
        v_is_match := true;
      end if;
    end if;

    v_points := 0;
    if v_is_match then
      v_points := 1000;
    end if;

    insert into public.team_answers (room_id, team_id, question_id, answer_text, correct, points_awarded, vote_count)
      values (p_room_id, v_team.team_id, v_question_id, v_winning_text, v_is_match, v_points, v_winning_count)
      on conflict (team_id, question_id) do nothing;
  end loop;
end;
$function$;

-- ---------------------------------------------------------------------
-- Final recap: correct answer text + each team's typed answer, instead
-- of a choices array and indices.
-- ---------------------------------------------------------------------

drop function if exists public.get_final_recap(uuid);

create or replace function public.get_final_recap(p_room_id uuid)
returns table(
  o_question_order int,
  o_prompt text,
  o_correct_answer text,
  o_team_id uuid,
  o_team_name text,
  o_team_answer text,
  o_team_correct boolean,
  o_team_points int
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_room public.rooms;
begin
  select * into v_room from public.rooms where id = p_room_id;
  if not found or v_room.phase <> 'final' then
    raise exception 'NOT_FINAL_YET';
  end if;

  return query
    select rq.order_index, q.prompt, (q.choices->>q.correct_index)::text,
           t.id, t.name, ta.answer_text, ta.correct, ta.points_awarded
    from public.room_questions rq
    join public.questions q on q.id = rq.question_id
    left join public.team_answers ta on ta.question_id = rq.question_id and ta.room_id = p_room_id
    left join public.teams t on t.id = ta.team_id
    where rq.room_id = p_room_id
    order by rq.order_index, t.name;
end;
$function$;

-- ---------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------

grant execute on function public.cast_vote(uuid, uuid, uuid, uuid) to anon, authenticated;
grant execute on function public.cast_team_vote(uuid, uuid, uuid, uuid, text) to anon, authenticated;
grant execute on function public.get_final_recap(uuid) to anon, authenticated;
