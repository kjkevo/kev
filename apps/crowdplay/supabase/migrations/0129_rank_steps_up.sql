-- Rank steps count up: Spark I, Spark II, Spark III, then Comet I, and so on.
create or replace function public.rank_label(p_rp integer) returns text language sql immutable as $function$
  select (array['Spark', 'Comet', 'Star', 'Nova', 'Galaxy'])[public.rank_tier(p_rp) + 1] || ' ' ||
    (array['I', 'II', 'III'])[least(2, (greatest(0, p_rp) - public.rank_tier(p_rp) * 300) / 100) + 1]
$function$;
