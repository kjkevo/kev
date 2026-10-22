-- End a game nobody is playing: if no real player has answered any of the
-- last 3 questions, it finishes early (ended_reason = 'idle') instead of
-- running on to an empty room; the next lobby opens after it.
alter table public.rooms add column if not exists ended_reason text;

do $$
declare d text;
begin
  d := pg_get_functiondef('public.tick'::regproc);
  d := replace(d,
$old$        if v_room.current_question_index + 1 >= v_total then
          perform public.finalize_final_scores(v_room.id);$old$,
$new$        if v_room.current_question_index >= 2
           and exists (select 1 from public.players pl where pl.room_id = v_room.id and not pl.is_bot)
           and not exists (
             select 1 from public.answers a
             join public.players pl on pl.id = a.player_id
             join public.room_questions rq on rq.room_id = v_room.id and rq.question_id = a.question_id
             where pl.room_id = v_room.id and not pl.is_bot
               and rq.order_index >= v_room.current_question_index - 2) then
          -- Nobody real has answered for 3 questions: end it rather than
          -- play on to an empty room (the next lobby opens after).
          perform public.finalize_final_scores(v_room.id);
          update public.rooms set phase = 'final', phase_started_at = now(), ended_reason = 'idle'
            where id = v_room.id;
        elsif v_room.current_question_index + 1 >= v_total then
          perform public.finalize_final_scores(v_room.id);$new$);
  if position('ended_reason' in d) = 0 then
    raise exception 'tick patch did not apply';
  end if;
  execute d;
end $$;
