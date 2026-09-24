-- Retire the placeholder avatars (emoji set and the Crown/Dragon samples) now
-- that the owner's own characters are in. Kept (inactive) so past games and
-- purchases still reference valid rows.
update public.avatars set active = false
  where id in ('fox', 'bear', 'frog', 'owl', 'octopus', 'tiger', 'penguin', 'alien', 'crown', 'dragon');
