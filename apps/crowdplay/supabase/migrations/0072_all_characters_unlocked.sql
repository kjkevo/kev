-- While building emotes: every character is unlocked for everyone, behind
-- one switch. Before launch, turn it off to bring the locks back:
--   update public.feature_flags set enabled = false where key = 'all_characters_unlocked';
create table if not exists public.feature_flags (
  key text primary key,
  enabled boolean not null default false
);
alter table public.feature_flags enable row level security; -- read through the functions below
insert into public.feature_flags (key, enabled) values ('all_characters_unlocked', true)
  on conflict (key) do update set enabled = excluded.enabled;

create or replace function public.feature_on(p_key text)
returns boolean language sql stable security definer set search_path to 'public' as $function$
  select coalesce((select f.enabled from public.feature_flags f where f.key = p_key), false);
$function$;

create or replace function public.check_avatar(p_avatar_id text, p_device_key text)
returns void
language plpgsql stable security definer set search_path to 'public' as $function$
declare
  v_price int;
begin
  if p_avatar_id is null or p_avatar_id = '' then
    raise exception 'AVATAR_REQUIRED';
  end if;
  select price_cents into v_price from public.avatars where id = p_avatar_id and active;
  if v_price is null then
    raise exception 'AVATAR_NOT_FOUND';
  end if;
  if v_price > 0 and not public.feature_on('all_characters_unlocked')
     and not exists (select 1 from public.avatar_unlocks u where u.device_key = p_device_key and u.avatar_id = p_avatar_id) then
    raise exception 'AVATAR_LOCKED';
  end if;
end;
$function$;

create or replace function public.list_avatars(p_device_key text)
returns table(o_id text, o_name text, o_emoji text, o_image_url text, o_price_cents integer, o_owned boolean)
language sql stable security definer set search_path to 'public' as $function$
  select a.id, a.name, a.emoji, a.image_url, a.price_cents,
    a.price_cents = 0 or public.feature_on('all_characters_unlocked')
      or exists (select 1 from public.avatar_unlocks u where u.device_key = p_device_key and u.avatar_id = a.id)
  from public.avatars a where a.active
  order by a.price_cents > 0, a.sort, a.name;
$function$;
