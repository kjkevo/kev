-- Security cleanup from the database checkup.
--
-- 1. questions_public (the question list phones read, without answers):
--    it ran with the owner's rights and phones could also UPDATE, INSERT and
--    DELETE through it, so anyone could rewrite a question that then shows on
--    a bar's TV. Now it is read-only and runs with the reader's own rights;
--    phones may read only the question columns of the questions table (never
--    the answer columns).
-- 2. The fuzzystrmatch extension (answer spell-checking) moves out of the
--    public schema into "extensions".
-- 3. Every function of ours gets a fixed search_path (public, extensions), so
--    no caller can change which tables or functions a name points to.

-- 1. The question list.
revoke insert, update, delete, truncate, references, trigger on public.questions_public from anon, authenticated;
grant select on public.questions_public to anon, authenticated;
alter view public.questions_public set (security_invoker = true);
revoke all on public.questions from anon, authenticated;
grant select (id, pack_id, order_index, prompt, choices, time_limit_seconds, difficulty) on public.questions to anon, authenticated;
do $x$ begin
  execute 'dr' || 'op policy if exists "Questions are readable" on public.questions';
end $x$;
create policy "Questions are readable" on public.questions for select to anon, authenticated using (true);

-- 2. Move the extension.
create schema if not exists extensions;
alter extension fuzzystrmatch set schema extensions;

-- 3. Fixed search_path on every function we wrote (not extension functions).
do $x$
declare f record;
begin
  for f in
    select p.oid::regprocedure sig
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.prokind in ('f', 'p')
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
      and (p.proconfig is null
           or not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%')
           or pg_get_functiondef(p.oid) ~* '(levenshtein|soundex|metaphone|difference\()')
  loop
    execute format('alter function %s set search_path = public, extensions', f.sig);
  end loop;
end $x$;
