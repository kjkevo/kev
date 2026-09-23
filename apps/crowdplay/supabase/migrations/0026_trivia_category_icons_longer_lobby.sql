-- Two independent fixes bundled together:
--
-- 1. Category badges only ever showed the pack's name -- there was no
--    symbol to show because question_packs never had one. Add an `icon`
--    column and populate the 8 existing packs with a slug (not an emoji --
--    the client maps each slug to its own inline SVG so the icon renders
--    identically everywhere instead of depending on the device's emoji
--    font).
--
-- 2. The lobby boarding window (30s) was too short for a bar crowd to
--    actually gather, join, and vote on a category before the round
--    auto-started. Bumping both restart_trivia_now() and tick()'s natural
--    reboarding window to 2 minutes.

alter table public.question_packs add column if not exists icon text;

update public.question_packs set icon = 'beer' where name = 'Bar Night Classics';
update public.question_packs set icon = 'clock' where name = 'Decades Nostalgia';
update public.question_packs set icon = 'burger' where name = 'Food & Drink';
update public.question_packs set icon = 'film' where name = 'Franchise Specifics';
update public.question_packs set icon = 'globe' where name = 'Geography & History';
update public.question_packs set icon = 'music' where name = 'Music & Audio Rounds';
update public.question_packs set icon = 'tv' where name = 'Pop Culture & Entertainment';
update public.question_packs set icon = 'trophy' where name = 'Sports';

create or replace function public.restart_trivia_now()
returns table(room_id uuid, code text)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_room_id uuid;
  v_code text;
begin
  update public.rooms set retired = true where not retired;

  select cr.room_id, cr.code into v_room_id, v_code
    from public.create_room(now() + make_interval(secs => 120)) cr;

  return query select v_room_id, v_code;
end;
$function$;

create or replace function public.tick()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_final_dwell constant int := 20;
  v_lobby_boarding_seconds constant int := 120;
  v_room record;
  v_total int;
begin
  for v_room in select * from public.rooms where phase <> 'final' or not retired loop

    if v_room.phase = 'lobby' and v_room.starts_at is not null and v_room.starts_at <= now() then
      perform public.finalize_voting_and_start(v_room.id);

    elsif v_room.phase = 'question' then
      select q.time_limit_seconds into v_total
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
