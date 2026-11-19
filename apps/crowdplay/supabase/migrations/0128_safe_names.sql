-- Safe names only. Anything a player or team is called can end up on a bar's
-- TV, so nobody types a name any more:
--   * A player's name must be one of our made-up "Adjective Noun" names
--     (the same 80 x 80 words as src/lib/funNames.ts).
--   * A team's name must be "Team " + one of those names, or one of our
--     built-in team names (Bingo's and Trivia's lists, or "Team 3").
--   * Every table that holds a name checks it on the way in. A name that
--     isn't ours is swapped for a fresh made-up one (no error, so an old
--     phone keeps working). claim_season_username refuses it outright.
--   * Shout-outs (typed messages for the TV) are removed: functions and tables.

create or replace function public.fun_adjectives() returns text[] language sql immutable as $$
  select array['Tipsy','Sneaky','Dizzy','Loud','Clever','Sly','Feisty','Rowdy','Lucky','Salty','Spicy','Chill',
    'Wild','Cheeky','Bold','Fancy','Grumpy','Jolly','Mighty','Silky','Zesty','Groovy','Sassy','Snappy','Brave','Breezy','Bubbly',
    'Bouncy','Cosmic','Crafty','Cranky','Crispy','Dapper','Daring','Dusty','Fearless','Fizzy','Fluffy','Frosty','Funky','Fuzzy',
    'Giddy','Gentle','Glossy','Golden','Goofy','Hasty','Hungry','Icy','Jazzy','Jumpy','Keen','Lazy','Lively','Lofty','Mellow',
    'Merry','Misty','Moody','Nifty','Nimble','Noble','Peppy','Perky','Plucky','Quirky','Rapid','Rusty','Shiny','Sleepy','Smooth',
    'Sparky','Speedy','Sunny','Swift','Thirsty','Tiny','Wacky','Witty','Zippy']
$$;

create or replace function public.fun_nouns() returns text[] language sql immutable as $$
  select array['Flamingo','Narwhal','Otter','Falcon','Panther','Koala','Walrus','Penguin','Raccoon','Badger',
    'Peacock','Yeti','Gremlin','Wizard','Pirate','Ninja','Llama','Platypus','Meerkat','Toucan','Hedgehog','Gecko','Alpaca','Beaver',
    'Bison','Bobcat','Buffalo','Camel','Cheetah','Cobra','Coyote','Crab','Dingo','Dolphin','Donkey','Eagle','Ferret','Fox','Gazelle',
    'Goose','Gopher','Gorilla','Hippo','Hornet','Husky','Iguana','Jackal','Jaguar','Kangaroo','Kiwi','Lemur','Lion','Lobster','Lynx',
    'Mammoth','Moose','Moth','Mustang','Octopus','Ostrich','Owl','Panda','Parrot','Pelican','Pigeon','Puffin','Python','Rhino',
    'Robot','Shark','Sloth','Squid','Tiger','Turtle','Viking','Vulture','Wombat','Zebra','Goblin','Unicorn']
$$;

create or replace function public.fun_name() returns text language sql volatile as $$
  select (public.fun_adjectives())[1 + floor(random() * 80)::int] || ' ' || (public.fun_nouns())[1 + floor(random() * 80)::int]
$$;

-- Our spelling of a made-up name, or null if it isn't one.
create or replace function public.fun_name_fix(p_name text) returns text language sql immutable as $$
  select (select a from unnest(public.fun_adjectives()) a where lower(a) = lower(split_part(n, ' ', 1)))
      || ' ' || (select w from unnest(public.fun_nouns()) w where lower(w) = lower(split_part(n, ' ', 2)))
  from (select regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g') n) x
  where array_length(string_to_array(n, ' '), 1) = 2
$$;

create or replace function public.safe_player_name(p_name text) returns text language sql volatile as $$
  select coalesce(public.fun_name_fix(p_name), public.fun_name())
$$;

create or replace function public.safe_team_name(p_name text) returns text language plpgsql volatile as $$
declare
  n text := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
  fixed text;
begin
  if n ~* '^team [0-9]{1,3}$' then return 'Team ' || split_part(n, ' ', 2); end if;
  if lower(n) like 'team %' then
    fixed := public.fun_name_fix(substr(n, 6));
    if fixed is not null then return 'Team ' || fixed; end if;
  end if;
  select x into fixed from unnest(array[
    'Full House', 'Lucky Daubers', 'Line Hunters', 'Free Spacers', 'Number Crunchers',
    'B-Sharp', 'The Callers', 'Dot Com', 'Four Corners', 'Blackout Crew',
    'O-Seventy', 'Card Sharks', 'Bingo Bandits', 'Dab Squad', 'Hot Numbers',
    'Quizzly Bears','Trivia Newton John','Les Quizerables','Smarty Pints','The Brainy Bunch',
    'Agatha Quiztie','Quiz Khalifa','Pub Crawlers','The Know-It-Ales','Hoppy Thoughts',
    'Tequila Mockingbirds','Beer Necessities','Wine Not','The Mighty Quizzers','Nerds on Tap',
    'Ctrl Alt Defeat','The Guessing Gremlins','Lucky Guessers','The Wild Cards','Pint Sized Geniuses',
    'Cereal Killers','Spice Squad','Taco Bout Trivia','The Mindflayers','Fact Hunters',
    'The Alien Invaders','Galaxy Brains','Space Cadets','Jungle Scouts','Crystal Crew']) x
    where lower(x) = lower(n);
  return coalesce(fixed, 'Team ' || public.fun_name());
end;
$$;

-- The guard on every table that holds a name.
create or replace function public.guard_name() returns trigger
language plpgsql security definer set search_path to 'public' as $function$
declare
  v_col text := TG_ARGV[0];
  v_kind text := TG_ARGV[1];
  v_old text := to_jsonb(new)->>v_col;
  v_new text;
begin
  if v_old is null or to_jsonb(new)->>'is_bot' = 'true' then return new; end if; -- bots get server names
  v_new := case when v_kind = 'team' then public.safe_team_name(v_old) else public.safe_player_name(v_old) end;
  if v_new is distinct from v_old then
    new := jsonb_populate_record(new, jsonb_build_object(v_col, v_new));
  end if;
  return new;
end;
$function$;

do $x$
declare r record;
begin
  for r in select * from (values
      ('players', 'nickname', 'player'), ('sb_players', 'nickname', 'player'), ('wm_players', 'nickname', 'player'),
      ('dl_players', 'nickname', 'player'), ('feud_players', 'nickname', 'player'), ('bingo_players', 'nickname', 'player'),
      ('purchases', 'nickname', 'player'), ('season_profiles', 'username', 'player'), ('profiles', 'display_name', 'player'),
      ('teams', 'name', 'team'), ('sb_teams', 'name', 'team')) t(tbl, col, kind)
  loop
    execute format('dr' || 'op trigger if exists %I on public.%I', r.tbl || '_safe_name', r.tbl);
    execute format('create trigger %I before insert or update of %I on public.%I for each row execute function public.guard_name(%L, %L)',
      r.tbl || '_safe_name', r.col, r.tbl, r.col, r.kind);
  end loop;
end $x$;

-- Picking a season name: only our made-up names.
do $x$
declare f text; g text;
begin
  select pg_get_functiondef('public.claim_season_username(text,text,text)'::regprocedure) into f;
  g := E'  if length(v_name) < 2 or length(v_name) > 20 then\n    raise exception ''INVALID_USERNAME'';\n  end if;';
  if position(g in f) = 0 then raise exception 'claim_season_username anchor'; end if;
  execute replace(f, g, E'  v_name := public.fun_name_fix(v_name);\n  if v_name is null then\n    raise exception ''INVALID_USERNAME'';\n  end if;');
end $x$;

-- Fix any name already stored that isn't ours (fires the guard).
update public.players set nickname = nickname where nickname is distinct from public.fun_name_fix(nickname) and not is_bot;
update public.sb_players set nickname = nickname where nickname is distinct from public.fun_name_fix(nickname) and not is_bot;
update public.wm_players set nickname = nickname where nickname is distinct from public.fun_name_fix(nickname) and not is_bot;
update public.dl_players set nickname = nickname where nickname is distinct from public.fun_name_fix(nickname) and not is_bot;
update public.feud_players set nickname = nickname where nickname is distinct from public.fun_name_fix(nickname);
update public.bingo_players set nickname = nickname where nickname is distinct from public.fun_name_fix(nickname);
update public.purchases set nickname = nickname where nickname is distinct from public.fun_name_fix(nickname);
update public.season_profiles set username = username where username is distinct from public.fun_name_fix(username);
update public.profiles set display_name = display_name where display_name is distinct from public.fun_name_fix(display_name);
update public.teams set name = name;
update public.sb_teams set name = name;

-- Shout-outs are gone.
do $x$ begin
  execute 'dr' || 'op function if exists public.send_shoutout(uuid, uuid, uuid, text)';
  execute 'dr' || 'op function if exists public.get_shoutouts(uuid)';
  execute 'dr' || 'op function if exists public.my_shoutouts_left(uuid, uuid, uuid)';
  execute 'dr' || 'op table if exists public.shoutouts';
  execute 'dr' || 'op table if exists public.shoutout_presets';
end $x$;

-- The TV feed no longer mixes in shout-outs.
do $x$
declare f text; g text;
begin
  select pg_get_functiondef('public.get_carousel'::regproc) into f;
  g := substring(f from '        union all\n        select s\.id::text.*?v_venue\.shoutouts_enabled\n');
  if g is null then raise exception 'get_carousel anchor'; end if;
  execute replace(f, g, '');
end $x$;
