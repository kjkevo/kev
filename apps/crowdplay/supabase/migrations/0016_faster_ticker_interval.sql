-- The countdown rings are computed client-side from phase_started_at, but
-- the actual phase transition only happens when the autonomous ticker's
-- cron job runs. At the old 5-second interval, a dwell timer could finish
-- up to ~5 seconds before the next tick actually advanced the phase --
-- exactly the "screen stays up a few extra seconds after the ring empties"
-- lag reported live. Tightening both tickers to run every second shrinks
-- that worst case to under a second. Applied directly (cron jobs aren't
-- schema, so there's nothing to apply via migration tooling) -- mirrored
-- here for history same as the original cron.schedule calls.

select cron.unschedule('family_feud_autonomous_tick');
select cron.schedule('family_feud_autonomous_tick', '1 second', 'select public.tick_feud();');

select cron.unschedule('trivia_autonomous_tick');
select cron.schedule('trivia_autonomous_tick', '1 second', 'select public.tick();');
