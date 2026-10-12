-- Remove two characters from the game (no player has used or unlocked them).
-- They are switched off rather than deleted, so nothing that ever pointed at them breaks.
update public.avatars set active = false where id in ('forest-heart', 'aethel-druid');
