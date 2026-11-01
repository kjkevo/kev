-- One call that sets a bar up from its pitch profile (the form filled in
-- before visiting): creates or updates the venue and its branding, and
-- replaces its House question pack. Run by an admin, not callable by phones.
--
-- p: { slug, name, timezone?, logo_url?, accent?, welcome?, prize?,
--      questions?: [{ prompt, answer, wrong?: [3 wrong answers], accept?: [...],
--                     hint?, fun_fact?, difficulty? }] }
-- A question with wrong answers is multiple choice (answer in a random spot);
-- without them it's a typed answer.
create or replace function public.apply_venue_profile(p jsonb)
returns table(o_venue_id uuid, o_slug text, o_questions int)
language plpgsql security definer set search_path to 'public' as $function$
declare
  v_slug text := lower(btrim(p->>'slug'));
  v_venue uuid;
  v_pack uuid;
  v_q jsonb;
  v_choices jsonb;
  v_correct int;
  v_n int := 0;
  v_wrong jsonb;
  v_i int;
  v_w record;
begin
  if v_slug !~ '^[a-z0-9-]{2,40}$' then
    raise exception 'BAD_SLUG: use lowercase letters, numbers and dashes';
  end if;
  if coalesce(btrim(p->>'name'), '') = '' then
    raise exception 'NAME_REQUIRED';
  end if;

  insert into public.venues (slug, name, timezone, active, last_activity_at, logo_url, accent, welcome_line, prize_text)
  values (v_slug, btrim(p->>'name'), coalesce(nullif(p->>'timezone', ''), 'America/New_York'), true, now(),
          nullif(p->>'logo_url', ''), nullif(p->>'accent', ''), nullif(p->>'welcome', ''), nullif(p->>'prize', ''))
  on conflict (slug) do update set
    name = excluded.name, timezone = excluded.timezone, active = true, asleep = false,
    logo_url = excluded.logo_url, accent = excluded.accent,
    welcome_line = excluded.welcome_line, prize_text = excluded.prize_text
  returning id into v_venue;

  if jsonb_typeof(p->'questions') = 'array' then
    select id into v_pack from public.question_packs where venue_id = v_venue limit 1;
    if v_pack is null then
      insert into public.question_packs (name, category, venue_id, icon)
        values (btrim(p->>'name') || ' House', 'house', v_venue, null)
        returning id into v_pack;
    else
      update public.question_packs set name = btrim(p->>'name') || ' House' where id = v_pack;
    end if;
    -- The new list replaces the old one (old questions are switched off, kept for history).
    update public.questions set active = false where pack_id = v_pack;

    for v_q in select * from jsonb_array_elements(p->'questions') loop
      continue when coalesce(btrim(v_q->>'prompt'), '') = '' or coalesce(btrim(v_q->>'answer'), '') = '';
      v_wrong := coalesce(v_q->'wrong', '[]'::jsonb);
      select coalesce(jsonb_agg(w), '[]'::jsonb) into v_wrong
        from jsonb_array_elements_text(v_wrong) w where btrim(w) <> '';
      if jsonb_array_length(v_wrong) >= 1 then
        -- The right answer goes in a random spot among the wrong ones.
        v_correct := floor(random() * (jsonb_array_length(v_wrong) + 1))::int;
        v_choices := '[]'::jsonb;
        v_i := 0;
        for v_w in select value from jsonb_array_elements_text(v_wrong) loop
          if v_i = v_correct then v_choices := v_choices || to_jsonb(btrim(v_q->>'answer')); end if;
          v_choices := v_choices || to_jsonb(btrim(v_w.value));
          v_i := v_i + 1;
        end loop;
        if v_correct = v_i then v_choices := v_choices || to_jsonb(btrim(v_q->>'answer')); end if;
      else
        v_correct := 0;
        v_choices := jsonb_build_array(btrim(v_q->>'answer'));
      end if;
      insert into public.questions (pack_id, order_index, prompt, choices, correct_index, difficulty,
                                    accepted_answers, hint, fun_fact)
      values (v_pack, v_n, btrim(v_q->>'prompt'), v_choices, v_correct,
              coalesce(nullif(v_q->>'difficulty', ''), 'easy'),
              coalesce(array(select jsonb_array_elements_text(coalesce(v_q->'accept', '[]'::jsonb))), '{}'),
              nullif(v_q->>'hint', ''), nullif(v_q->>'fun_fact', ''));
      v_n := v_n + 1;
    end loop;
  end if;

  return query select v_venue, v_slug, v_n;
end;
$function$;
do $g$ begin execute $q$re$q$ || $q$voke execute on function public.apply_venue_profile(jsonb) from public, anon, authenticated$q$; end $g$;
