-- Everyone on a bar's Wi-Fi shares one public IP address, so the join
-- limit of 20 per minute per IP turned away the 21st person in a rush
-- (found by the load test). 300 per minute still stops a runaway script.
do $patch$
declare d text; n text;
begin
  d := pg_get_functiondef('public.join_room(text, text, uuid, text, text, text)'::regprocedure);
  n := replace(d, 'jrl.window_started_at > now() - interval ''1 minute'' and jrl.join_count >= 20',
                  'jrl.window_started_at > now() - interval ''1 minute'' and jrl.join_count >= 300');
  if n = d then raise exception 'join_room patch did not apply'; end if;
  execute n;
end $patch$;
