-- TESTING ONLY: simulated players for solo play-testing. Applied directly to
-- the live project; mirrored here for history.
--
-- trivia_bot_autopilot() runs every second via pg_cron and drives any trivia
-- player whose nickname starts with 'BOT ':
--   * seats 9 bots in every new lobby: "Quizzly Bears" (a self-made team of
--     3), Team 1 (auto, 4, full) and Team 2 (auto, 2), so a solo human who
--     joins lands on Team 2 with two bot teammates and can test team voting.
--   * category vote: bots vote only after every human in the room has voted,
--     so a lobby of bots alone never triggers the skip-to-5 start.
--   * questions: each bot answers once, 3-17s in, with its own skill level
--     (lower on hard questions), sometimes with a typo.
--
-- TURN OFF BEFORE REAL BAR SERVICE:
--   select cron.unschedule('trivia_bot_autopilot');
--   drop function public.trivia_bot_autopilot();
-- and delete the bot rows if wanted:
--   delete from public.players where nickname like 'BOT %';

create or replace function public.trivia_bot_autopilot()
returns void language plpgsql security definer set search_path to 'public' as $function$
declare b record; r record; ans text; acc numeric; v_team uuid;
begin
  for r in select ro.id, ro.code from rooms ro where not ro.retired and ro.phase='lobby'
           and not exists (select 1 from players p where p.room_id=ro.id and p.nickname like 'BOT %') loop
    perform join_room(r.code, 'BOT Ava', null, 'Quizzly Bears');
    select id into v_team from teams where room_id=r.id and name='Quizzly Bears';
    perform join_room(r.code, 'BOT Ben', v_team, null);
    perform join_room(r.code, 'BOT Cleo', v_team, null);
    perform join_room(r.code, n, null, null) from unnest(array['BOT Fay','BOT Gus','BOT Hana','BOT Ivan','BOT Jo','BOT Dev']) n;
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
end $function$;

revoke execute on function public.trivia_bot_autopilot() from anon, authenticated, public;

select cron.schedule('trivia_bot_autopilot', '1 second', 'select public.trivia_bot_autopilot();');
