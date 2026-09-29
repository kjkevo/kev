-- One question per topic in a game: no two capital cities, no two planets,
-- no two chemistry formulas. Broad words that say little about the topic
-- ("largest", "song", "player") don't count as a topic.

create or replace function public.trivia_topic_words(p text)
returns text[]
language sql
immutable
as $$
  select coalesce(array_agg(distinct t), '{}') from unnest(public.trivia_topic_tokens(p)) t
  where length(t) >= 4 and t !~ '[0-9]' and not public.trivia_generic_token(t)
    and not t = any(array[
      'largest','smallest','longest','tallest','biggest','highest','fastest','greatest','earth','time','year',
      'popular','hit','song','album','artist','singer','actor','actress','character','role','star','title',
      'sport','player','release','released','launch','launched','played','play','playing','start','end',
      'made','make','used','use','type','kind','part','home','number','score','point','called','word',
      'american','british','english','french','italian','japanese','spanish','german','worldwide','based',
      'series','serie','famou','known','name','about','after','become','became','include','includes','shape','shaped',
      'ingredient','dish','base','origin','originate','originated','originating','area','field','match','colorful','social','platform'
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
  v_topics text[] := '{}';
  v_easy int := 0;
  v_hard int := 0;
  v_a text[];
  v_p text[];
  v_pairs text[];
  v_t text[];
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
  -- other way round (Berlin Wall, capital of Germany), or if it is about the
  -- same topic as a picked question (two capitals, two mountain ranges).
  -- Each later pass relaxes a rule so a small category still fills the game:
  -- pass 1 drops the easy/hard balance, pass 2 allows two per topic,
  -- pass 3 drops everything.
  for v_pass in 0..3 loop
    exit when coalesce(array_length(v_question_ids, 1), 0) >= v_questions_per_game;
    for c in
      select q.id, q.difficulty, q.prompt, q.choices->>q.correct_index answer
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
      v_t := public.trivia_topic_words(c.prompt);
      if v_pass < 3 and (
           v_a && v_answer_words
        or exists (select 1 from unnest(v_a) t where t !~ '^[0-9]+$' and t = any(v_prompt_words))
        or exists (select 1 from unnest(v_answer_words) t where t !~ '^[0-9]+$' and t = any(v_p))
        or v_pairs && v_topic_pairs
        or (v_pass < 2 and v_t && v_topics)
        or (v_pass = 2 and exists (select 1 from unnest(v_t) w where (select count(*) from unnest(v_topics) x where x = w) >= 2))
        or exists (select 1 from public.questions q2 where q2.id = any(v_question_ids) and lower(q2.prompt) = lower(c.prompt))
      ) then
        continue;
      end if;
      v_question_ids := v_question_ids || c.id;
      v_answer_words := v_answer_words || v_a;
      v_prompt_words := v_prompt_words || v_p;
      v_topic_pairs := v_topic_pairs || v_pairs;
      v_topics := v_topics || v_t;
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
