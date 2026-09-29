-- Bots are right 60% of the time and wrong 40% (every bot, every question),
-- so a bot teammate can help or hurt. They always answer late in the timer
-- (about 65-88% of it: 23-31 seconds of 35), and a bot on a real player's
-- team gives its own answer, which shows next to its character.

create or replace function public.trivia_bot_answer(p_choices jsonb, p_correct_index int)
returns text
language plpgsql
volatile
as $$
declare
  v_ans text;
begin
  if random() < 0.6 then
    v_ans := p_choices->>p_correct_index;
    -- Now and then a small typo, like a real player (still counts).
    if random() < 0.2 and length(v_ans) > 5 then
      v_ans := overlay(v_ans placing '' from 3 + floor(random() * (length(v_ans) - 4))::int for 1);
    end if;
  else
    v_ans := p_choices->>((p_correct_index + 1 + floor(random() * 3)::int) % 4);
  end if;
  return lower(v_ans);
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
  v_limit int;
  v_at numeric;
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

  -- Answers: late in the timer, each bot at its own moment.
  for b in select p.id, p.client_token, ro.id room_id, ro.question_started_at, q.id qid, q.choices, q.correct_index,
                  q.time_limit_seconds
           from players p join rooms ro on ro.id=p.room_id
           join room_questions rq on rq.room_id=ro.id and rq.order_index=ro.current_question_index
           join questions q on q.id=rq.question_id
           where not ro.retired and ro.phase='question' and trivia_is_bot(p.nickname) and p.left_at is null
             and not exists (select 1 from answers a where a.player_id=p.id and a.question_id=q.id) loop
    v_limit := coalesce(b.time_limit_seconds, 35);
    v_at := v_limit * (0.65 + (abs(hashtext(b.id::text || b.qid::text)) % 24) / 100.0);
    continue when now() < b.question_started_at + make_interval(secs => v_at);
    begin
      perform cast_team_vote(b.room_id, b.id, b.client_token, b.qid, trivia_bot_answer(b.choices, b.correct_index));
    exception when others then null;
    end;
  end loop;

  perform trivia_bot_sudden_death();
end $$;

-- Sudden death: same 60/40, 8-15 seconds in.
create or replace function public.trivia_bot_sudden_death()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  b record;
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
    begin
      perform public.submit_sudden_death_answer(b.room_id, b.id, b.client_token, public.trivia_bot_answer(b.choices, b.correct_index));
    exception when others then null;
    end;
  end loop;
end;
$$;
