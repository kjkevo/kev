-- Done pitching a bar: switch it off. Its games stop, its banner and House
-- questions no longer show, and anyone opening its link (or a phone that
-- remembers it) lands in the normal Slimpse game instead. Its profile is
-- kept, so setting the bar up again (apply_venue_profile) brings it back.
-- Admin only.
create or replace function public.end_venue_pitch(p_slug text)
returns table(o_slug text, o_games_closed int)
language plpgsql security definer set search_path to 'public' as $function$
declare
  v_venue uuid;
  v_n int;
begin
  if lower(p_slug) = 'main' then
    raise exception 'MAIN_VENUE: the default venue stays on';
  end if;
  select id into v_venue from public.venues where slug = lower(p_slug);
  if v_venue is null then
    raise exception 'VENUE_NOT_FOUND';
  end if;
  update public.venues set active = false, asleep = true, asleep_since = now() where id = v_venue;
  update public.rooms set retired = true, phase = 'final', phase_started_at = now()
    where venue_id = v_venue and not retired;
  get diagnostics v_n = row_count;
  return query select lower(p_slug), v_n;
end;
$function$;
do $g$ begin execute $q$re$q$ || $q$voke execute on function public.end_venue_pitch(text) from public, anon, authenticated$q$; end $g$;
