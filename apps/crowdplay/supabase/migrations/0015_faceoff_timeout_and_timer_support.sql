-- Adds a dedicated face-off timeout: if 20 seconds pass in the 'play' phase
-- with nobody having taken control yet, the ticker randomly assigns
-- controlling_team (as if that team had been in control and just struck
-- out) and opens a one-guess steal for the other team -- so a stalled
-- face-off resolves into a moment instead of stalling the whole game. This
-- is separate from the existing 45s "team in control went quiet" idle
-- timeout, which is unchanged.
--
-- Client side, this pairs with a circular countdown ring (both this and the
-- reveal/leaderboard auto-advance) computed from phase_started_at, which
-- this migration doesn't touch -- it's purely a display derived from
-- existing columns.

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
  v_faceoff_timeout_seconds constant int := 20;
  v_fast_money_turn_seconds constant int := 60;
  v_room record;
  v_answers jsonb;
  v_full_board jsonb;
  j int;
begin
  for v_room in select * from public.feud_rooms where phase <> 'final' or not retired loop

    if v_room.phase = 'lobby' and v_room.starts_at is not null and v_room.starts_at <= now() then
      perform public.start_feud_round(v_room.id);

    elsif v_room.phase = 'play' and v_room.controlling_team is null then
      if now() >= v_room.phase_started_at + make_interval(secs => v_faceoff_timeout_seconds) then
        update public.feud_rooms set
          controlling_team = (array['a','b'])[1 + floor(random() * 2)::int],
          strikes = 3,
          phase = 'steal',
          phase_started_at = now(),
          last_action_at = now()
        where id = v_room.id;
      end if;

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
