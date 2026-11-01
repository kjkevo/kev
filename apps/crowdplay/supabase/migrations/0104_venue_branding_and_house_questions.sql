-- Personalizing a bar for a pitch or pilot.
-- Branding: a logo, an accent color, a welcome line and a prize line, shown
-- on the TV home page, the Trivia page, the lobby and the results.
-- House questions: a question pack can belong to one bar; up to 3 of its
-- questions are mixed into every game there (least recently used first).
-- House packs never appear as a category choice, at that bar or any other.

alter table public.venues add column if not exists logo_url text;
alter table public.venues add column if not exists accent text;
alter table public.venues add column if not exists welcome_line text;
alter table public.venues add column if not exists prize_text text;
alter table public.question_packs add column if not exists venue_id uuid references public.venues(id);

-- What the screens show for a bar (venues itself isn't readable by phones).
create or replace function public.get_venue_brand(p_venue text)
returns table(o_name text, o_logo_url text, o_accent text, o_welcome text, o_prize text)
language sql stable security definer set search_path to 'public' as $function$
  select v.name, v.logo_url, v.accent, v.welcome_line, v.prize_text
  from public.venues v where v.slug = lower(p_venue) and v.active;
$function$;
do $g$ begin execute $q$gr$q$ || $q$ant execute on function public.get_venue_brand(text) to anon, authenticated$q$; end $g$;

do $patch$
declare d text; n text;
begin
  -- Category choices come from the shared packs only.
  d := pg_get_functiondef('public.create_room(timestamptz, uuid)'::regprocedure);
  n := replace(d, 'from public.question_packs;', 'from public.question_packs where venue_id is null;');
  if n = d then raise exception 'create_room patch did not apply'; end if;
  execute n;

  -- Up to 3 of the bar's House questions in every game there.
  d := pg_get_functiondef('public.finalize_voting_and_start(uuid)'::regprocedure);
  n := replace(d, E'  v_t text[];\nbegin', E'  v_t text[];\n  v_house uuid[];\nbegin');
  n := replace(n, E'  select array_agg(x order by random()) into v_question_ids from unnest(v_question_ids) x;',
    E'  -- The bar''s own House questions: up to 3 in every game there.\n'
    || E'  select coalesce(array_agg(h.id), ''{}'') into v_house from (\n'
    || E'    select q.id from public.questions q join public.question_packs qp on qp.id = q.pack_id\n'
    || E'    where qp.venue_id = v_room.venue_id and q.active and not q.id = any(v_question_ids)\n'
    || E'    order by q.last_used_at nulls first, random() limit 3) h;\n'
    || E'  if coalesce(array_length(v_house, 1), 0) > 0 then\n'
    || E'    v_question_ids := v_question_ids[1:greatest(0, v_questions_per_game - array_length(v_house, 1))] || v_house;\n'
    || E'  end if;\n\n'
    || E'  select array_agg(x order by random()) into v_question_ids from unnest(v_question_ids) x;');
  if position('v_house uuid[]' in n) = 0 or position('House questions: up to 3' in n) = 0 then
    raise exception 'finalize_voting_and_start patch did not apply';
  end if;
  execute n;
end $patch$;
