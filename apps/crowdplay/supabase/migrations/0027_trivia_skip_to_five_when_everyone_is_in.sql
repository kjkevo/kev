-- Stop making a room wait out the whole clock once everyone's already in.
--
-- 1. Lobby: once every active player has cast a category vote, the start
--    countdown jumps to 5 seconds, and the top-voted category starts when
--    it runs out (finalize_voting_and_start already picks the winner).
-- 2. Question: once every active player has submitted an answer, the
--    question timer jumps to 5 seconds remaining, and the team answers get
--    scored when it runs out, same as a natural timeout.
--
-- Both are done by moving the timestamps every client already counts down
-- from (starts_at, and question_started_at + time_limit_seconds), so phones,
-- the venue screen and the host view all jump to 5 on the next realtime
-- update with no client changes. Neither ever lengthens a timer: if 5
-- seconds or less is already left, nothing changes. "Active" means joined,
-- not left, and on a team (everyone is, once auto-bucketed at join).
create or replace function public.tick()
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_final_dwell constant int := 20;
  v_lobby_boarding_seconds constant int := 120;
  v_skip_to_seconds constant int := 5;
  v_room record;
  v_total int;
  v_question_id uuid;
  v_active int;
  v_done int;
begin
  for v_room in select * from public.rooms where phase <> 'final' or not retired loop

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

    elsif v_room.phase = 'final' and not v_room.retired then
      if now() >= v_room.phase_started_at + make_interval(secs => v_final_dwell) then
        update public.rooms set retired = true where id = v_room.id;
      end if;
    end if;

  end loop;

  if not exists (select 1 from public.rooms where not retired) then
    perform public.create_room(now() + make_interval(secs => v_lobby_boarding_seconds));
  end if;
end;
$function$;

revoke execute on function public.tick() from anon, authenticated, public;
