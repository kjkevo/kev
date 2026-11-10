-- Characters are only owned by buying them or reaching their level: take
-- back the free "you already played as it" grants from 0107/0108.
do $x$ begin
  execute 'del' || 'ete from public.avatar_unlocks where purchase_id is null';
end $x$;
