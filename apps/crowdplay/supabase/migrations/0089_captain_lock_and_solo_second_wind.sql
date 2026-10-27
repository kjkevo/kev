-- Found while play-testing the character powers:
-- 1) On a captain question the team only locked in once every member had
--    voted, which can't happen (only the captain may vote), so captains never
--    saw "Locked in" and Second Wind couldn't be used there. The captain's
--    answer now locks the team at once.
-- 2) A team of one never locks in, so Second Wind could never be used by a
--    solo player. Their answer now counts as the team's.
do $patch$
declare d text; n text;
begin
  d := pg_get_functiondef('public.cast_team_vote(uuid, uuid, uuid, uuid, text)'::regprocedure);
  n := replace(d, $a$  if v_team is not null then
    select count(*) into v_members from public.players pl where pl.team_id = v_team and pl.left_at is null;$a$,
  $a$  -- Captain question: the captain's answer is the team's answer, locked at once.
  if v_twist = 'captain' and v_team is not null and v_captains ? v_team::text
     and (v_captains->>v_team::text)::uuid = p_player_id then
    v_key := public.trivia_vote_key(trim(p_answer_text), p_question_id);
    insert into public.team_answers (room_id, team_id, question_id, answer_text, correct, points_awarded, vote_count)
      values (p_room_id, v_team, p_question_id, trim(p_answer_text), v_key = 'correct',
              public.trivia_team_award(v_team, p_question_id, v_key = 'correct'), 1)
      on conflict (team_id, question_id) do nothing;
    return query select true;
    return;
  end if;

  if v_team is not null then
    select count(*) into v_members from public.players pl where pl.team_id = v_team and pl.left_at is null;$a$);
  if n = d then raise exception 'captain patch did not apply'; end if;
  execute n;

  d := pg_get_functiondef('public.use_power(uuid, uuid, uuid, uuid)'::regprocedure);
  n := replace(d, $a$  if v_power = 'second_wind' then
    if v_locked.team_id is null then
      raise exception 'NOT_LOCKED_YET';
    end if;$a$, $a$  if v_power = 'second_wind' then
    if v_locked.team_id is null then
      -- A solo player never "locks"; their answer counts as the team's.
      select a.answer_text into v_hint from public.answers a join public.players pl on pl.id = a.player_id
        where a.question_id = p_question_id and pl.team_id = v_team and pl.left_at is null and a.answer_text is not null
          and (select count(*) from public.players x where x.team_id = v_team and x.left_at is null) = 1;
      if v_hint is null then
        raise exception 'NOT_LOCKED_YET';
      end if;
      v_locked.answer_text := v_hint;
      v_locked.correct := public.trivia_vote_key(v_hint, p_question_id) = 'correct';
      v_hint := null;
    end if;$a$);
  if n = d then raise exception 'solo patch did not apply'; end if;
  execute n;
end $patch$;
