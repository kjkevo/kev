-- Purchases (premium avatars now; paid shoutouts later).
--
-- Flow: the phone asks the app's server (/api/purchase) to buy an item. The
-- server calls start_purchase (price comes from the database, never the
-- phone), charges the card through Square (or, before Square keys are set,
-- a practice payment marked TEST), then calls complete_purchase with a
-- server-only secret. Only complete_purchase unlocks anything, so a phone
-- can't give itself a premium avatar by calling the database directly.

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid references public.venues(id),
  room_id uuid references public.rooms(id) on delete set null,
  player_id uuid references public.players(id) on delete set null,
  nickname text,
  device_key text not null,
  item_type text not null check (item_type in ('avatar', 'shoutout')),
  item_id text not null,
  item_name text not null,
  amount_cents int not null check (amount_cents > 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  provider text,
  provider_payment_id text,
  is_test boolean not null default false,
  error text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index purchases_venue_idx on public.purchases (venue_id, created_at desc);
alter table public.purchases enable row level security; -- no policies: dashboard + functions only

-- Server-side secrets (no policies, no grants: only SECURITY DEFINER code reads it).
create table if not exists public.app_secrets (
  name text primary key,
  value text not null
);
alter table public.app_secrets enable row level security;
revoke all on public.app_secrets from anon, authenticated;

create or replace function public.start_purchase(p_item_type text, p_item_id text, p_device_key text, p_venue text,
                                                 p_nickname text default null, p_room_id uuid default null,
                                                 p_player_id uuid default null, p_client_token uuid default null)
returns table(o_purchase_id uuid, o_amount_cents int, o_item_name text)
language plpgsql security definer set search_path to 'public' as $function$
declare
  v_name text;
  v_price int;
  v_venue public.venues;
  v_player uuid;
  v_id uuid;
begin
  if length(coalesce(p_device_key, '')) not between 8 and 64 then
    raise exception 'INVALID_DEVICE';
  end if;
  if p_item_type = 'avatar' then
    select name, price_cents into v_name, v_price from public.avatars where id = p_item_id and active;
    if exists (select 1 from public.avatar_unlocks u where u.device_key = p_device_key and u.avatar_id = p_item_id) then
      raise exception 'ALREADY_OWNED';
    end if;
  elsif p_item_type = 'shoutout' then
    select text, price_cents into v_name, v_price from public.shoutout_presets where id = p_item_id and active;
  else
    raise exception 'ITEM_NOT_FOUND';
  end if;
  if v_name is null then
    raise exception 'ITEM_NOT_FOUND';
  end if;
  if v_price <= 0 then
    raise exception 'ITEM_IS_FREE';
  end if;
  v_venue := public.venue_by_slug(p_venue);
  if p_player_id is not null then
    select pl.id into v_player from public.players pl
      where pl.id = p_player_id and pl.room_id = p_room_id and pl.client_token = p_client_token;
  end if;
  insert into public.purchases (venue_id, room_id, player_id, nickname, device_key, item_type, item_id, item_name, amount_cents)
    values (v_venue.id, case when v_player is not null then p_room_id end, v_player,
            left(nullif(trim(coalesce(p_nickname, (select nickname from public.players where id = v_player))), ''), 30),
            p_device_key, p_item_type, p_item_id, v_name, v_price)
    returning id into v_id;
  return query select v_id, v_price, v_name;
end;
$function$;
grant execute on function public.start_purchase(text, text, text, text, text, uuid, uuid, uuid) to anon, authenticated;

create or replace function public.complete_purchase(p_purchase_id uuid, p_secret text, p_ok boolean,
                                                    p_provider text, p_payment_id text, p_is_test boolean, p_error text default null)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare
  v_p public.purchases;
begin
  if p_secret is null or p_secret is distinct from (select value from public.app_secrets where name = 'purchase_secret') then
    raise exception 'NOT_AUTHORIZED';
  end if;
  select * into v_p from public.purchases where id = p_purchase_id for update;
  if not found or v_p.status <> 'pending' then
    raise exception 'PURCHASE_NOT_PENDING';
  end if;
  if not p_ok then
    update public.purchases set status = 'failed', provider = p_provider, is_test = p_is_test, error = left(p_error, 300)
      where id = p_purchase_id;
    return;
  end if;
  update public.purchases set status = 'paid', provider = p_provider, provider_payment_id = p_payment_id,
    is_test = p_is_test, paid_at = now() where id = p_purchase_id;
  if v_p.item_type = 'avatar' then
    insert into public.avatar_unlocks (device_key, avatar_id, purchase_id) values (v_p.device_key, v_p.item_id, v_p.id)
      on conflict (device_key, avatar_id) do nothing;
    if v_p.player_id is not null then
      update public.players set avatar_id = v_p.item_id where id = v_p.player_id;
    end if;
  end if;
end;
$function$;
grant execute on function public.complete_purchase(uuid, text, boolean, text, text, boolean, text) to anon, authenticated;
