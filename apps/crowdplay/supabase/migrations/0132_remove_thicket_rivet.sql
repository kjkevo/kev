-- Thicket and Rivet are taken out again: back to 9 characters. Their
-- characters are switched off and no game gives them a power any more.
update public.avatars set active = false where id in ('thicket', 'rivet');
do $x$
declare fn text; f text;
begin
  foreach fn in array array['dl_char_power', 'wm_char_power', 'sb_char_power'] loop
    select pg_get_functiondef(('public.' || fn || '(text)')::regprocedure) into f;
    if position(E'\n    when ''thicket'' then ''tangle'' when ''rivet'' then ''lockon''' in f) = 0 then raise exception '% anchor', fn; end if;
    execute replace(f, E'\n    when ''thicket'' then ''tangle'' when ''rivet'' then ''lockon''', '');
  end loop;
  select pg_get_functiondef('public.trivia_power_for(text)'::regprocedure) into f;
  if position(E'    when ''thicket'' then ''tangle''\n    when ''rivet'' then ''lockon''\n' in f) = 0 then raise exception 'trivia anchor'; end if;
  execute replace(f, E'    when ''thicket'' then ''tangle''\n    when ''rivet'' then ''lockon''\n', '');
end $x$;
