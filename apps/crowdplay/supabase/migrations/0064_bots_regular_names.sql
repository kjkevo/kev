-- Bots get regular first names (no "BOT " prefix). They're marked with a
-- hidden players.is_bot flag instead of by name.

alter table public.players add column if not exists is_bot boolean not null default false;
update public.players set is_bot = true where nickname like 'BOT %';
-- Drop the prefix from existing bots (skipping any that would clash with a
-- real player's name in the same game).
update public.players p set nickname = substr(p.nickname, 5)
  where p.is_bot and p.nickname like 'BOT %'
    and not exists (select 1 from public.players o where o.room_id = p.room_id and o.id <> p.id
                    and lower(o.nickname) = lower(substr(p.nickname, 5)));

-- Everything that recognised bots by name now uses the flag.
do $$
declare
  f text;
  d text;
begin
  foreach f in array array['finalize_voting_and_start', 'trivia_bot_autopilot', 'trivia_bot_sudden_death',
                           'get_trivia_champion', 'ops_watchdog', 'rest_idle_venues'] loop
    d := pg_get_functiondef(('public.' || f)::regproc);
    d := regexp_replace(d, '(public\.)?trivia_is_bot\((\w+)\.nickname\)', '\2.is_bot', 'g');
    d := regexp_replace(d, '(\w+)\.nickname not like ''BOT %''', 'not \1.is_bot', 'g');
    d := regexp_replace(d, '(\w+)\.nickname like ''BOT %''', '\1.is_bot', 'g');
    if d ~ 'trivia_is_bot\(|BOT %' then
      raise exception '% still refers to bot names', f;
    end if;
    execute d;
  end loop;
end $$;

-- A real player can take a name a bot is using: the bot steps aside (the
-- gap-filler adds another bot with a different name).
do $$
declare
  f text;
  d text;
  n int;
begin
  foreach f in array array['join_room', 'rejoin_next_game'] loop
    d := pg_get_functiondef(('public.' || f)::regproc);
    n := length(d);
    d := regexp_replace(d,
      '(\n  if exists \(select 1 from public\.players pl where pl\.room_id = (v_room|v_target)\.id and lower\(pl\.nickname\) = lower\((trim\(p_nickname\)|v_old\.nickname)\)\) then\n    raise exception ''NICKNAME_TAKEN'';)',
      E'\n  delete from public.players pl where pl.room_id = \\2.id and pl.is_bot and lower(pl.nickname) = lower(\\3);\\1');
    if length(d) = n then
      raise exception '% name-clash patch did not apply', f;
    end if;
    execute d;
  end loop;
end $$;

create or replace function public.trivia_bot_fill(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_fill_to constant int := 12;
  v_bot_team_size constant int := 4;
  v_names constant text[] := array['Ava','Ben','Cleo','Dev','Fay','Gus','Hana','Ivan','Jo','Kai','Lou','Max',
                                   'Nia','Oscar','Priya','Quinn','Rosa','Sam','Theo','Uma','Vince','Wes','Yara','Zoe'];
  v_room public.rooms;
  v_humans int;
  v_bots int;
  v_target int;
  v_team uuid;
  v_name text;
  v_new uuid;
  v_extra record;
  i int;
begin
  select * into v_room from public.rooms where id = p_room_id;
  if v_room.phase <> 'lobby' then
    return;
  end if;
  select count(*) filter (where not pl.is_bot), count(*) filter (where pl.is_bot)
    into v_humans, v_bots
    from public.players pl where pl.room_id = p_room_id and pl.left_at is null;
  v_target := greatest(0, v_fill_to - v_humans);

  -- Too many: remove bots, emptiest bot teams first, then drop empty teams.
  if v_bots > v_target then
    for v_extra in
      select pl.id from public.players pl
      where pl.room_id = p_room_id and pl.left_at is null and pl.is_bot
      order by (select count(*) from public.players p2 where p2.team_id = pl.team_id and p2.left_at is null), pl.joined_at desc
      limit v_bots - v_target
    loop
      delete from public.players where id = v_extra.id;
    end loop;
    delete from public.teams t where t.room_id = p_room_id
      and not exists (select 1 from public.players pl where pl.team_id = t.id);
    return;
  end if;

  -- Too few: fill bot-only teams up to 4, then start new bot teams.
  for i in 1 .. (v_target - v_bots) loop
    select n into v_name from unnest(v_names) n
      where not exists (select 1 from public.players pl where pl.room_id = p_room_id and lower(pl.nickname) = lower(n))
      order by random() limit 1;
    exit when v_name is null;
    v_team := null;
    select t.id into v_team from public.teams t
      where t.room_id = p_room_id and not t.locked
        and exists (select 1 from public.players pl where pl.team_id = t.id and pl.left_at is null)
        and not exists (select 1 from public.players pl where pl.team_id = t.id and pl.left_at is null and not pl.is_bot)
        and (select count(*) from public.players pl where pl.team_id = t.id and pl.left_at is null) < v_bot_team_size
      order by t.created_at limit 1;
    begin
      if v_team is not null then
        select player_id into v_new from public.join_room(v_room.code, v_name, v_team, null,
          case when hashtext(v_name) % 2 = 0 then 'jungle-scout' else 'crystal-titan' end, null);
      else
        select player_id into v_new from public.join_room(v_room.code, v_name, null, public.trivia_fun_team_name(p_room_id),
          case when hashtext(v_name) % 2 = 0 then 'jungle-scout' else 'crystal-titan' end, null);
      end if;
      update public.players set is_bot = true where id = v_new;
    exception when others then
      exit; -- room or team limits reached
    end;
  end loop;
end;
$$;

drop function if exists public.trivia_is_bot(text);
