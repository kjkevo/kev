-- Only Crystal Titan and Jungle Scout are free. Every other character costs
-- $9.99, or unlocks free every 5 levels (Level 5, 10, 15, ... 35).
update public.avatars a set unlock_level = x.lvl, price_cents = 999
  from (values ('alien-buddy', 5), ('forest-guardian', 10), ('stone-golem', 15), ('void-walker', 20),
               ('sylvan-entity', 25), ('model-z', 30), ('geo-sphinx', 35)) as x(id, lvl)
  where a.id = x.id;
update public.avatars set unlock_level = null, price_cents = 0 where id in ('crystal-titan', 'jungle-scout');

-- Anyone who already played as Alien Buddy (free until now) keeps it.
insert into public.avatar_unlocks (device_key, avatar_id)
  select distinct p.device_key, p.avatar_id from public.players p
  where p.avatar_id = 'alien-buddy' and not p.is_bot and p.device_key is not null
  on conflict do nothing;
