-- Two more teasing presets (plain text, 3 uses each per game like the rest).
insert into public.shoutout_presets (id, text, price_cents, active, sort) values
  ('did-you-study', 'Did you even study?', 0, true, 6),
  ('grandma', 'My grandma knows this one!', 0, true, 7)
  on conflict (id) do update set text = excluded.text, price_cents = 0, active = true, sort = excluded.sort;
