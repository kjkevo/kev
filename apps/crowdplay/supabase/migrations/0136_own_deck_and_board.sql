-- Wild Match and Drop Line move further from other games' rules.
--
-- Wild Match: each player starts with 8 cards; numbers run 1 to 8 (no 0, no
-- 9); and there is a new card of its own, "Again" (play it, then take
-- another turn). Per color: 1-8 twice, 2 Block, 2 Flip, 2 Take 2, 2 Again;
-- plus 4 Pick and 4 Take 4. 104 cards.
--   Card ids stay 0-99 colored (color = id / 25) and 100-107 Pick / Take 4.
--   Inside a color (id % 25): 0-15 numbers 1-8, 16-17 Block, 18-19 Flip,
--   20-21 Take 2, 22-23 Again, 24 not used.
-- Drop Line: the board is 7 wide and 7 tall (was 6 tall); index = row * 7 + col.

-- Wild Match ----------------------------------------------------------------

create or replace function public.wm_kind(c integer) returns text language sql immutable
set search_path to 'public', 'extensions' as $function$
  select case
    when c >= 104 then 'wild4'
    when c >= 100 then 'wild'
    when c % 25 <= 15 then ((c % 25) / 2 + 1)::text
    when c % 25 <= 17 then 'skip'
    when c % 25 <= 19 then 'flip'
    when c % 25 <= 21 then 'draw2'
    when c % 25 <= 23 then 'again'
    else 'unused' end;
$function$;

create or replace function public.wm_card_name(c integer) returns text language sql immutable
set search_path to 'public', 'extensions' as $function$
  select case public.wm_kind(c)
    when 'wild4' then 'Take 4' when 'wild' then 'Pick'
    else public.wm_color_name(public.wm_color(c)) || ' ' || case public.wm_kind(c)
      when 'skip' then 'Block' when 'flip' then 'Flip' when 'draw2' then 'Take 2' when 'again' then 'Again'
      else public.wm_kind(c) end end;
$function$;

do $x$
declare f text; g text;
begin
  -- Deal 8 each from the new 104-card deck.
  select pg_get_functiondef('public.wm_tick'::regproc) into f;
  g := 'select array_agg(c order by random()) into v_deck from generate_series(0, 107) c;';
  if position(g in f) = 0 then raise exception 'wm_tick anchor 1'; end if;
  f := replace(f, g, 'select array_agg(c order by random()) into v_deck from generate_series(0, 107) c where c >= 100 or c % 25 < 24;');
  g := 'hand = v_deck[v_seat * 7 + 1:v_seat * 7 + 7]';
  if position(g in f) = 0 then raise exception 'wm_tick anchor 2'; end if;
  f := replace(f, g, 'hand = v_deck[v_seat * 8 + 1:v_seat * 8 + 8]');
  g := 'v_deck := v_deck[29:];';
  if position(g in f) = 0 then raise exception 'wm_tick anchor 3'; end if;
  f := replace(f, g, 'v_deck := v_deck[33:];');
  execute f;

  -- "Again": you go again after playing it.
  select pg_get_functiondef('public.wm_apply_play'::regproc) into f;
  g := E'  if v_kind = ''skip'' then\n    v_skip := true;';
  if position(g in f) = 0 then raise exception 'wm_apply_play anchor'; end if;
  f := replace(f, g, E'  if v_kind = ''again'' then\n    update public.wm_players set extra_turn = true where id = p.id;\n  elsif v_kind = ''skip'' then\n    v_skip := true;');
  execute f;
end $x$;

-- Drop Line -----------------------------------------------------------------

create or replace function public.dl_landing(b integer[], c integer) returns integer language sql immutable
set search_path to 'public', 'extensions' as $function$
  select min(r) from generate_series(0, 6) r where b[r * 7 + c + 1] = 0;
$function$;

create or replace function public.dl_remove(b integer[], r integer, c integer) returns integer[] language plpgsql immutable
set search_path to 'public', 'extensions' as $function$
declare k int;
begin
  for k in r..5 loop
    b[k * 7 + c + 1] := b[(k + 1) * 7 + c + 1];
  end loop;
  b[6 * 7 + c + 1] := 0;
  return b;
end;
$function$;

create or replace function public.dl_winner(b integer[]) returns integer language plpgsql immutable
set search_path to 'public', 'extensions' as $function$
declare r int; c int; v int; d int[]; k int;
begin
  for r in 0..6 loop
    for c in 0..6 loop
      v := b[r * 7 + c + 1];
      if v not in (1, 2) then continue; end if;
      foreach k in array array[1, 2, 3, 4] loop
        d := case k when 1 then array[0, 1] when 2 then array[1, 0] when 3 then array[1, 1] else array[1, -1] end;
        if r + 3 * d[1] between 0 and 6 and c + 3 * d[2] between 0 and 6
           and b[(r + d[1]) * 7 + c + d[2] + 1] = v and b[(r + 2 * d[1]) * 7 + c + 2 * d[2] + 1] = v
           and b[(r + 3 * d[1]) * 7 + c + 3 * d[2] + 1] = v then
          return v;
        end if;
      end loop;
    end loop;
  end loop;
  return 0;
end;
$function$;

do $x$
declare f text; g text;
begin
  select pg_get_functiondef('public.dl_check_end'::regproc) into f;
  g := 'r.board[36:42]';
  if position(g in f) = 0 then raise exception 'dl_check_end anchor'; end if;
  execute replace(f, g, 'r.board[43:49]');

  select pg_get_functiondef('public.dl_tick'::regproc) into f;
  g := 'board = array_fill(0, array[42])';
  if position(g in f) = 0 then raise exception 'dl_tick anchor'; end if;
  execute replace(f, g, 'board = array_fill(0, array[49])');

  select pg_get_functiondef('public.dl_use_char_power(uuid,uuid,uuid,integer)'::regprocedure) into f;
  if (length(f) - length(replace(f, 'generate_series(0, 5) x', ''))) / length('generate_series(0, 5) x') < 1 then raise exception 'dl power anchor 1'; end if;
  f := replace(f, 'generate_series(0, 5) x', 'generate_series(0, 6) x');
  g := 'generate_series(0, 41) x';
  if position(g in f) = 0 then raise exception 'dl power anchor 2'; end if;
  f := replace(f, g, 'generate_series(0, 48) x');
  execute f;
end $x$;

-- Games already under way get the extra top row (empty).
update public.dl_rooms set board = board || array_fill(0, array[7]) where array_length(board, 1) = 42;
alter table public.dl_rooms alter column board set default array_fill(0, array[49]);
