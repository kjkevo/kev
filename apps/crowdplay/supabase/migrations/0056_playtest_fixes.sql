-- Fixes from the September playtest:
-- 1. Generic words ("mountains", "city", "jr", "video") no longer earn credit alone.
-- 2. Ambiguous or wrong questions reworded.
-- 3. Auto teams get fun names instead of "Team 1", and carried-over teams never become "Team 1 2".
-- 4. A game never repeats an answer (three Netflix questions) or a topic (two mountain ranges).
-- 5. The category vote offers 4 random categories, not all 8.

-- 1. Generic words ---------------------------------------------------------

-- Words that are part of many answers, so typing one alone isn't knowing
-- the answer. Tokens are already singular (trivia_tokens drops a final s).
create or replace function public.trivia_generic_token(t text)
returns boolean
language sql
immutable
as $$
  select t = any(array[
    'mountain','mount','mt','range','river','lake','city','town','island','isle','ocean','sea','bay','gulf',
    'desert','valley','canyon','fall','park','street','road','central','north','south','east','west',
    'new','great','united','state','kingdom','republic','empire','war','age','world','first','order',
    'jr','sr','ii','iii','dr','mr','mrs','sir','saint','st','king','queen','prince','princess','lord',
    'video','show','movie','film','series','band','group','team','club','award','cup','open','game',
    'stone','man','woman','boy','girl','child','big','little','old','day','night','music','rock','pop',
    'country','company','industry','co','inc','de','la','le','el','da','van','von',
    'sauce','soup','bean','paste','dough','stock','broth','pepper','salad','cheese','juice',
    'whale','shark','fish','flag','vitamin','white','black','red','blue','green','yellow'
  ]);
$$;

-- Same rules as before; the only change is in the last step: a guess made
-- of some of the answer's words must include at least one telling word
-- ("Downey", "Vatican"), not just a generic one ("jr", "city").
create or replace function public.trivia_text_matches(p_guess text, p_target text, p_others text[])
returns boolean
language plpgsql
immutable
as $$
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

  v_gs := array_to_string(g, '');
  v_as := array_to_string(a, '');
  if v_gs = v_as then
    return true;
  end if;
  if exists (select 1 from unnest(coalesce(p_others, '{}')) oo where array_to_string(public.trivia_tokens(oo), '') = v_gs) then
    return false;
  end if;
  if exists (select 1 from unnest(g) gg where gg = any(w) and not gg = any(a)) then
    return false;
  end if;

  if v_as !~ '[0-9]' and public.trivia_tok_match(v_gs, v_as) then
    v_dist := levenshtein(v_gs, v_as);
    if not exists (
      select 1 from unnest(coalesce(p_others, '{}')) oo
      where levenshtein(v_gs, array_to_string(public.trivia_tokens(oo), '')) <= v_dist
    ) then
      return true;
    end if;
  end if;

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

  v_all := true;
  foreach x in array g loop
    v_hit := false;
    foreach y in array a loop
      if public.trivia_tok_match(x, y) then
        v_hit := true;
        if not public.trivia_generic_token(y)
           and not exists (select 1 from unnest(w) zz where public.trivia_tok_match(y, zz) or public.trivia_tok_match(x, zz)) then
          v_distinct := true;
        end if;
      end if;
    end loop;
    if not v_hit then v_all := false; exit; end if;
  end loop;
  return v_all and v_distinct;
end;
$$;

-- 2. Questions --------------------------------------------------------------

create or replace function pg_temp.fix_q(p_old_prompt text, p_prompt text, p_answer text, p_accepted text[])
returns void
language plpgsql
as $$
declare
  v_id uuid;
  v_idx int;
begin
  select id, correct_index into v_id, v_idx from public.questions where prompt = p_old_prompt;
  if v_id is null then
    raise exception 'question not found: %', p_old_prompt;
  end if;
  update public.questions set
    prompt = coalesce(p_prompt, prompt),
    choices = case when p_answer is null then choices else jsonb_set(choices, array[v_idx::text], to_jsonb(p_answer)) end,
    accepted_answers = coalesce(p_accepted, accepted_answers)
  where id = v_id;
end;
$$;

-- Two right answers (House of the Dragon is also HBO and GRRM).
select pg_temp.fix_q('Which HBO fantasy series was based on novels by George R. R. Martin?',
  'Which HBO fantasy series, launched in 2011, followed the fight for the Iron Throne?', null, null);
-- "NOT a whiskey" has endless right answers when typed.
select pg_temp.fix_q('Which of these is NOT a type of whiskey?',
  'Which red wine grape shares its name with the French word for a young blackbird?', 'Merlot', null);
-- Also Russia, Kazakhstan, Georgia and Azerbaijan.
select pg_temp.fix_q('Which country straddles both Europe and Asia, with land on two continents?',
  'Istanbul, a city split between Europe and Asia, is in which country?', 'Turkey', array['Turkiye']);
-- Caesar ruled the Roman Republic, not the Empire.
select pg_temp.fix_q('Which empire was ruled by Julius Caesar?',
  'Julius Caesar was a leader of which ancient civilization?', 'Ancient Rome',
  array['Rome','Romans','Roman','Roman Empire','Roman Republic']);
-- Nobody is the genie's master at the start.
select pg_temp.fix_q('In Disney''s "Aladdin," who is the master of the magic lamp''s genie at the start of the story?',
  'In Disney''s "Aladdin," what is the name of the Sultan''s scheming royal vizier?', 'Jafar', null);
-- Giza is next to Cairo, which is also an answer elsewhere.
select pg_temp.fix_q('The Great Pyramid, one of the ancient wonders of the world, is located in which city?',
  'The Great Pyramid stands on which plateau just outside Cairo?', 'Giza', null);
-- The answer was in the question.
select pg_temp.fix_q('Which wall divided Berlin from 1961 to 1989?',
  'Which city was split in two by a wall from 1961 to 1989?', 'Berlin', null);
select pg_temp.fix_q('How many holes make up the front nine of a standard golf course?',
  'In golf, what is a score of two under par on a single hole called?', 'Eagle', null);
select pg_temp.fix_q('Which awards show, nicknamed "the Emmys," honors achievement in television?',
  'Which TV awards hand out a golden statuette of a winged woman holding an atom?', null, null);
select pg_temp.fix_q('Which awards show is nicknamed "the Oscars"?',
  'Which film awards hand out a gold statuette of a knight holding a sword?', null, null);
-- Mark Ronson is the lead artist on "Uptown Funk".
select pg_temp.fix_q('Which artist is most associated with the hit song Uptown Funk?',
  'Who sang lead vocals on Mark Ronson''s hit "Uptown Funk"?', null, null);
-- Spotify didn't coin "curated playlist".
select pg_temp.fix_q('Which music streaming service popularized the term "curated playlist" in the 2010s?',
  'Which Swedish music streaming service sends fans a "Wrapped" recap every December?', null, null);
-- Allison Williams also starred in "Get Out".
select pg_temp.fix_q('Which actor starred in Jordan Peele''s directorial debut, "Get Out" (2017)?',
  'Which actor played Chris, the lead in Jordan Peele''s "Get Out" (2017)?', null, null);
-- China was bigger until 2023.
select pg_temp.fix_q('As of the 2020s, which country has the largest population in the world?',
  'Since 2023, which country has had the largest population in the world?', null, null);
-- The 1960s had a girl-group explosion too.
select pg_temp.fix_q('Which decade popularized the boy band and girl group pop explosion?',
  'The Spice Girls, *NSYNC and the Backstreet Boys all broke through in which decade?', null, null);
-- "Best-selling toy of the 1990s" isn't true.
select pg_temp.fix_q('What was the best-selling toy of the 1990s that hatched from a virtual egg?',
  'Which 1990s handheld digital pet hatched from a virtual egg?', null, null);
-- Sushi's roots are in Southeast Asia and China.
select pg_temp.fix_q('Sushi originated in which country?',
  'Sushi is most famously associated with which country''s cuisine?', null, null);
-- A White or Black Russian is also vodka and coffee liqueur.
select pg_temp.fix_q('Which cocktail combines vodka and coffee liqueur, often served with a shot of espresso?',
  'Which cocktail shakes vodka and coffee liqueur with a fresh shot of espresso?', null, null);
-- More right answers people will type.
select pg_temp.fix_q('Which 2000s social platform limited posts to 140 characters?', null, null, array['X']);
select pg_temp.fix_q('Which reggaeton artist popularized the global hit "Despacito"?', null, null, array['Daddy Yankee']);
select pg_temp.fix_q('Which search engine was a dominant player in the 1990s before Google took over?', null, null, array['AltaVista']);
select pg_temp.fix_q('Which country is the origin of the spicy fermented dish kimchi?', null, null, array['Korea']);
select pg_temp.fix_q('What is the smallest continent by land area?', null, null, array['Oceania']);
select pg_temp.fix_q('How often are the Summer Olympic Games held?', null, null, array['every four years','quadrennially','4 years','4']);
select pg_temp.fix_q('In "Toy Story," what type of toy is Buzz Lightyear?', null, null, array['action figure','space ranger']);
select pg_temp.fix_q('What is the main ingredient in traditional Japanese miso soup?', null, null, array['miso','miso paste','fermented soybean paste']);
select pg_temp.fix_q('What is the primary ingredient in traditional Indian naan bread?', null, null, array['flour']);
select pg_temp.fix_q('A traditional croissant is made from what type of dough?', null, null, array['puff pastry','laminated dough','laminated']);
select pg_temp.fix_q('Which explorer''s expedition was the first to circumnavigate the globe?', null, null, array['Magellan','Elcano']);

-- 3. Fun team names ---------------------------------------------------------

create or replace function public.trivia_fun_team_name(p_room_id uuid)
returns text
language plpgsql
volatile
set search_path to 'public'
as $$
declare
  v_names constant text[] := array[
    'Quizzly Bears','Trivia Newton John','Les Quizerables','Smarty Pints','The Brainy Bunch',
    'Agatha Quiztie','Quiz Khalifa','Pub Crawlers','The Know-It-Ales','Hoppy Thoughts',
    'Tequila Mockingbirds','Beer Necessities','Wine Not','The Mighty Quizzers','Nerds on Tap',
    'Ctrl Alt Defeat','The Guessing Gremlins','Lucky Guessers','The Wild Cards','Pint Sized Geniuses',
    'Cereal Killers','Spice Squad','Taco Bout Trivia','The Mindflayers','Fact Hunters',
    'The Alien Invaders','Galaxy Brains','Space Cadets','Jungle Scouts','Crystal Crew'
  ];
  v_name text;
begin
  select n into v_name from unnest(v_names) n
    where not exists (select 1 from public.teams t where t.room_id = p_room_id and lower(t.name) = lower(n))
    order by random() limit 1;
  if v_name is null then
    v_name := 'Team ' || (select count(*) + 1 from public.teams t where t.room_id = p_room_id);
  end if;
  return v_name;
end;
$$;

create or replace function public.auto_bucket_team(p_room_id uuid)
returns table(o_team_id uuid, o_team_name text)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_max_team_size constant int := 5;
  v_max_teams constant int := 8;
  v_found_id uuid;
  v_found_name text;
  v_new_id uuid;
  v_new_name text;
begin
  -- 1. Someone on an auto team by themselves: keep them company.
  -- 2. Every auto team has 3+ (or there are none) and there's room: start a new one.
  -- 3. Otherwise a random auto team with space, then a random custom team with space.
  select t.id, t.name into v_found_id, v_found_name
    from public.teams t
    where t.room_id = p_room_id and t.kind = 'auto' and not t.locked
      and (select count(*) from public.players pl where pl.team_id = t.id and pl.left_at is null) = 1
    order by random() limit 1
    for update of t;
  if v_found_id is not null then
    return query select v_found_id, v_found_name;
    return;
  end if;

  if public.trivia_live_team_count(p_room_id) < v_max_teams and not exists (
    select 1 from public.teams t
    where t.room_id = p_room_id and t.kind = 'auto' and not t.locked
      and (select count(*) from public.players pl where pl.team_id = t.id and pl.left_at is null) between 1 and 2
  ) then
    v_new_name := public.trivia_fun_team_name(p_room_id);
    insert into public.teams (room_id, name, kind) values (p_room_id, v_new_name, 'auto')
      returning id into v_new_id;
    return query select v_new_id, v_new_name;
    return;
  end if;

  select t.id, t.name into v_found_id, v_found_name
    from public.teams t
    where t.room_id = p_room_id and not t.locked
      and (select count(*) from public.players pl where pl.team_id = t.id and pl.left_at is null) between 1 and v_max_team_size - 1
    order by (t.kind = 'auto') desc,
      (select count(*) from public.players pl where pl.team_id = t.id and pl.left_at is null), random()
    limit 1
    for update of t;
  if v_found_id is not null then
    return query select v_found_id, v_found_name;
    return;
  end if;

  raise exception 'ROOM_FULL';
end;
$$;

-- Old auto teams named "Team 3" get a fun name when carried to the next game.
-- If the name is already taken there, pick a fun one instead of "Team 1 2".
create or replace function public.rejoin_next_game(p_room_id uuid, p_player_id uuid, p_client_token uuid)
returns table(o_player_id uuid, o_client_token uuid, o_room_id uuid, o_code text, o_team_id uuid, o_team_name text)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_max_team_size constant int := 5;
  v_max_teams constant int := 8;
  v_old public.players;
  v_old_team public.teams;
  v_old_room public.rooms;
  v_target public.rooms;
  v_team public.teams;
  v_name text;
  v_player public.players;
begin
  select * into v_old from public.players where id = p_player_id and room_id = p_room_id and client_token = p_client_token;
  if not found then
    raise exception 'NOT_AUTHORIZED';
  end if;
  select * into v_old_room from public.rooms where id = p_room_id;
  select * into v_old_team from public.teams where id = v_old.team_id;

  select r.* into v_target from public.rooms r
    where r.venue_id = v_old_room.venue_id and not r.retired and r.phase = 'lobby' and r.id <> p_room_id
      and not public.trivia_room_full(r.id)
    order by r.queued, r.queued_at nulls first, r.created_at
    limit 1
    for update;
  if v_target.id is null then
    raise exception 'NO_NEXT_GAME';
  end if;

  select pl.* into v_player from public.players pl
    where pl.room_id = v_target.id and pl.left_at is null
      and ((v_old.device_key is not null and pl.device_key = v_old.device_key) or lower(pl.nickname) = lower(v_old.nickname))
    limit 1;
  if v_player.id is not null then
    return query select v_player.id, v_player.client_token, v_target.id, v_target.code, v_player.team_id,
      (select name from public.teams where id = v_player.team_id);
    return;
  end if;

  if v_old_team.id is not null then
    select t.* into v_team from public.teams t
      where t.room_id = v_target.id and t.carried_from = v_old_team.id
      for update;
  end if;
  if v_team.id is not null then
    if v_team.locked then
      raise exception 'TEAM_LOCKED';
    end if;
    if (select count(*) from public.players pl where pl.team_id = v_team.id and pl.left_at is null) >= v_max_team_size then
      raise exception 'TEAM_FULL';
    end if;
  else
    if public.trivia_live_team_count(v_target.id) >= v_max_teams then
      raise exception 'TOO_MANY_TEAMS';
    end if;
    v_name := v_old_team.name;
    if v_name is null or v_name ~ '^Team [0-9]+$'
       or exists (select 1 from public.teams t where t.room_id = v_target.id and lower(t.name) = lower(v_name)) then
      v_name := public.trivia_fun_team_name(v_target.id);
    end if;
    insert into public.teams (room_id, name, kind, carried_from)
      values (v_target.id, v_name, 'self', v_old_team.id)
      returning * into v_team;
  end if;

  if exists (select 1 from public.players pl where pl.room_id = v_target.id and lower(pl.nickname) = lower(v_old.nickname)) then
    raise exception 'NICKNAME_TAKEN';
  end if;
  insert into public.players (room_id, nickname, team_id, avatar_id, device_key)
    values (v_target.id, v_old.nickname, v_team.id, coalesce(v_old.avatar_id, 'jungle-scout'), v_old.device_key)
    returning * into v_player;

  return query select v_player.id, v_player.client_token, v_target.id, v_target.code, v_team.id, v_team.name;
end;
$$;

-- 4. No repeated answers or topics in one game ------------------------------

-- Words that say what a question is about: its tokens minus question words.
create or replace function public.trivia_topic_tokens(p text)
returns text[]
language sql
immutable
as $$
  select coalesce(array_agg(t), '{}') from unnest(public.trivia_tokens(p)) t
  where t !~ '^[0-9]+$' and not t = any(array[
    'which','what','who','whom','whose','where','when','why','how','many','much','was','were','are','be','been',
    'did','does','do','has','have','had','this','that','these','those','with','by','from','as','into','than',
    'known','name','named','called','call','typically','traditional','traditionally','standard','main',
    'famous','famously','most','best','classic','primary','original','originally','commonly','generally',
    'considered','credited','associated','featured','feature','featuring','his','her','their','your','you',
    'one','single','per','each','every','during','after','before','also','often','nicknamed'
  ]);
$$;

create or replace function public.finalize_voting_and_start(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_max_team_size constant int := 5;
  v_room public.rooms;
  v_winner uuid;
  v_question_ids uuid[] := '{}';
  v_questions_per_game constant int := 20;
  v_per_difficulty constant int := 10;
  v_alone record;
  v_target uuid;
  v_pass int;
  c record;
  v_answer_words text[] := '{}';
  v_prompt_words text[] := '{}';
  v_topic_pairs text[] := '{}';
  v_easy int := 0;
  v_hard int := 0;
  v_a text[];
  v_p text[];
  v_pairs text[];
begin
  select * into v_room from public.rooms where id = p_room_id for update;
  if not found or v_room.phase <> 'lobby' then
    return;
  end if;

  -- Nobody plays alone if another team has room: move anyone still on a
  -- team by themselves onto a random team with space.
  for v_alone in
    select pl.id player_id, pl.team_id from public.players pl
    where pl.room_id = p_room_id and pl.left_at is null and pl.team_id is not null
      and (select count(*) from public.players p2 where p2.team_id = pl.team_id and p2.left_at is null) = 1
    order by pl.joined_at
  loop
    -- Someone earlier in this loop may have joined them already.
    continue when (select count(*) from public.players p2 where p2.team_id = v_alone.team_id and p2.left_at is null) <> 1;
    select t.id into v_target from public.teams t
      where t.room_id = p_room_id and t.id <> v_alone.team_id
        and (select count(*) from public.players p2 where p2.team_id = t.id and p2.left_at is null) between 1 and v_max_team_size - 1
      order by random() limit 1;
    if v_target is not null then
      update public.players set team_id = v_target where id = v_alone.player_id;
    end if;
  end loop;
  delete from public.teams t where t.room_id = p_room_id
    and not exists (select 1 from public.players pl where pl.team_id = t.id);

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

  -- Least recently used first, half easy and half hard. A question is
  -- skipped if its answer shares a word with an answer already picked
  -- (Netflix, Netflix), if its answer is named in a picked question or the
  -- other way round (Berlin Wall, capital of Germany), or if it asks about
  -- the same thing as a picked question (two "mountain range" questions).
  -- Pass 0 keeps the easy/hard balance, pass 1 drops it, pass 2 drops the
  -- repeat rules too, so a small category still fills the game.
  for v_pass in 0..2 loop
    exit when coalesce(array_length(v_question_ids, 1), 0) >= v_questions_per_game;
    for c in
      select q.id, q.difficulty, q.prompt, q.choices->>q.correct_index answer, q.accepted_answers
      from public.questions q
      where q.pack_id = v_winner and q.active and not q.id = any(v_question_ids)
      order by q.last_used_at nulls first, random()
    loop
      exit when coalesce(array_length(v_question_ids, 1), 0) >= v_questions_per_game;
      continue when v_pass = 0 and ((c.difficulty = 'hard' and v_hard >= v_per_difficulty)
                                    or (c.difficulty <> 'hard' and v_easy >= v_per_difficulty));
      select coalesce(array_agg(distinct t), '{}') into v_a
        from unnest(public.trivia_tokens(c.answer)) t where not public.trivia_generic_token(t);
      v_p := public.trivia_topic_tokens(c.prompt);
      select coalesce(array_agg(v_p[i] || ' ' || v_p[i + 1]), '{}') into v_pairs
        from generate_series(1, coalesce(array_length(v_p, 1), 0) - 1) i;
      if v_pass < 2 and (
           v_a && v_answer_words
        or exists (select 1 from unnest(v_a) t where t !~ '^[0-9]+$' and t = any(v_prompt_words))
        or exists (select 1 from unnest(v_answer_words) t where t !~ '^[0-9]+$' and t = any(v_p))
        or v_pairs && v_topic_pairs
        or exists (select 1 from public.questions q2 where q2.id = any(v_question_ids) and lower(q2.prompt) = lower(c.prompt))
      ) then
        continue;
      end if;
      v_question_ids := v_question_ids || c.id;
      v_answer_words := v_answer_words || v_a;
      v_prompt_words := v_prompt_words || v_p;
      v_topic_pairs := v_topic_pairs || v_pairs;
      if c.difficulty = 'hard' then v_hard := v_hard + 1; else v_easy := v_easy + 1; end if;
    end loop;
  end loop;

  select array_agg(x order by random()) into v_question_ids from unnest(v_question_ids) x;

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
$$;

-- 5. Four categories in the vote --------------------------------------------

create or replace function public.create_room(p_starts_at timestamp with time zone default null, p_venue_id uuid default null)
returns table(room_id uuid, code text, host_secret uuid)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_code text;
  v_room public.rooms;
  v_secret uuid;
  v_category_options uuid[];
begin
  select (array_agg(id order by random()))[1:4] into v_category_options from public.question_packs;

  loop
    v_code := upper(substr(md5(random()::text), 1, 5));
    begin
      insert into public.rooms (code, starts_at, category_option_a, category_option_b, category_options, venue_id)
        values (v_code, p_starts_at, v_category_options[1], v_category_options[2], v_category_options,
                coalesce(p_venue_id, public.default_venue_id()))
        returning * into v_room;
      exit;
    exception when unique_violation then
    end;
  end loop;

  insert into public.room_hosts (room_id) values (v_room.id)
    returning room_hosts.host_secret into v_secret;

  return query select v_room.id, v_room.code, v_secret;
end;
$$;

-- Lobbies already open: keep the categories someone voted for, fill to 4.
update public.rooms r set category_options = (
  select (array_agg(o order by (o in (select cv.choice_pack_id from public.category_votes cv where cv.room_id = r.id)) desc, ord))[1:4]
  from unnest(r.category_options) with ordinality u(o, ord)
)
where r.phase = 'lobby' and array_length(r.category_options, 1) > 4;

-- Auto teams still sitting in open lobbies get a fun name.
update public.teams t set name = public.trivia_fun_team_name(t.room_id)
from public.rooms r
where r.id = t.room_id and r.phase = 'lobby' and t.kind = 'auto' and t.name ~ '^Team [0-9]+$';
