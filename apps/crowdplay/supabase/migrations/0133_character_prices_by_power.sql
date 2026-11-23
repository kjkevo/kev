-- Character prices follow how strong their powers are (all 4 games ranked).
-- Free: Jungle Scout, Crystal Titan. Then, weakest to strongest:
--   $2.99  Alien Buddy (level 5), Forest Guardian (level 10)
--   $4.99  Celestial Geo-Sphinx (level 15), Stone Golem (level 20)
--   $7.99  Sylvan Entity (level 25), Void Walker (level 30)
--   $10    Model-Z (level 35)
-- Reaching the level still unlocks it for free. The list shows them in this order.
update public.avatars a set price_cents = v.price, unlock_level = v.lvl, sort = v.sort
from (values
  ('alien-buddy', 299, 5, 10),
  ('forest-guardian', 299, 10, 11),
  ('geo-sphinx', 499, 15, 12),
  ('stone-golem', 499, 20, 13),
  ('sylvan-entity', 799, 25, 14),
  ('void-walker', 799, 30, 15),
  ('model-z', 1000, 35, 16)
) v(id, price, lvl, sort)
where a.id = v.id;
