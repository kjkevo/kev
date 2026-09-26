-- Join rate limit: up to 20 joins per minute from one internet connection,
-- instead of one join every 5 seconds. Everyone on a bar's Wi-Fi shares one
-- public IP, so a group scanning the QR together must all get in.

alter table public.join_rate_limits add column if not exists window_started_at timestamptz;
alter table public.join_rate_limits add column if not exists join_count int not null default 0;

do $patch$
declare
  v_def text := pg_get_functiondef('public.join_room(text,text,uuid,text)'::regprocedure);
  v_check_old text := $old$  if v_ip is not null and exists (
    select 1 from public.join_rate_limits jrl
    where jrl.ip = v_ip and jrl.last_join_at > now() - interval '5 seconds'
  ) then
    raise exception 'TOO_MANY_JOINS';
  end if;$old$;
  v_check_new text := $new$  if v_ip is not null and exists (
    select 1 from public.join_rate_limits jrl
    where jrl.ip = v_ip and jrl.window_started_at > now() - interval '1 minute' and jrl.join_count >= 20
  ) then
    raise exception 'TOO_MANY_JOINS';
  end if;$new$;
  v_log_old text := $old$    insert into public.join_rate_limits (ip, last_join_at) values (v_ip, now())
      on conflict (ip) do update set last_join_at = excluded.last_join_at;$old$;
  v_log_new text := $new$    insert into public.join_rate_limits (ip, last_join_at, window_started_at, join_count) values (v_ip, now(), now(), 1)
      on conflict (ip) do update set
        last_join_at = excluded.last_join_at,
        join_count = case when public.join_rate_limits.window_started_at > now() - interval '1 minute'
                          then public.join_rate_limits.join_count + 1 else 1 end,
        window_started_at = case when public.join_rate_limits.window_started_at > now() - interval '1 minute'
                                 then public.join_rate_limits.window_started_at else now() end;$new$;
begin
  if position(v_check_old in v_def) = 0 or position(v_log_old in v_def) = 0 then
    raise exception 'join_room no longer matches the expected rate-limit code';
  end if;
  execute replace(replace(v_def, v_check_old, v_check_new), v_log_old, v_log_new);
end;
$patch$;
