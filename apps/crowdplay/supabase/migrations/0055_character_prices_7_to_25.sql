-- Paid characters now cost $7 to $25, keeping their old order
-- (cheapest stays cheapest). Jungle Scout and Crystal Titan stay free.
update public.avatars set price_cents = v.cents
from (values
  ('alien-buddy', 700),
  ('sylvan-entity', 900),
  ('forest-guardian', 1200),
  ('model-z', 1400),
  ('aethel-druid', 1500),
  ('stone-golem', 1800),
  ('forest-heart', 2000),
  ('void-walker', 2200),
  ('geo-sphinx', 2500)
) as v(id, cents)
where public.avatars.id = v.id;
