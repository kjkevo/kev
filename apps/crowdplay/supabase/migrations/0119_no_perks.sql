-- Perks are gone from every game: picking one is refused (clearing is fine).
do $x$
declare f text; fn text; arg text;
begin
  foreach fn in array array['set_player_perk', 'sb_set_power', 'wm_set_power', 'dl_set_power'] loop
    arg := case when fn = 'set_player_perk' then 'p_perk' else 'p_power' end;
    select pg_get_functiondef(oid) into f from pg_proc where proname = fn and pronamespace = 'public'::regnamespace;
    if position(E'\nbegin\n' in f) = 0 then raise exception 'anchor %', fn; end if;
    execute regexp_replace(f, E'\nbegin\n', E'\nbegin\n  if ' || arg || E' is not null then raise exception ''NO_PERKS''; end if;\n');
  end loop;
end $x$;
