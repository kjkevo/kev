-- Fixes everything found in the live bot play-test:
--
-- 1. Answer matching is rebuilt (trivia_text_matches). Numbers and number
--    words work ("3", "three"); numbers must match exactly (no "1913" for
--    1912); typo tolerance only on longer words ("mozarella", "saffon", not
--    "min" for mint); a partial answer only counts when the part you gave is
--    what sets the right answer apart from the other options ("beef" or
--    "puff pastry" yes, "stock" or "pastry" no); extra words are fine
--    ("mint leaves") unless they hedge toward another option. Questions get
--    accepted_answers for fair alternatives ("Swiss", "beef broth",
--    "garbanzo beans", "USA", ...).
-- 2. A team's answer is now the majority by meaning, not exact text:
--    "Mint" + "mint leaves" count as one answer and beat a lone "basil".
-- 3. Teammates see each other's answers live and can change their own vote
--    until time's up. Answer text is no longer readable by everyone (other
--    teams could copy it); get_team_votes() returns only your own team's.
-- 4. Late votes are refused once the timer has run out.
-- 5. Near-duplicate questions are retired (questions.active) and replaced.
-- 6. Retired rooms stop running: every game clock now skips retired rooms,
--    and "restart now" finishes the old room instead of leaving it mid-game.
-- 7. Team names and nicknames are unique regardless of capitalisation.

-- ---------------------------------------------------------------------
-- Answer matching
-- ---------------------------------------------------------------------
alter table public.questions add column accepted_answers text[] not null default '{}';
alter table public.questions add column active boolean not null default true;

create or replace function public.trivia_norm(p text)
returns text language sql immutable as $function$
  select trim(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
    lower(coalesce(p, '')),
    '&', ' and ', 'g'),
    '\+', ' plus ', 'g'),
    '[/_,;:-]', ' ', 'g'),
    '[^a-z0-9 ]', '', 'g'),
    '\s+', ' ', 'g'));
$function$;

-- Key words: no filler words, number words as digits, "80s"/"eighties" as
-- "1980s", simple plurals dropped (applied to both sides, so it's symmetric).
create or replace function public.trivia_tokens(p text)
returns text[] language plpgsql immutable as $function$
declare
  w text;
  v_out text[] := '{}';
  v_nums constant text[] := array['zero','one','two','three','four','five','six','seven','eight','nine','ten',
    'eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen','twenty'];
begin
  foreach w in array regexp_split_to_array(public.trivia_norm(p), ' ') loop
    continue when w = '' or w = any(array['the','a','an','of','and','in','on','at','to','for','its','is','it','or']);
    if w = any(v_nums) then
      w := (array_position(v_nums, w) - 1)::text;
    elsif w in ('thirty','forty','fifty','sixty','seventy','eighty','ninety') then
      w := case w when 'thirty' then '30' when 'forty' then '40' when 'fifty' then '50' when 'sixty' then '60'
                  when 'seventy' then '70' when 'eighty' then '80' else '90' end;
    elsif w ~ '^[2-9]0s$' then
      w := '19' || w;
    elsif w in ('seventies','eighties','nineties') then
      w := case w when 'seventies' then '1970s' when 'eighties' then '1980s' else '1990s' end;
    elsif w ~ '^[a-z]{4,}s$' and w !~ 'ss$' then
      w := left(w, length(w) - 1);
    end if;
    v_out := v_out || w;
  end loop;
  return v_out;
end;
$function$;

-- One word against another: exact, or a typo on a word of 4+ letters
-- (same length and 1 letter off up to 5 letters; 2 off up to 9; 3 beyond).
-- Anything with a digit must match exactly.
create or replace function public.trivia_tok_match(x text, y text)
returns boolean language sql immutable as $function$
  select x = y or (
    x !~ '[0-9]' and y !~ '[0-9]' and length(x) >= 4 and length(y) >= 4 and left(x, 1) = left(y, 1) and
    case when length(y) <= 5 then length(x) = length(y) and levenshtein(x, y) <= 1
         when length(y) <= 9 then levenshtein(x, y) <= 2
         else levenshtein(x, y) <= 3 end);
$function$;

-- Does p_guess mean p_target, given the other options p_others?
create or replace function public.trivia_text_matches(p_guess text, p_target text, p_others text[])
returns boolean language plpgsql immutable as $function$
declare
  g text[] := public.trivia_tokens(p_guess);
  a text[] := public.trivia_tokens(p_target);
  w text[] := '{}';
  o text;
  x text;
  y text;
  z text;
  v_gs text;
  v_as text;
  v_dist int;
  v_hit boolean;
  v_all boolean;
  v_distinct boolean := false;
begin
  if array_length(g, 1) is null or array_length(a, 1) is null then
    return false;
  end if;
  foreach o in array coalesce(p_others, '{}') loop
    w := w || public.trivia_tokens(o);
  end loop;

  -- Same words (spacing aside): "r2d2" = "R2-D2", "1,440" = "1440".
  v_gs := array_to_string(g, '');
  v_as := array_to_string(a, '');
  if v_gs = v_as then
    return true;
  end if;
  -- Exactly another option (including the same words in another order, as
  -- in "Web World Wide") is that option, never this one.
  if exists (select 1 from unnest(coalesce(p_others, '{}')) oo where array_to_string(public.trivia_tokens(oo), '') = v_gs) then
    return false;
  end if;
  -- Naming a word that only a wrong option has means the guess points there
  -- ("baseball" is never a typo of "basketball"; "3 or 4" isn't "3").
  if exists (select 1 from unnest(g) gg where gg = any(w) and not gg = any(a)) then
    return false;
  end if;

  -- Whole-answer typo, only if it's strictly closer to this answer than to
  -- any other option ("vitamin c" never counts as "Vitamin D").
  if v_as !~ '[0-9]' and public.trivia_tok_match(v_gs, v_as) then
    v_dist := levenshtein(v_gs, v_as);
    if not exists (
      select 1 from unnest(coalesce(p_others, '{}')) oo
      where levenshtein(v_gs, array_to_string(public.trivia_tokens(oo), '')) <= v_dist
    ) then
      return true;
    end if;
  end if;

  -- Every word of the answer is there ("mint leaves" for Mint), and no extra
  -- word points at another option ("beef or chicken" doesn't count).
  v_all := true;
  foreach y in array a loop
    v_hit := false;
    foreach x in array g loop
      if public.trivia_tok_match(x, y) then v_hit := true; exit; end if;
    end loop;
    if not v_hit then v_all := false; exit; end if;
  end loop;
  if v_all then
    foreach x in array g loop
      v_hit := false;
      foreach y in array a loop
        if public.trivia_tok_match(x, y) then v_hit := true; exit; end if;
      end loop;
      if not v_hit then
        foreach z in array w loop
          if public.trivia_tok_match(x, z) then return false; end if;
        end loop;
      end if;
    end loop;
    return true;
  end if;

  -- Part of the answer, as long as that part is what sets it apart from the
  -- other options ("beef" for Beef stock, not "stock").
  v_all := true;
  foreach x in array g loop
    v_hit := false;
    foreach y in array a loop
      if public.trivia_tok_match(x, y) then
        v_hit := true;
        if not exists (select 1 from unnest(w) zz where public.trivia_tok_match(y, zz) or public.trivia_tok_match(x, zz)) then
          v_distinct := true;
        end if;
      end if;
    end loop;
    if not v_hit then v_all := false; exit; end if;
  end loop;
  return v_all and v_distinct;
end;
$function$;

create or replace function public.trivia_answer_matches(p_guess text, p_question_id uuid)
returns boolean language plpgsql stable set search_path to 'public' as $function$
declare
  q public.questions;
  v_correct text;
  v_others text[];
  t text;
begin
  select * into q from public.questions where id = p_question_id;
  if not found then return false; end if;
  v_correct := q.choices->>q.correct_index;
  select coalesce(array_agg(c), '{}') into v_others
    from jsonb_array_elements_text(q.choices) with ordinality e(c, i) where i - 1 <> q.correct_index;
  foreach t in array array[v_correct] || q.accepted_answers loop
    if public.trivia_text_matches(p_guess, t, v_others) then return true; end if;
  end loop;
  return false;
end;
$function$;

-- Which answer a vote means: 'correct', 'choice:<n>' for one of the other
-- options, or 'text:<key words>' for anything else.
create or replace function public.trivia_vote_key(p_guess text, p_question_id uuid)
returns text language plpgsql stable set search_path to 'public' as $function$
declare
  q public.questions;
  v_choices text[];
  i int;
begin
  if public.trivia_answer_matches(p_guess, p_question_id) then
    return 'correct';
  end if;
  select * into q from public.questions where id = p_question_id;
  select array_agg(c order by n) into v_choices from jsonb_array_elements_text(q.choices) with ordinality e(c, n);
  for i in 1 .. coalesce(array_length(v_choices, 1), 0) loop
    continue when i - 1 = q.correct_index;
    if public.trivia_text_matches(p_guess, v_choices[i], v_choices[1:i-1] || v_choices[i+1:]) then
      return 'choice:' || (i - 1);
    end if;
  end loop;
  return 'text:' || array_to_string(public.trivia_tokens(p_guess), ' ');
end;
$function$;

-- ---------------------------------------------------------------------
-- Team scoring: majority by meaning
-- ---------------------------------------------------------------------
create or replace function public.finalize_question_scoring(p_room_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare
  v_room public.rooms;
  v_question_id uuid;
  v_team record;
  v_key text;
  v_sample text;
  v_votes int;
begin
  select * into v_room from public.rooms where id = p_room_id for update;
  if not found then
    return;
  end if;

  select rq.question_id into v_question_id from public.room_questions rq
    where rq.room_id = p_room_id and rq.order_index = v_room.current_question_index;
  if v_question_id is null then
    return;
  end if;

  for v_team in
    select distinct pl.team_id from public.players pl
    where pl.room_id = p_room_id and pl.team_id is not null and pl.left_at is null
  loop
    v_key := null;
    v_sample := null;
    v_votes := 0;
    select v.key, (array_agg(v.answer_text order by v.answered_at))[1], count(*)
      into v_key, v_sample, v_votes
      from (
        select public.trivia_vote_key(a.answer_text, v_question_id) as key, a.answer_text, a.answered_at
        from public.answers a
        join public.players pl on pl.id = a.player_id
        where a.question_id = v_question_id and pl.team_id = v_team.team_id and pl.left_at is null
          and a.answer_text is not null
      ) v
      group by v.key
      order by count(*) desc, min(v.answered_at) asc
      limit 1;

    insert into public.team_answers (room_id, team_id, question_id, answer_text, correct, points_awarded, vote_count)
      values (p_room_id, v_team.team_id, v_question_id, v_sample,
              coalesce(v_key = 'correct', false),
              case when v_key = 'correct' then 1000 else 0 end,
              coalesce(v_votes, 0))
      on conflict (team_id, question_id) do nothing;
  end loop;
end;
$function$;

-- ---------------------------------------------------------------------
-- Team voting: change your vote until time's up; see only your own team
-- ---------------------------------------------------------------------
create or replace function public.cast_team_vote(p_room_id uuid, p_player_id uuid, p_client_token uuid, p_question_id uuid, p_answer_text text)
returns table(o_recorded boolean)
language plpgsql security definer set search_path to 'public' as $function$
declare
  v_room public.rooms;
  v_expected_question_id uuid;
  v_time_limit int;
begin
  select * into v_room from public.rooms where id = p_room_id;
  if not found then
    raise exception 'ROOM_NOT_FOUND';
  end if;
  if v_room.phase <> 'question' then
    raise exception 'NOT_ACCEPTING_ANSWERS';
  end if;
  if length(trim(coalesce(p_answer_text, ''))) < 1 or length(p_answer_text) > 200 then
    raise exception 'INVALID_ANSWER';
  end if;

  perform 1 from public.players pl
    where pl.id = p_player_id and pl.room_id = p_room_id and pl.client_token = p_client_token and pl.left_at is null;
  if not found then
    raise exception 'NOT_AUTHORIZED';
  end if;

  select rq.question_id, q.time_limit_seconds into v_expected_question_id, v_time_limit
    from public.room_questions rq join public.questions q on q.id = rq.question_id
    where rq.room_id = p_room_id and rq.order_index = v_room.current_question_index;
  if v_expected_question_id is null or v_expected_question_id <> p_question_id then
    raise exception 'STALE_QUESTION';
  end if;
  if now() >= v_room.question_started_at + make_interval(secs => v_time_limit) then
    raise exception 'TIME_EXPIRED';
  end if;

  -- answered_at keeps the first vote's time (it breaks ties); only the text changes.
  insert into public.answers (room_id, question_id, player_id, choice_index, answer_text, correct, points_awarded)
    values (p_room_id, p_question_id, p_player_id, null, trim(p_answer_text), false, 0)
    on conflict (question_id, player_id) do update set answer_text = excluded.answer_text;

  return query select true;
end;
$function$;

create or replace function public.get_team_votes(p_room_id uuid, p_player_id uuid, p_client_token uuid, p_question_id uuid)
returns table(o_player_id uuid, o_answer_text text)
language plpgsql stable security definer set search_path to 'public' as $function$
declare
  v_team_id uuid;
begin
  select pl.team_id into v_team_id from public.players pl
    where pl.id = p_player_id and pl.room_id = p_room_id and pl.client_token = p_client_token;
  if v_team_id is null then
    raise exception 'NOT_AUTHORIZED';
  end if;
  return query
    select a.player_id, a.answer_text
    from public.answers a join public.players pl on pl.id = a.player_id
    where a.question_id = p_question_id and a.room_id = p_room_id
      and pl.team_id = v_team_id and pl.left_at is null;
end;
$function$;
grant execute on function public.get_team_votes(uuid, uuid, uuid, uuid) to anon, authenticated;

-- Everyone can still see *that* someone voted (counts, live updates), but
-- not *what* -- that's get_team_votes, for your own team only.
revoke select on public.answers from anon, authenticated;
grant select (id, room_id, question_id, player_id, answered_at) on public.answers to anon, authenticated;

-- ---------------------------------------------------------------------
-- Names unique regardless of capitalisation
-- ---------------------------------------------------------------------
create or replace function public.auto_bucket_team(p_room_id uuid)
returns table(o_team_id uuid, o_team_name text)
language plpgsql security definer set search_path to 'public' as $function$
declare
  v_found_id uuid;
  v_found_name text;
  v_next_num int;
  v_new_id uuid;
  v_new_name text;
begin
  select t.id, t.name into v_found_id, v_found_name
    from public.teams t
    where t.room_id = p_room_id and t.kind = 'auto' and not t.locked
      and (select count(*) from public.players pl where pl.team_id = t.id and pl.left_at is null) < 4
    order by t.created_at asc
    limit 1
    for update of t;

  if v_found_id is not null then
    return query select v_found_id, v_found_name;
    return;
  end if;

  select count(*) + 1 into v_next_num from public.teams t where t.room_id = p_room_id and t.kind = 'auto';
  loop
    v_new_name := 'Team ' || v_next_num;
    exit when not exists (select 1 from public.teams t where t.room_id = p_room_id and lower(t.name) = lower(v_new_name));
    v_next_num := v_next_num + 1;
  end loop;
  insert into public.teams (room_id, name, kind) values (p_room_id, v_new_name, 'auto')
    returning id into v_new_id;

  return query select v_new_id, v_new_name;
end;
$function$;

create or replace function public.join_room(p_code text, p_nickname text, p_team_id uuid default null::uuid, p_new_team_name text default null::text)
returns table(player_id uuid, client_token uuid, room_id uuid, team_id uuid, team_name text)
language plpgsql security definer set search_path to 'public' as $function$
declare
  v_room public.rooms;
  v_player public.players;
  v_team_id uuid;
  v_team_name text;
  v_member_count int;
  v_locked boolean;
  v_ip text;
begin
  select * into v_room from public.rooms where code = upper(p_code) for update;
  if not found then
    raise exception 'ROOM_NOT_FOUND';
  end if;
  if v_room.phase <> 'lobby' then
    raise exception 'ROOM_ALREADY_STARTED';
  end if;

  v_ip := nullif(trim(split_part(
    coalesce(current_setting('request.headers', true)::json->>'x-forwarded-for', ''),
    ',', 1
  )), '');
  if v_ip is not null and exists (
    select 1 from public.join_rate_limits jrl
    where jrl.ip = v_ip and jrl.last_join_at > now() - interval '5 seconds'
  ) then
    raise exception 'TOO_MANY_JOINS';
  end if;

  if length(trim(p_nickname)) < 1 or length(p_nickname) > 30 then
    raise exception 'INVALID_NICKNAME';
  end if;
  -- The room row is locked above, so these checks can't race another join.
  if exists (select 1 from public.players pl where pl.room_id = v_room.id and lower(pl.nickname) = lower(trim(p_nickname))) then
    raise exception 'NICKNAME_TAKEN';
  end if;

  if p_new_team_name is not null and length(trim(p_new_team_name)) > 0 then
    if length(trim(p_new_team_name)) > 30 then
      raise exception 'INVALID_TEAM_NAME';
    end if;
    if exists (select 1 from public.teams t where t.room_id = v_room.id and lower(t.name) = lower(trim(p_new_team_name))) then
      raise exception 'TEAM_NAME_TAKEN';
    end if;
    insert into public.teams (room_id, name, kind) values (v_room.id, trim(p_new_team_name), 'self')
      returning id, name into v_team_id, v_team_name;

  elsif p_team_id is not null then
    select t.id, t.name, t.locked into v_team_id, v_team_name, v_locked
      from public.teams t where t.id = p_team_id and t.room_id = v_room.id for update;
    if v_team_id is null then
      raise exception 'TEAM_NOT_FOUND';
    end if;
    if v_locked then
      raise exception 'TEAM_LOCKED';
    end if;
    select count(*) into v_member_count from public.players pl
      where pl.team_id = v_team_id and pl.left_at is null;
    if v_member_count >= 4 then
      raise exception 'TEAM_FULL';
    end if;

  else
    select o_team_id, o_team_name into v_team_id, v_team_name from public.auto_bucket_team(v_room.id);
  end if;

  insert into public.players (room_id, nickname, team_id)
    values (v_room.id, trim(p_nickname), v_team_id)
    returning * into v_player;

  if v_ip is not null then
    insert into public.join_rate_limits (ip, last_join_at) values (v_ip, now())
      on conflict (ip) do update set last_join_at = excluded.last_join_at;
  end if;

  return query select v_player.id, v_player.client_token, v_player.room_id, v_team_id, v_team_name;
exception when unique_violation then
  raise exception 'NICKNAME_TAKEN';
end;
$function$;

-- ---------------------------------------------------------------------
-- Retired rooms stop running
-- ---------------------------------------------------------------------
create or replace function public.restart_trivia_now()
returns table(room_id uuid, code text)
language plpgsql security definer set search_path to 'public' as $function$
declare
  v_room_id uuid;
  v_code text;
begin
  update public.rooms set retired = true, phase = 'final', phase_started_at = now() where not retired;

  select cr.room_id, cr.code into v_room_id, v_code
    from public.create_room(now() + make_interval(secs => 120)) cr;

  return query select v_room_id, v_code;
end;
$function$;

-- Each game clock looped over "phase <> 'final' or not retired", which kept
-- driving a room that was retired mid-game. Only live rooms need a clock.
do $$
declare
  f text;
  v_def text;
begin
  foreach f in array array['tick', 'tick_feud', 'tick_bingo'] loop
    v_def := pg_get_functiondef(('public.' || f)::regproc);
    if position('where phase <> ''final'' or not retired' in v_def) = 0 then
      raise exception 'Expected room loop not found in %', f;
    end if;
    execute replace(v_def, 'where phase <> ''final'' or not retired', 'where not retired');
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Questions: fair alternative answers, duplicates retired and replaced
-- ---------------------------------------------------------------------
update public.questions q set accepted_answers = x.alts
from public.question_packs qp, (values
  ('Bar Night Classics', 12, array['CO2']),
  ('Bar Night Classics', 26, array['sodium chloride']),
  ('Decades Nostalgia', 1, array['NES']),
  ('Decades Nostalgia', 8, array['PS2']),
  ('Decades Nostalgia', 34, array['AOL Instant Messenger', 'AOL']),
  ('Food & Drink', 2, array['puff pastry', 'laminated dough']),
  ('Food & Drink', 10, array['garbanzo beans', 'garbanzos']),
  ('Food & Drink', 11, array['Britain', 'Great Britain', 'UK', 'United Kingdom']),
  ('Food & Drink', 16, array['miso paste', 'fermented soybean paste']),
  ('Food & Drink', 19, array['phyllo', 'phyllo dough', 'filo pastry']),
  ('Food & Drink', 20, array['whisky', 'bourbon', 'rye']),
  ('Food & Drink', 21, array['yoghurt']),
  ('Food & Drink', 26, array['USA', 'US', 'America', 'United States of America']),
  ('Food & Drink', 29, array['beef broth']),
  ('Food & Drink', 31, array['soy', 'soya beans', 'soya']),
  ('Food & Drink', 34, array['Swiss']),
  ('Food & Drink', 37, array['tabasco']),
  ('Franchise Specifics', 26, array['racing', 'car racing', 'drag racing']),
  ('Geography & History', 26, array['Civil War']),
  ('Geography & History', 29, array['Pharos', 'Pharos of Alexandria']),
  ('Geography & History', 33, array['Rome', 'Romans']),
  ('Music & Audio Rounds', 14, array['rap']),
  ('Music & Audio Rounds', 22, array['Grammys']),
  ('Music & Audio Rounds', 35, array['acapella', 'a capella']),
  ('Music & Audio Rounds', 38, array['bass', 'upright bass', 'contrabass']),
  ('Pop Culture & Entertainment', 7, array['Oscars']),
  ('Pop Culture & Entertainment', 23, array['Emmys']),
  ('Pop Culture & Entertainment', 24, array['Disney Plus']),
  ('Pop Culture & Entertainment', 26, array['RDJ', 'Robert Downey']),
  ('Pop Culture & Entertainment', 30, array['SNL']),
  ('Pop Culture & Entertainment', 32, array['Prime Video', 'Amazon Prime']),
  ('Sports', 8, array['Ali', 'Cassius Clay']),
  ('Sports', 11, array['every four years', 'quadrennially']),
  ('Sports', 37, array['chequered flag'])
) as x(pack_name, order_index, alts)
where qp.id = q.pack_id and qp.name = x.pack_name and q.order_index = x.order_index;

-- Near-duplicates: Sports asked 8 questions twice in different words, and a
-- few others repeated an answer from the same category.
update public.questions q set active = false
from public.question_packs qp, (values
  ('Sports', array[21, 22, 23, 24, 26, 28, 30, 31]),
  ('Geography & History', array[15]),
  ('Music & Audio Rounds', array[9, 33])
) as x(pack_name, order_indexes)
where qp.id = q.pack_id and qp.name = x.pack_name and q.order_index = any(x.order_indexes);

insert into public.questions (pack_id, order_index, prompt, choices, correct_index, time_limit_seconds, difficulty, accepted_answers)
select qp.id, x.order_index, x.prompt, x.choices::jsonb, x.correct_index, 45, x.difficulty, x.alts
from public.question_packs qp join (values
  ('Sports', 40, 'In which sport do teams compete for the Stanley Cup?', '["Basketball","Ice hockey","Baseball","American football"]', 1, 'easy', array['hockey', 'NHL']),
  ('Sports', 41, 'How many Grand Slam tournaments are played in professional tennis each year?', '["2","3","4","5"]', 2, 'hard', array[]::text[]),
  ('Sports', 42, 'Which country has won the most Summer Olympic gold medals of all time?', '["China","United States","Russia","Germany"]', 1, 'easy', array['USA', 'US', 'America']),
  ('Sports', 43, 'In golf, what is a score of three under par on a single hole called?', '["Eagle","Albatross","Birdie","Condor"]', 1, 'hard', array['double eagle']),
  ('Sports', 44, 'In which city is the Wimbledon tennis tournament played?', '["London","Paris","New York","Melbourne"]', 0, 'easy', array[]::text[]),
  ('Sports', 45, 'To the nearest mile, how long is a marathon?', '["13","26","30","42"]', 1, 'hard', array['26.2', '26 miles']),
  ('Sports', 46, 'Which NBA team did Michael Jordan win all six of his championships with?', '["Los Angeles Lakers","Chicago Bulls","Boston Celtics","Miami Heat"]', 1, 'easy', array[]::text[]),
  ('Sports', 47, 'In baseball, what do you call a home run hit with the bases loaded?', '["Grand slam","Walk-off","Triple play","Inside-the-park"]', 0, 'hard', array[]::text[]),
  ('Geography & History', 40, 'Which river flows through the middle of Paris?', '["Thames","Seine","Danube","Rhine"]', 1, 'easy', array[]::text[]),
  ('Music & Audio Rounds', 40, 'Which singer is known as the Queen of Soul?', '["Whitney Houston","Aretha Franklin","Diana Ross","Tina Turner"]', 1, 'easy', array['Aretha']),
  ('Music & Audio Rounds', 41, 'Which rapper released the 2015 album "To Pimp a Butterfly"?', '["Kanye West","Kendrick Lamar","Drake","J. Cole"]', 1, 'hard', array['Kendrick'])
) as x(pack_name, order_index, prompt, choices, correct_index, difficulty, alts) on qp.name = x.pack_name;

-- The game draw skips retired questions (otherwise identical to 0028).
create or replace function public.finalize_voting_and_start(p_room_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_room public.rooms;
  v_winner uuid;
  v_question_ids uuid[];
  v_questions_per_game constant int := 20;
  v_per_difficulty constant int := 10;
  v_small_team record;
  v_member record;
  v_new_team_id uuid;
  v_new_team_name text;
begin
  select * into v_room from public.rooms where id = p_room_id for update;
  if not found or v_room.phase <> 'lobby' then
    return;
  end if;

  for v_small_team in
    select t.id from public.teams t
    where t.room_id = p_room_id and t.kind = 'self' and not t.locked
      and (select count(*) from public.players pl where pl.team_id = t.id and pl.left_at is null) < 3
  loop
    for v_member in select pl.id from public.players pl where pl.team_id = v_small_team.id and pl.left_at is null loop
      select o_team_id, o_team_name into v_new_team_id, v_new_team_name from public.auto_bucket_team(p_room_id);
      update public.players set team_id = v_new_team_id where id = v_member.id;
    end loop;
    delete from public.teams where id = v_small_team.id;
  end loop;

  update public.teams set locked = true where room_id = p_room_id;

  select cv.choice_pack_id into v_winner
    from public.category_votes cv
    where cv.room_id = p_room_id and cv.choice_pack_id is not null
    group by cv.choice_pack_id
    order by count(*) desc, random()
    limit 1;

  if v_winner is null and v_room.category_options is not null then
    v_winner := v_room.category_options[1 + floor(random() * array_length(v_room.category_options, 1))::int];
  end if;

  with candidates as (
    select distinct on (lower(q.prompt)) q.id, q.difficulty, q.last_used_at
    from public.questions q
    where q.pack_id = v_winner and q.active
    order by lower(q.prompt), q.last_used_at nulls first, random()
  ), ranked as (
    select c.id, c.last_used_at,
           row_number() over (partition by c.difficulty order by c.last_used_at nulls first, random()) as rn
    from candidates c
  ), picked as (
    select r.id, 0 as pass, r.rn, r.last_used_at from ranked r where r.rn <= v_per_difficulty
    union all
    select r.id, 1, r.rn, r.last_used_at from ranked r where r.rn > v_per_difficulty
  ), limited as (
    select p.id from picked p
    order by p.pass, p.last_used_at nulls first, random()
    limit v_questions_per_game
  )
  select array_agg(l.id order by random()) into v_question_ids from limited l;

  update public.questions set last_used_at = now() where id = any(v_question_ids);

  insert into public.room_questions (room_id, order_index, question_id)
  select p_room_id, ord - 1, qid from unnest(v_question_ids) with ordinality as t(qid, ord);

  update public.rooms set
    winning_category_id = v_winner,
    phase = 'question',
    current_question_index = 0,
    question_started_at = now(),
    phase_started_at = now(),
    revealed_correct_index = null
  where id = p_room_id;
end;
$function$;

revoke execute on function public.finalize_voting_and_start(uuid) from anon, authenticated, public;
revoke execute on function public.finalize_question_scoring(uuid) from anon, authenticated, public;
revoke execute on function public.auto_bucket_team(uuid) from anon, authenticated, public;
