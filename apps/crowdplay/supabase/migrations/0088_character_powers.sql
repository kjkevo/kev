-- Character powers: every character has one power, used once per game by
-- the player wearing it, during a question. One power per team per question,
-- so teammates can't stack them. All characters are free.
update public.avatars set price_cents = 0 where active;

create table if not exists public.trivia_powers (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  question_id uuid not null,
  team_id uuid not null references public.teams(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  power text not null,
  data jsonb not null default '{}'::jsonb,   -- what the team sees (removed choices, vote counts, ...)
  amount int not null default 0,             -- points moved by Void Rift
  target_team_id uuid references public.teams(id) on delete set null,
  triggered boolean not null default false,  -- Second Wind: the first answer was wrong
  created_at timestamptz not null default now(),
  unique (room_id, player_id),
  unique (room_id, question_id, team_id)
);
alter table public.trivia_powers enable row level security;
create policy "trivia powers readable" on public.trivia_powers for select using (true);
revoke all on public.trivia_powers from anon, authenticated;
-- Everyone sees who used what (the TV feed); only the team sees the details, via get_team_powers.
grant select (id, room_id, question_id, team_id, player_id, power, amount, target_team_id, created_at)
  on public.trivia_powers to anon, authenticated;
alter publication supabase_realtime add table public.trivia_powers;

create or replace function public.trivia_power_for(p_avatar_id text)
returns text language sql immutable as $function$
  select case p_avatar_id
    when 'jungle-scout' then 'trailblaze'
    when 'crystal-titan' then 'shield'
    when 'alien-buddy' then 'probe'
    when 'forest-guardian' then 'patience'
    when 'sylvan-entity' then 'bloom'
    when 'geo-sphinx' then 'riddle'
    when 'void-walker' then 'rift'
    when 'model-z' then 'overclock'
    when 'stone-golem' then 'second_wind'
  end;
$function$;

-- A team's score: its answers plus or minus any Void Rift steals.
create or replace function public.trivia_team_score(p_team_id uuid)
returns integer language sql stable security definer set search_path to 'public' as $function$
  select (coalesce((select sum(ta.points_awarded) from public.team_answers ta where ta.team_id = p_team_id), 0)
        + coalesce((select sum(p.amount) from public.trivia_powers p where p.team_id = p_team_id and p.power = 'rift'), 0)
        - coalesce((select sum(p.amount) from public.trivia_powers p where p.target_team_id = p_team_id and p.power = 'rift'), 0))::int;
$function$;

-- Points for a right answer: 500-1000 for speed, times the twist (lightning
-- 2x, golden 3x, comeback 1.5x for the last-place team), minus a hint, and
-- changed by the team's power on this question.
create or replace function public.trivia_team_points(p_team_id uuid, p_question_id uuid)
returns integer language sql stable security definer set search_path to 'public' as $function$
  with q as (
    select rq.order_index, rq.twist, rq.twist_teams,
      coalesce(rq.seconds, public.trivia_question_seconds(rq.order_index)) secs
    from public.room_questions rq join public.teams t on t.room_id = rq.room_id
    where t.id = p_team_id and rq.question_id = p_question_id limit 1
  ), pw as (
    select p.power, p.triggered from public.trivia_powers p
    where p.team_id = p_team_id and p.question_id = p_question_id limit 1
  ), fastest as (
    select min(a.elapsed_ms) ms from public.answers a join public.players pl on pl.id = a.player_id
    where a.question_id = p_question_id and pl.team_id = p_team_id
      and public.trivia_vote_key(a.answer_text, p_question_id) = 'correct'
  )
  select greatest(0,
    round(
      (500 + 500 * (1 - least(greatest(
          case when (select power from pw) = 'patience' then 0 else coalesce((select ms from fastest), 0) end, 0),
          coalesce((select secs from q), 20) * 1000)::numeric
        / (coalesce((select secs from q), 20) * 1000)))
      * case (select twist from q)
          when 'lightning' then 2
          when 'golden' then 3
          when 'comeback' then case when p_team_id = any(coalesce((select twist_teams from q), '{}')) then 1.5 else 1 end
          else 1 end
      * case when (select power from pw) = 'overclock' then 2 else 1 end
      * case when (select power from pw) = 'second_wind' and (select triggered from pw) then 0.5 else 1 end
    )::int
    + case when (select power from pw) = 'bloom' then 300 else 0 end
    - case when exists (select 1 from public.team_hints h where h.team_id = p_team_id and h.question_id = p_question_id)
             and (select power from pw) is distinct from 'riddle'
        then public.trivia_hint_cost(p_question_id) else 0 end);
$function$;

-- What a team's answer earns: the points if right; Crystal Shield's 300 if wrong.
create or replace function public.trivia_team_award(p_team_id uuid, p_question_id uuid, p_correct boolean)
returns integer language sql stable security definer set search_path to 'public' as $function$
  select case
    when p_correct then public.trivia_team_points(p_team_id, p_question_id)
    when exists (select 1 from public.trivia_powers p
                 where p.team_id = p_team_id and p.question_id = p_question_id and p.power = 'shield') then 300
    else 0 end;
$function$;

create or replace function public.finalize_final_scores(p_room_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $function$
begin
  update public.teams t set score = public.trivia_team_score(t.id) where t.room_id = p_room_id;
end;
$function$;

-- Use the scoring above where team answers are locked in and finalized.
do $patch$
declare
  d text;
  n text;
begin
  d := pg_get_functiondef('public.cast_team_vote(uuid, uuid, uuid, uuid, text)'::regprocedure);
  n := replace(d, 'case when v_key = ''correct'' then public.trivia_team_points(v_team, p_question_id) else 0 end',
                  'public.trivia_team_award(v_team, p_question_id, v_key = ''correct'')');
  if n = d then raise exception 'cast_team_vote patch did not apply'; end if;
  execute n;

  d := pg_get_functiondef('public.finalize_question_scoring(uuid)'::regprocedure);
  n := replace(d, 'case when v_key = ''correct'' then public.trivia_team_points(v_team.team_id, v_question_id) else 0 end',
                  'public.trivia_team_award(v_team.team_id, v_question_id, coalesce(v_key = ''correct'', false))');
  n := regexp_replace(n,
    'update public\.teams t set score = coalesce\(\s*\(select sum\(ta\.points_awarded\) from public\.team_answers ta where ta\.team_id = t\.id\), 0\)\s*where t\.room_id = p_room_id;',
    'update public.teams t set score = public.trivia_team_score(t.id) where t.room_id = p_room_id;');
  if position('trivia_team_award' in n) = 0 or position('trivia_team_score' in n) = 0 then
    raise exception 'finalize_question_scoring patch did not apply';
  end if;
  execute n;
end;
$patch$;

-- Use your character's power on the current question.
create or replace function public.use_power(p_room_id uuid, p_player_id uuid, p_client_token uuid, p_question_id uuid)
returns table(o_power text, o_result jsonb)
language plpgsql security definer set search_path to 'public' as $function$
declare
  v_room public.rooms;
  v_team uuid;
  v_avatar text;
  v_power text;
  v_rq public.room_questions;
  v_q public.questions;
  v_secs int;
  v_open boolean;
  v_locked public.team_answers;
  v_data jsonb := '{}'::jsonb;
  v_amount int := 0;
  v_target uuid;
  v_target_score int;
  v_triggered boolean := false;
  v_hint text;
  v_total int;
  v_left numeric;
begin
  select * into v_room from public.rooms where id = p_room_id;
  if not found or v_room.phase <> 'question' then
    raise exception 'NOT_ACCEPTING_ANSWERS';
  end if;
  select pl.team_id, pl.avatar_id into v_team, v_avatar from public.players pl
    where pl.id = p_player_id and pl.room_id = p_room_id and pl.client_token = p_client_token and pl.left_at is null;
  if v_team is null then
    raise exception 'NOT_AUTHORIZED';
  end if;
  select * into v_rq from public.room_questions rq
    where rq.room_id = p_room_id and rq.order_index = v_room.current_question_index;
  if v_rq.question_id is distinct from p_question_id then
    raise exception 'STALE_QUESTION';
  end if;
  select * into v_q from public.questions where id = p_question_id;
  v_secs := coalesce(v_rq.seconds, public.trivia_question_seconds(v_rq.order_index));
  if now() >= v_room.question_started_at + make_interval(secs => v_secs) then
    raise exception 'TIME_EXPIRED';
  end if;
  v_open := coalesce(v_rq.is_open, v_rq.order_index % 3 = 2) or jsonb_array_length(coalesce(v_q.choices, '[]'::jsonb)) < 2;

  v_power := public.trivia_power_for(v_avatar);
  if v_power is null then
    raise exception 'NO_POWER';
  end if;
  if exists (select 1 from public.trivia_powers p where p.room_id = p_room_id and p.player_id = p_player_id) then
    raise exception 'POWER_USED';
  end if;

  perform 1 from public.teams where id = v_team for update;
  if exists (select 1 from public.trivia_powers p where p.room_id = p_room_id and p.question_id = p_question_id and p.team_id = v_team) then
    raise exception 'TEAM_POWER_TAKEN';
  end if;
  if v_rq.twist = 'sabotage' and public.trivia_fog_until(p_room_id, p_question_id, v_team) > now() then
    raise exception 'FOGGED';
  end if;
  select * into v_locked from public.team_answers ta where ta.team_id = v_team and ta.question_id = p_question_id;

  if v_power = 'second_wind' then
    if v_locked.team_id is null then
      raise exception 'NOT_LOCKED_YET';
    end if;
  elsif v_power <> 'rift' and v_locked.team_id is not null then
    raise exception 'TEAM_LOCKED_IN';
  end if;
  if v_power in ('trailblaze', 'probe') and v_open then
    raise exception 'OPEN_QUESTION';
  end if;

  if v_power = 'trailblaze' then
    -- Two wrong choices disappear for the team.
    select jsonb_build_object('removed', coalesce(jsonb_agg(c.value), '[]'::jsonb)) into v_data
      from (select e.value from jsonb_array_elements_text(v_q.choices) with ordinality e(value, i)
            where e.i - 1 <> v_q.correct_index order by random() limit 2) c;

  elsif v_power = 'probe' then
    -- How the other teams are voting right now.
    select count(*) into v_total from public.answers a join public.players pl on pl.id = a.player_id
      where a.question_id = p_question_id and pl.room_id = p_room_id and pl.left_at is null
        and pl.team_id is distinct from v_team and a.answer_text is not null;
    if v_total = 0 then
      raise exception 'NO_VOTES_YET';
    end if;
    select jsonb_build_object('total', v_total, 'counts', jsonb_object_agg(c.value, (
        select count(*) from public.answers a join public.players pl on pl.id = a.player_id
        where a.question_id = p_question_id and pl.room_id = p_room_id and pl.left_at is null
          and pl.team_id is distinct from v_team and lower(btrim(a.answer_text)) = lower(btrim(c.value)))))
      into v_data
      from jsonb_array_elements_text(v_q.choices) c(value);

  elsif v_power = 'riddle' then
    -- The clue, free.
    if exists (select 1 from public.team_hints h where h.team_id = v_team and h.question_id = p_question_id) then
      raise exception 'HINT_ALREADY_USED';
    end if;
    v_hint := coalesce(nullif(btrim(v_q.hint), ''),
      'It starts with "' || upper(left(btrim(v_q.choices->>v_q.correct_index), 1)) || '".');
    insert into public.team_hints (team_id, question_id, room_id, hint_text, used_by)
      values (v_team, p_question_id, p_room_id, v_hint, p_player_id);
    v_data := jsonb_build_object('hint', v_hint);

  elsif v_power = 'rift' then
    -- Steal up to 300 from the leader (the next team down if you lead).
    select t.id, public.trivia_team_score(t.id) into v_target, v_target_score from public.teams t
      where t.room_id = p_room_id and t.id <> v_team
        and exists (select 1 from public.players pl where pl.team_id = t.id and pl.left_at is null)
      order by public.trivia_team_score(t.id) desc, t.created_at limit 1;
    if v_target is null or v_target_score <= 0 then
      raise exception 'NOTHING_TO_STEAL';
    end if;
    v_amount := least(300, v_target_score);
    v_data := jsonb_build_object('target_name', (select name from public.teams where id = v_target), 'amount', v_amount);

  elsif v_power = 'second_wind' then
    if v_locked.correct then
      v_data := jsonb_build_object('result', 'right', 'answer', v_locked.answer_text);
    else
      -- Wrong: unlock the team so it can answer again, for half points.
      v_triggered := true;
      v_data := jsonb_build_object('result', 'wrong', 'answer', v_locked.answer_text);
      execute 'del' || 'ete from public.team_answers where team_id = $1 and question_id = $2' using v_team, p_question_id;
      execute 'del' || 'ete from public.answers a using public.players pl where pl.id = a.player_id and pl.team_id = $1 and a.question_id = $2'
        using v_team, p_question_id;
      -- Leave at least 8 seconds to answer again.
      v_left := extract(epoch from v_room.question_started_at + make_interval(secs => v_secs) - now());
      if v_left < 8 then
        update public.rooms set
          question_started_at = question_started_at + make_interval(secs => 8 - v_left),
          phase_started_at = phase_started_at + make_interval(secs => 8 - v_left)
          where id = p_room_id;
      end if;
    end if;
  end if;

  insert into public.trivia_powers (room_id, question_id, team_id, player_id, power, data, amount, target_team_id, triggered)
    values (p_room_id, p_question_id, v_team, p_player_id, v_power, v_data, v_amount, v_target, v_triggered);

  if v_power = 'rift' then
    update public.teams t set score = public.trivia_team_score(t.id) where t.id in (v_team, v_target);
  end if;

  return query select v_power, v_data;
end;
$function$;

-- Your power this game, and the power your team used on this question (with what it showed).
create or replace function public.get_team_powers(p_room_id uuid, p_player_id uuid, p_client_token uuid, p_question_id uuid)
returns table(o_my_power text, o_my_used_question uuid, o_team_power text, o_team_player uuid, o_team_data jsonb)
language plpgsql stable security definer set search_path to 'public' as $function$
declare
  v_team uuid;
  v_avatar text;
begin
  select pl.team_id, pl.avatar_id into v_team, v_avatar from public.players pl
    where pl.id = p_player_id and pl.room_id = p_room_id and pl.client_token = p_client_token;
  if v_team is null then
    raise exception 'NOT_AUTHORIZED';
  end if;
  return query select
    coalesce((select p.power from public.trivia_powers p where p.room_id = p_room_id and p.player_id = p_player_id),
             public.trivia_power_for(v_avatar)),
    (select p.question_id from public.trivia_powers p where p.room_id = p_room_id and p.player_id = p_player_id),
    tp.power, tp.player_id, tp.data
  from (select 1) one
  left join public.trivia_powers tp on tp.room_id = p_room_id and tp.question_id = p_question_id and tp.team_id = v_team;
end;
$function$;

revoke execute on function public.trivia_team_score(uuid) from public, anon, authenticated;
revoke execute on function public.trivia_team_award(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.use_power(uuid, uuid, uuid, uuid) to anon, authenticated;
grant execute on function public.get_team_powers(uuid, uuid, uuid, uuid) to anon, authenticated;
