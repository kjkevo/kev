-- More end-of-game awards, each with its own symbol (an icon name the
-- phone draws), so it isn't "Fastest finger" and "Sharp" every game. Best
-- first; the phone shows the top three.
create or replace function public.get_player_awards(p_room_id uuid, p_player_id uuid, p_client_token uuid)
returns table(o_icon text, o_title text, o_detail text)
language plpgsql stable security definer set search_path to 'public' as $function$
declare
  v_team uuid;
  v_mode text;
  v_questions int;
  v_last int;
  v_total int;
  v_right int;
  v_fast int;
  v_streak int := 0;
  v_best_streak int := 0;
  v_pack text;
  v_pack_right int;
  v_pack_total int;
  v_team_best int;
  v_team_size int;
  v_rank int;
  v_golden boolean;
  v_lightning int;
  v_closer boolean;
  v_finish int;
  v_only int;
  v_clues int;
  v_power text;
  r record;
begin
  select pl.team_id, ro.mode into v_team, v_mode from public.players pl
    join public.rooms ro on ro.id = pl.room_id
    where pl.id = p_player_id and pl.room_id = p_room_id and pl.client_token = p_client_token and ro.phase = 'final';
  if not found then
    return;
  end if;

  select count(*), max(order_index) into v_questions, v_last from public.room_questions where room_id = p_room_id;

  select count(*), count(*) filter (where ok), min(elapsed_ms) filter (where ok)
    into v_total, v_right, v_fast from public.trivia_award_rows(p_room_id, p_player_id, v_team) where player_id = p_player_id;

  for r in select ok from public.trivia_award_rows(p_room_id, p_player_id, v_team) where player_id = p_player_id order by order_index loop
    if r.ok then v_streak := v_streak + 1; v_best_streak := greatest(v_best_streak, v_streak); else v_streak := 0; end if;
  end loop;

  select pack, count(*) filter (where ok), count(*) into v_pack, v_pack_right, v_pack_total
    from public.trivia_award_rows(p_room_id, p_player_id, v_team) where player_id = p_player_id and pack is not null
    group by pack order by count(*) filter (where ok) desc, count(*) limit 1;

  select max(n), count(*) into v_team_best, v_team_size
    from (select player_id, count(*) filter (where ok) n from public.trivia_award_rows(p_room_id, p_player_id, v_team) group by player_id) t;

  select o_rank into v_rank from public.get_round_standings(p_room_id) where o_team_id = v_team;

  select exists (select 1 from public.trivia_award_rows(p_room_id, p_player_id, v_team) a join public.room_questions rq on rq.room_id = p_room_id and rq.order_index = a.order_index
                 where a.player_id = p_player_id and a.ok and rq.twist = 'golden'),
         (select count(*) from public.trivia_award_rows(p_room_id, p_player_id, v_team) a join public.room_questions rq on rq.room_id = p_room_id and rq.order_index = a.order_index
                 where a.player_id = p_player_id and a.ok and rq.twist = 'lightning'),
         exists (select 1 from public.trivia_award_rows(p_room_id, p_player_id, v_team) a where a.player_id = p_player_id and a.ok and a.order_index = v_last),
         (select count(*) from public.trivia_award_rows(p_room_id, p_player_id, v_team) a where a.player_id = p_player_id and a.ok and a.order_index > v_last - 3)
    into v_golden, v_lightning, v_closer, v_finish;

  -- Questions only this player got right (everyone in the room, bots too).
  select count(*) into v_only from public.trivia_award_rows(p_room_id, p_player_id, v_team) mine
    where mine.player_id = p_player_id and mine.ok
      and not exists (
        select 1 from public.answers a
        join public.players pl on pl.id = a.player_id
        join public.room_questions rq on rq.room_id = p_room_id and rq.question_id = a.question_id
        where a.room_id = p_room_id and a.player_id <> p_player_id and rq.order_index = mine.order_index
          and a.answer_text is not null and public.trivia_answer_matches(a.answer_text, a.question_id));

  select count(*) into v_clues from public.team_hints h where h.team_id = v_team;
  select tp.power into v_power from public.trivia_powers tp where tp.player_id = p_player_id limit 1;

  if v_rank = 1 then
    return query select 'trophy'::text, 'Champion'::text, case when v_mode = 'solo' then 'Won the game' else 'Your team won' end;
  end if;
  if v_questions >= 5 and v_right = v_questions then
    return query select 'star'::text, 'Perfect game'::text, 'Every answer right';
  end if;
  if v_only >= 1 then
    return query select 'wolf'::text, 'Lone wolf'::text,
      case when v_only = 1 then 'Only one to get a question right' else 'Only one right on ' || v_only || ' questions' end;
  end if;
  if v_team_size >= 2 and v_right > 0 and v_right = v_team_best and v_mode <> 'solo' then
    return query select 'crown'::text, 'Team MVP'::text, 'Most right on your team (' || v_right || ')';
  end if;
  if v_golden then
    return query select 'star'::text, 'Golden touch'::text, 'Nailed the golden question';
  end if;
  if v_best_streak >= 3 then
    return query select 'flame'::text, 'Hot streak'::text, v_best_streak || ' right in a row';
  end if;
  if v_lightning >= 2 then
    return query select 'bolt'::text, 'Lightning reflexes'::text, v_lightning || ' lightning questions right';
  end if;
  if v_rank between 2 and 3 then
    return query select 'medal'::text, 'Podium'::text, 'Finished ' || case v_rank when 2 then '2nd' else '3rd' end;
  end if;
  if v_finish >= 3 then
    return query select 'up'::text, 'Strong finish'::text, 'Last 3 questions right';
  elsif v_closer then
    return query select 'flag'::text, 'Closer'::text, 'Got the final question';
  end if;
  if v_pack_right >= 2 and v_pack_total < v_total and v_pack_right * 3 >= v_pack_total * 2 then
    return query select 'target'::text, v_pack || ' whiz', v_pack_right || ' of ' || v_pack_total || ' right';
  end if;
  if v_fast is not null and v_fast <= 5000 then
    return query select 'clock'::text, 'Quick draw'::text, 'Right in ' || to_char(v_fast / 1000.0, 'FM990.0') || ' seconds';
  end if;
  if v_right >= 4 and v_clues = 0 then
    return query select 'eye'::text, 'No clues needed'::text, v_right || ' right, zero clues';
  end if;
  if v_power is not null then
    return query select 'wand'::text, 'Power player'::text, 'Used ' || case v_power
      when 'trailblaze' then 'Trailblaze' when 'shield' then 'Crystal Shield' when 'probe' then 'Mind Probe'
      when 'patience' then 'Patience' when 'bloom' then 'Bloom' when 'riddle' then 'Riddle Sight'
      when 'rift' then 'Void Rift' when 'overclock' then 'Overclock' when 'second_wind' then 'Second Wind' else 'a power' end;
  end if;
  if v_right > 0 then
    return query select 'check'::text, 'On the board'::text, v_right || ' right answer' || case when v_right = 1 then '' else 's' end;
  end if;
  if v_total > 0 and v_right = 0 then
    return query select 'beer'::text, 'Good sport'::text, 'Played ' || v_total || ' question' || case when v_total = 1 then '' else 's' end;
  end if;
end;
$function$;
