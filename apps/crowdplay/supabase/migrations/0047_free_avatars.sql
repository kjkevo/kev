-- The two free avatars (every other character is paid).
insert into public.avatars (id, name, image_url, price_cents, sort) values
  ('jungle-scout', 'Jungle Scout', '/avatars/jungle-scout-256.png', 0, 1),
  ('crystal-titan', 'Crystal Titan', '/avatars/crystal-titan-256.png', 0, 2)
  on conflict (id) do update set image_url = excluded.image_url, price_cents = 0, active = true, sort = excluded.sort;
