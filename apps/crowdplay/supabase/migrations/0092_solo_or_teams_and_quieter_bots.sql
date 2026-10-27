-- How a trivia game is grouped, decided by how many real people are playing:
--   fewer than 4: every player for themselves (a team of one each), and any
--     bots play alone too, up to 12 players in all;
--   4 or more: teams of up to 4 real people (balanced), at least 3 teams,
--     with whole bot teams of 4 filling any missing teams. More real people
--     means fewer bot teams, and none once there are 3 real teams.
-- Teams people made together (2+ friends on a named team) stay together in
-- team play. The lobby regroups as people come and go; bots are added when
-- the game starts.
-- Also: open-answer questions get 20 seconds like the rest, bots get the same
-- kind of names players get ("Sneaky Otter") and any of the characters, and
-- the canned shoutouts lose their emojis.

create or replace function public.trivia_question_seconds(p_order_index integer)
returns integer language sql immutable as $function$
  select 20;
$function$;

-- A name no one in the room has, made the same way the phones make names.
create or replace function public.trivia_bot_name(p_room_id uuid)
returns text language plpgsql volatile set search_path to 'public' as $function$
declare
  v_adj constant text[] := array['Tipsy','Sneaky','Dizzy','Loud','Clever','Sly','Feisty','Rowdy','Lucky','Salty','Spicy','Chill',
    'Wild','Cheeky','Bold','Fancy','Grumpy','Jolly','Mighty','Silky','Zesty','Groovy','Sassy','Snappy','Brave','Breezy','Bubbly',
    'Bouncy','Cosmic','Crafty','Cranky','Crispy','Dapper','Daring','Dusty','Fearless','Fizzy','Fluffy','Frosty','Funky','Fuzzy',
    'Giddy','Gentle','Glossy','Golden','Goofy','Hasty','Hungry','Icy','Jazzy','Jumpy','Keen','Lazy','Lively','Lofty','Mellow',
    'Merry','Misty','Moody','Nifty','Nimble','Noble','Peppy','Perky','Plucky','Quirky','Rapid','Rusty','Shiny','Sleepy','Smooth',
    'Sparky','Speedy','Sunny','Swift','Thirsty','Tiny','Wacky','Witty','Zippy'];
  v_noun constant text[] := array['Flamingo','Narwhal','Otter','Falcon','Panther','Koala','Walrus','Penguin','Raccoon','Badger',
    'Peacock','Yeti','Gremlin','Wizard','Pirate','Ninja','Llama','Platypus','Meerkat','Toucan','Hedgehog','Gecko','Alpaca','Beaver',
    'Bison','Bobcat','Buffalo','Camel','Cheetah','Cobra','Coyote','Crab','Dingo','Dolphin','Donkey','Eagle','Ferret','Fox','Gazelle',
    'Goose','Gopher','Gorilla','Hippo','Hornet','Husky','Iguana','Jackal','Jaguar','Kangaroo','Kiwi','Lemur','Lion','Lobster','Lynx',
    'Mammoth','Moose','Moth','Mustang','Octopus','Ostrich','Owl','Panda','Parrot','Pelican','Pigeon','Puffin','Python','Rhino',
    'Robot','Shark','Sloth','Squid','Tiger','Turtle','Viking','Vulture','Wombat','Zebra','Goblin','Unicorn'];
  v_name text;
begin
  for i in 1..50 loop
    v_name := v_adj[1 + floor(random() * array_length(v_adj, 1))::int] || ' ' || v_noun[1 + floor(random() * array_length(v_noun, 1))::int];
    exit when not exists (select 1 from public.players pl where pl.room_id = p_room_id and lower(pl.nickname) = lower(v_name));
  end loop;
  return v_name;
end;
$function$;

create or replace function public.trivia_add_bot(p_room_id uuid, p_team_id uuid)
returns void language sql volatile security definer set search_path to 'public' as $function$
  insert into public.players (room_id, nickname, team_id, avatar_id, is_bot)
  values (p_room_id, public.trivia_bot_name(p_room_id), p_team_id,
          (select a.id from public.avatars a where a.active order by random() limit 1), true);
$function$;

create or replace function public.trivia_lineup(p_room_id uuid, p_with_bots boolean)
returns void language plpgsql volatile security definer set search_path to 'public' as $function$
declare
  v_team_size constant int := 4;
  v_min_teams constant int := 3;
  v_solo_fill constant int := 12;
  v_room public.rooms;
  v_humans int;
  r record;
  v_new uuid;
  v_kept uuid[] := '{}';
  v_pool int;
  v_k int;
  v_chosen uuid[] := '{}';
  v_cap int[] := '{}';
  v_cnt int[] := '{}';
  i int;
  v_best int;
  v_human_teams int;
  v_bot_teams int;
  v_need int;
  v_have int;
begin
  select * into v_room from public.rooms where id = p_room_id for update;
  if not found or v_room.phase <> 'lobby' then
    return;
  end if;
  select count(*) into v_humans from public.players pl where pl.room_id = p_room_id and pl.left_at is null and not pl.is_bot;
  if v_humans = 0 then
    return;
  end if;

  if v_humans < 4 then
    -- Every player for themselves: anyone sharing a team with a bot or an
    -- earlier arrival gets a team of their own.
    for r in select pl.id, pl.team_id, pl.joined_at from public.players pl
             where pl.room_id = p_room_id and pl.left_at is null and not pl.is_bot order by pl.joined_at loop
      if r.team_id is null or exists (select 1 from public.players p2 where p2.team_id = r.team_id and p2.left_at is null
                                        and p2.id <> r.id and (p2.is_bot or p2.joined_at <= r.joined_at)) then
        insert into public.teams (room_id, name, kind) values (p_room_id, public.trivia_fun_team_name(p_room_id), 'auto')
          returning id into v_new;
        update public.players set team_id = v_new where id = r.id;
      end if;
    end loop;
    if p_with_bots then
      -- Bots play alone too: drop any bot that shares a team, then fill to 12.
      delete from public.players pl where pl.room_id = p_room_id and pl.is_bot
        and exists (select 1 from public.players p2 where p2.team_id = pl.team_id and p2.id <> pl.id and p2.left_at is null);
      v_need := greatest(0, v_solo_fill - v_humans);
      select count(*) into v_have from public.players pl where pl.room_id = p_room_id and pl.is_bot and pl.left_at is null;
      if v_have > v_need then
        delete from public.players where id in (
          select pl.id from public.players pl where pl.room_id = p_room_id and pl.is_bot and pl.left_at is null
          order by pl.joined_at desc limit v_have - v_need);
      end if;
      for i in 1 .. (v_need - least(v_have, v_need)) loop
        insert into public.teams (room_id, name, kind) values (p_room_id, public.trivia_fun_team_name(p_room_id), 'auto')
          returning id into v_new;
        perform public.trivia_add_bot(p_room_id, v_new);
      end loop;
    end if;

  else
    -- Teams. Friends who made a team together keep it.
    select coalesce(array_agg(t.id), '{}') into v_kept from public.teams t
      where t.room_id = p_room_id and t.kind = 'self'
        and (select count(*) from public.players pl where pl.team_id = t.id and pl.left_at is null and not pl.is_bot) between 2 and v_team_size;
    select count(*) into v_pool from public.players pl
      where pl.room_id = p_room_id and pl.left_at is null and not pl.is_bot and not coalesce(pl.team_id = any(v_kept), false);
    v_k := ceil(v_pool / v_team_size::numeric)::int;
    -- Reuse the teams already holding the most of these players (names stay put).
    select coalesce(array_agg(x.team_id order by x.n desc, x.created_at), '{}') into v_chosen from (
      select pl.team_id, count(*) n, min(t.created_at) created_at from public.players pl join public.teams t on t.id = pl.team_id
      where pl.room_id = p_room_id and pl.left_at is null and not pl.is_bot and not pl.team_id = any(v_kept)
      group by pl.team_id order by count(*) desc, min(t.created_at) limit v_k) x;
    while coalesce(array_length(v_chosen, 1), 0) < v_k loop
      insert into public.teams (room_id, name, kind) values (p_room_id, public.trivia_fun_team_name(p_room_id), 'auto')
        returning id into v_new;
      v_chosen := v_chosen || v_new;
    end loop;
    for i in 1 .. v_k loop
      v_cap := v_cap || (v_pool / v_k + case when i <= v_pool % v_k then 1 else 0 end);
      v_cnt := v_cnt || 0;
    end loop;
    -- First everyone who can stay where they are, then the rest wherever there is room.
    for r in select pl.id, pl.team_id from public.players pl
             where pl.room_id = p_room_id and pl.left_at is null and not pl.is_bot and not coalesce(pl.team_id = any(v_kept), false)
             order by pl.joined_at loop
      i := array_position(v_chosen, r.team_id);
      if i is not null and v_cnt[i] < v_cap[i] then
        v_cnt[i] := v_cnt[i] + 1;
      else
        update public.players set team_id = null where id = r.id;
      end if;
    end loop;
    for r in select pl.id from public.players pl
             where pl.room_id = p_room_id and pl.left_at is null and not pl.is_bot and pl.team_id is null
             order by pl.joined_at loop
      v_best := 1;
      for i in 1 .. v_k loop
        if v_cap[i] - v_cnt[i] > v_cap[v_best] - v_cnt[v_best] then
          v_best := i;
        end if;
      end loop;
      update public.players set team_id = v_chosen[v_best] where id = r.id;
      v_cnt[v_best] := v_cnt[v_best] + 1;
    end loop;
    -- Bots never share a team with real people.
    delete from public.players pl where pl.room_id = p_room_id and pl.is_bot
      and exists (select 1 from public.players p2 where p2.team_id = pl.team_id and not p2.is_bot and p2.left_at is null);

    v_human_teams := coalesce(array_length(v_kept, 1), 0) + v_k;
    if p_with_bots then
      v_bot_teams := greatest(0, v_min_teams - v_human_teams);
      -- Lone bots (left from solo play) go; then keep the needed bot teams at 4 each.
      delete from public.players pl where pl.room_id = p_room_id and pl.is_bot
        and not exists (select 1 from public.players p2 where p2.team_id = pl.team_id and p2.id <> pl.id and p2.left_at is null);
      i := 0;
      for r in select t.id, (select count(*) from public.players pl where pl.team_id = t.id and pl.left_at is null) n
               from public.teams t where t.room_id = p_room_id
                 and exists (select 1 from public.players pl where pl.team_id = t.id and pl.is_bot and pl.left_at is null)
               order by t.created_at loop
        i := i + 1;
        if i > v_bot_teams then
          delete from public.players where team_id = r.id and is_bot;
        elsif r.n > v_team_size then
          delete from public.players where id in (
            select pl.id from public.players pl where pl.team_id = r.id and pl.is_bot order by pl.joined_at desc limit r.n - v_team_size);
        else
          for v_need in 1 .. (v_team_size - r.n) loop
            perform public.trivia_add_bot(p_room_id, r.id);
          end loop;
        end if;
      end loop;
      while i < v_bot_teams loop
        i := i + 1;
        insert into public.teams (room_id, name, kind) values (p_room_id, public.trivia_fun_team_name(p_room_id), 'auto')
          returning id into v_new;
        for v_need in 1 .. v_team_size loop
          perform public.trivia_add_bot(p_room_id, v_new);
        end loop;
      end loop;
    end if;
  end if;

  delete from public.teams t where t.room_id = p_room_id
    and not exists (select 1 from public.players pl where pl.team_id = t.id);
end;
$function$;
revoke execute on function public.trivia_lineup(uuid, boolean) from public, anon, authenticated;
revoke execute on function public.trivia_add_bot(uuid, uuid) from public, anon, authenticated;

-- The 8-team cap is for real teams; bots (12 solo bots in a test lobby)
-- never stop real people from making a team.
create or replace function public.trivia_live_team_count(p_room_id uuid)
returns integer language sql stable security definer set search_path to 'public' as $function$
  select count(*)::int from public.teams t
  where t.room_id = p_room_id
    and exists (select 1 from public.players pl where pl.team_id = t.id and pl.left_at is null and not pl.is_bot);
$function$;

-- The old bot fillers now just line the room up (with bots).
create or replace function public.trivia_bot_fill(p_room_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $function$
begin
  perform public.trivia_lineup(p_room_id, true);
end;
$function$;

create or replace function public.trivia_bot_topup(p_room_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $function$
begin
  if public.feature_on('trivia_bot_topup') then
    perform public.trivia_lineup(p_room_id, true);
  end if;
end;
$function$;

do $patch$
declare d text; n text;
begin
  -- The game starts with the lineup (bots added), replacing the old top-up
  -- and "nobody plays alone" steps.
  d := pg_get_functiondef('public.finalize_voting_and_start(uuid)'::regprocedure);
  n := regexp_replace(d, '  -- Short of 12 players: bots join.*?(  update public\.teams set locked = true)',
    E'  -- Solo or teams, bots filling the gaps (see trivia_lineup).\n  perform public.trivia_lineup(p_room_id, public.feature_on(''trivia_bot_topup''));\n\n\\1');
  if n = d then raise exception 'start patch did not apply'; end if;
  execute n;

  -- The lobby regroups every second as people come and go (no bots yet).
  d := pg_get_functiondef('public.tick()'::regprocedure);
  n := replace(d, $a$  for v_room in select * from public.rooms where not retired and not queued loop
$a$, $a$  for v_room in select * from public.rooms where not retired and not queued loop
    if v_room.phase = 'lobby' then
      perform public.trivia_lineup(v_room.id, false);
    end if;
$a$);
  if n = d then raise exception 'tick patch did not apply'; end if;
  execute n;
end $patch$;

update public.room_questions rq set seconds = 20
  from public.rooms r where r.id = rq.room_id and not r.retired and rq.seconds = 35;

update public.shoutout_presets
  set text = btrim(regexp_replace(text, '[\U0001F000-\U0001FAFF☀-➿️‍]', '', 'g'))
  where text ~ '[\U0001F000-\U0001FAFF☀-➿]';
