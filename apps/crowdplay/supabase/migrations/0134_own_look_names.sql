-- Wild Match and Drop Line keep their own look and words, far from other
-- card and drop games. Only what players read changes; the game keys stay.
--   Wild Match colors: red/blue/green/yellow are shown as Pink/Purple/Teal/Orange.
--   Wild Match cards: Skip -> Block, +2 -> Take 2, Wild -> Pick, Wild +4 -> Take 4.
--   Drop Line pieces: Gold/Blue -> Lime/Pink.

create or replace function public.wm_color_name(p_color text) returns text language sql immutable as $$
  select case p_color when 'red' then 'Pink' when 'blue' then 'Purple' when 'green' then 'Teal' when 'yellow' then 'Orange'
    else initcap(p_color) end
$$;

create or replace function public.wm_card_name(c integer) returns text language sql immutable as $function$
  select case public.wm_kind(c)
    when 'wild4' then 'Take 4' when 'wild' then 'Pick'
    else public.wm_color_name(public.wm_color(c)) || ' ' || case public.wm_kind(c)
      when 'skip' then 'Block' when 'flip' then 'Flip' when 'draw2' then 'Take 2' else public.wm_kind(c) end end;
$function$;

do $x$
declare f text; g text;
begin
  select pg_get_functiondef('public.wm_apply_play'::regproc) into f;
  g := E'case when p_card >= 100 then '' ('' || initcap(p_color) || '')''';
  if position(g in f) = 0 then raise exception 'wm_apply_play anchor'; end if;
  execute replace(f, g, E'case when p_card >= 100 then '' ('' || public.wm_color_name(p_color) || '')''');

  select pg_get_functiondef('public.dl_tick'::regproc) into f;
  g := 'Game on! Gold goes first.';
  if position(g in f) = 0 then raise exception 'dl_tick anchor'; end if;
  execute replace(f, g, 'Game on! Lime goes first.');

  select pg_get_functiondef('public.dl_check_end'::regproc) into f;
  g := E'case w when 1 then ''Gold'' else ''Blue'' end';
  if position(g in f) = 0 then raise exception 'dl_check_end anchor'; end if;
  execute replace(f, g, E'case w when 1 then ''Lime'' else ''Pink'' end');
end $x$;
