-- Count every real arrival, not just scans of the tagged QR. Any player page
-- opened in a new browser session is an arrival (source 'visit'); arrivals
-- through a tagged QR link are 'qr'. One row per phone per visit; a visit
-- that later turns out to have come from a QR is upgraded to 'qr'.
alter table public.qr_scans add column if not exists source text not null default 'qr';

drop function if exists public.log_qr_scan(text, text);
create or replace function public.log_qr_scan(p_venue text, p_session_key text, p_source text default 'qr')
returns void language plpgsql security definer set search_path to 'public' as $function$
declare
  v public.venues;
begin
  v := public.venue_by_slug(p_venue);
  if v.id is null or length(coalesce(p_session_key, '')) not between 8 and 64 then
    return;
  end if;
  insert into public.qr_scans (venue_id, session_key, source)
    values (v.id, p_session_key, case when p_source = 'visit' then 'visit' else 'qr' end)
    on conflict (venue_id, session_key) do update set source = 'qr'
      where excluded.source = 'qr' and public.qr_scans.source <> 'qr';
end;
$function$;
grant execute on function public.log_qr_scan(text, text, text) to anon, authenticated;
