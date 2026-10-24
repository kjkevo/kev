-- Personal awards on the final screen: every player gets one or two, even on
-- a losing team (fastest right answer, hot streak, category whiz, team MVP,
-- most right answers), so everyone has something to share. Only available
-- once the game is over, and only for your own player.
create or replace function public.trivia_award_rows(p_room_id uuid, p_player_id uuid, p_team_id uuid)
returns table(player_id uuid, order_index int, elapsed_ms int, ok boolean, pack text)
language sql stable security definer set search_path to 'public' as $function$
  select a.player_id, rq.order_index, a.elapsed_ms, public.trivia_answer_matches(a.answer_text, a.question_id), qp.name
  from public.answers a
  join public.players pl on pl.id = a.player_id
  join public.room_questions rq on rq.room_id = p_room_id and rq.question_id = a.question_id
  join public.questions q on q.id = a.question_id
  left join public.question_packs qp on qp.id = q.pack_id
  where a.room_id = p_room_id and a.answer_text is not null
    and (a.player_id = p_player_id or (p_team_id is not null and pl.team_id = p_team_id));
$function$;
revoke execute on function public.trivia_award_rows(uuid, uuid, uuid) from public, anon, authenticated;

create or replace function public.get_player_awards(p_room_id uuid, p_player_id uuid, p_client_token uuid)
returns table(o_icon text, o_title text, o_detail text)
language plpgsql stable security definer set search_path to 'public' as $function$
declare
  v_team uuid;
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
  r record;
begin
  select pl.team_id into v_team from public.players pl
    join public.rooms ro on ro.id = pl.room_id
    where pl.id = p_player_id and pl.room_id = p_room_id and pl.client_token = p_client_token and ro.phase = 'final';
  if not found then
    return;
  end if;

  select count(*), count(*) filter (where ok), min(elapsed_ms) filter (where ok)
    into v_total, v_right, v_fast
    from public.trivia_award_rows(p_room_id, p_player_id, v_team) where player_id = p_player_id;

  for r in select ok from public.trivia_award_rows(p_room_id, p_player_id, v_team) where player_id = p_player_id order by order_index loop
    if r.ok then v_streak := v_streak + 1; v_best_streak := greatest(v_best_streak, v_streak); else v_streak := 0; end if;
  end loop;

  select pack, count(*) filter (where ok), count(*) into v_pack, v_pack_right, v_pack_total
    from public.trivia_award_rows(p_room_id, p_player_id, v_team) where player_id = p_player_id and pack is not null
    group by pack order by count(*) filter (where ok) desc, count(*) limit 1;

  select max(n), count(*) into v_team_best, v_team_size
    from (select player_id, count(*) filter (where ok) n from public.trivia_award_rows(p_room_id, p_player_id, v_team) group by player_id) t;

  -- Best first; the phone shows the top two.
  if v_team_size >= 2 and v_right > 0 and v_right = v_team_best then
    return query select '🧠'::text, 'Team MVP'::text, 'Most right answers on your team (' || v_right || ')';
  end if;
  if v_best_streak >= 3 then
    return query select '🔥'::text, 'Hot streak'::text, v_best_streak || ' right in a row';
  end if;
  if v_fast is not null and v_fast <= 8000 then
    return query select '⚡'::text, 'Fastest finger'::text, 'Right answer in ' || to_char(v_fast / 1000.0, 'FM990.0') || 's';
  end if;
  -- Only in mixed-category games, and only for a strong showing (2/3 or better).
  if v_pack_right >= 2 and v_pack_total < v_total and v_pack_right * 3 >= v_pack_total * 2 then
    return query select '🎯'::text, v_pack || ' whiz', v_pack_right || '/' || v_pack_total || ' right';
  end if;
  if v_right > 0 then
    return query select '✅'::text, 'Sharp'::text, v_right || ' right answer' || case when v_right = 1 then '' else 's' end;
  end if;
  if v_total > 0 then
    return query select '🍻'::text, 'Good sport'::text, 'Answered ' || v_total || ' question' || case when v_total = 1 then '' else 's' end;
  end if;
end;
$function$;
grant execute on function public.get_player_awards(uuid, uuid, uuid) to anon, authenticated;
