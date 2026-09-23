-- Every trivia game now mixes easy and hard questions: 10 of each from the
-- winning category, shuffled together, instead of 20 picked with no regard
-- for difficulty. Also stops the same question showing up twice in one game
-- (Sports has several prompts duplicated word for word).
--
-- Difficulty is a hand rating of every existing question: "hard" is
-- anything a typical bar crowd would need to really know (Canberra, NaCl,
-- Arendelle, Uruguay 1930), everything else is "easy". Each category has at
-- least 14 hard questions, so the 10/10 split always fills. New questions
-- default to easy; if a category ever runs short on either, the game tops
-- up from the other so it still gets its full 20.

alter table public.questions add column difficulty text not null default 'easy'
  check (difficulty in ('easy', 'hard'));

update public.questions q set difficulty = 'hard'
from public.question_packs qp, (values
  ('Bar Night Classics',          array[2,4,16,17,18,19,24,26,28,33,34,35,36,39]),
  ('Decades Nostalgia',           array[1,8,11,15,17,18,19,24,26,27,28,31,34,35,36]),
  ('Food & Drink',                array[2,4,11,12,13,15,16,17,19,23,24,25,29,31,33,37,38]),
  ('Franchise Specifics',         array[1,9,11,12,15,16,17,22,28,32,33,35,37,39]),
  ('Geography & History',         array[2,6,10,15,24,25,29,30,31,32,35,36,38,39]),
  ('Music & Audio Rounds',        array[6,7,8,11,14,15,17,20,21,27,32,34,35,37,38]),
  ('Pop Culture & Entertainment', array[3,6,8,10,12,14,15,24,25,29,31,32,35,39]),
  ('Sports',                      array[1,4,6,10,14,19,21,23,27,29,30,31,34,35,36])
) as hard(pack_name, order_indexes)
where qp.id = q.pack_id and qp.name = hard.pack_name and q.order_index = any(hard.order_indexes);

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

  -- One row per distinct prompt (freshest-first), ranked within its
  -- difficulty; take the top 10 of each, then top up from whatever's left
  -- if either difficulty came up short.
  with candidates as (
    select distinct on (lower(q.prompt)) q.id, q.difficulty, q.last_used_at
    from public.questions q
    where q.pack_id = v_winner
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
