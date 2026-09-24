-- Test bots always wear one of the two free characters (stable per bot
-- name), replacing any retired placeholder or paid avatar they picked up.
do $$
declare
  v_def text;
  v_old text := 'where p.nickname like ''BOT %'' and p.avatar_id is null and p.left_at is null;';
begin
  v_def := pg_get_functiondef('public.trivia_bot_autopilot()'::regprocedure);
  if position(v_old in v_def) = 0 then
    raise exception 'trivia_bot_autopilot() avatar step not found';
  end if;
  execute replace(v_def, v_old,
    'where p.nickname like ''BOT %'' and p.left_at is null
      and (p.avatar_id is null or p.avatar_id not in (select id from avatars where active and price_cents = 0));');
end;
$$;

update public.players p set avatar_id = (
    select a.id from public.avatars a where a.active and a.price_cents = 0 order by a.sort
    offset abs(hashtext(p.nickname)) % greatest(1, (select count(*) from public.avatars where active and price_cents = 0)) limit 1)
  where p.nickname like 'BOT %'
    and (p.avatar_id is null or p.avatar_id not in (select id from public.avatars where active and price_cents = 0));
