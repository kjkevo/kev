-- The next solo game opens as soon as the current one reaches its results
-- (not 20 seconds later when it retires), so "Play again" and new arrivals
-- always have a solo game to go to. The watchdog ignores a game showing its
-- results when looking for a venue's duplicate live games.
do $patch$
declare d text; n text;
begin
  d := pg_get_functiondef('public.tick()'::regprocedure);
  n := replace(d, 'not r.retired and r.mode = ''solo'') then', 'not r.retired and r.mode = ''solo'' and r.phase <> ''final'') then');
  if n = d then raise exception 'tick patch did not apply'; end if;
  execute n;
  d := pg_get_functiondef('public.ops_watchdog()'::regprocedure);
  n := replace(d, E'    where not r.retired and not r.queued and r.id <> (select r2.id',
    E'    where not r.retired and not r.queued and r.phase <> ''final'' and r.id <> (select r2.id');
  if n = d then raise exception 'watchdog patch did not apply'; end if;
  execute n;
end $patch$;
