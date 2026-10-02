-- "Pick your corner": after each question, an 8-second reveal shows the
-- right answer and every player's character standing on the answer they
-- picked (right ones cheer, wrong ones drop). Then the next question.

create or replace function public.tick()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_final_dwell constant int := 20;
  v_reveal_seconds constant int := 8;
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
        -- Time's up: show who picked what before moving on.
        update public.rooms set phase = 'reveal', phase_started_at = now() where id = v_room.id;

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

    elsif v_room.phase = 'reveal' then
      if now() >= v_room.phase_started_at + make_interval(secs => v_reveal_seconds) then
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
$function$;

-- The venue feed: sudden death and the winner now follow a reveal.
do $$
declare d text;
begin
  d := pg_get_functiondef('public.game_events_on_room'::regproc);
  d := replace(d, E'new.phase = ''sudden_death'' and old.phase = ''question''',
                  E'new.phase = ''sudden_death'' and old.phase in (''question'', ''reveal'')');
  d := replace(d, E'old.phase in (''question'', ''sudden_death'')',
                  E'old.phase in (''question'', ''reveal'', ''sudden_death'')');
  if position('''reveal''' in d) = 0 then
    raise exception 'game_events_on_room patch did not apply';
  end if;
  execute d;
end $$;

-- Who picked what on the question just played (only during its reveal).
-- One row per player on a team: their answer's group, a label for it (the
-- first way someone typed it), whether it's right, and their team's result.
create or replace function public.get_question_reveal(p_room_id uuid)
returns table(o_player_id uuid, o_team_id uuid, o_group text, o_label text, o_correct boolean,
              o_team_correct boolean, o_correct_answer text)
language plpgsql stable security definer set search_path to 'public' as $function$
declare
  v_room public.rooms;
  v_q public.questions;
begin
  select * into v_room from public.rooms where id = p_room_id;
  if not found or v_room.phase <> 'reveal' then
    return;
  end if;
  select q.* into v_q from public.room_questions rq join public.questions q on q.id = rq.question_id
    where rq.room_id = p_room_id and rq.order_index = v_room.current_question_index;
  return query
    with picks as (
      select pl.id player_id, pl.team_id, a.answer_text, a.answered_at,
             case when a.answer_text is null then null else public.trivia_vote_key(a.answer_text, v_q.id) end k
      from public.players pl
      left join public.answers a on a.player_id = pl.id and a.question_id = v_q.id
      where pl.room_id = p_room_id and pl.left_at is null and pl.team_id is not null
    )
    select p.player_id, p.team_id, p.k,
           (select p2.answer_text from picks p2 where p2.k = p.k order by p2.answered_at limit 1),
           coalesce(p.k = 'correct', false),
           coalesce((select ta.correct from public.team_answers ta where ta.team_id = p.team_id and ta.question_id = v_q.id), false),
           v_q.choices->>v_q.correct_index
    from picks p;
end;
$function$;
grant execute on function public.get_question_reveal(uuid) to anon, authenticated;
