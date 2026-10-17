alter table public.listings add column inactive_since timestamptz;
-- Historical unpublication times were not recorded. Give existing records a full grace period.
update public.listings set inactive_since=now() where is_active is not true;
create function public.track_listing_inactivity() returns trigger language plpgsql set search_path='' as $$
begin
 if new.is_active then new.inactive_since=null;
 elsif tg_op='INSERT' then new.inactive_since=now();
 elsif old.is_active is true or old.inactive_since is null then new.inactive_since=now();
 else new.inactive_since=old.inactive_since;
 end if;return new;
end $$;
revoke all on function public.track_listing_inactivity() from public,anon,authenticated;
grant execute on function public.track_listing_inactivity() to service_role;
create trigger listing_inactivity_clock before insert or update on public.listings for each row execute function public.track_listing_inactivity();
create index listings_inactive_cleanup on public.listings(inactive_since) where is_active is not true;
create table public.listing_photo_cleanup(photo_url text primary key,created_at timestamptz not null default now());
alter table public.listing_photo_cleanup enable row level security;
revoke all on public.listing_photo_cleanup from public,anon,authenticated;
grant all on public.listing_photo_cleanup to service_role;
create function public.purge_inactive_listings(p_limit integer default 100) returns integer language plpgsql set search_path='' as $$
declare item public.listings;total integer:=0;
begin
 for item in select * from public.listings where is_active is not true and inactive_since<now()-interval '7 days' order by inactive_since,id limit greatest(1,least(p_limit,100)) for update skip locked loop
  insert into public.listing_photo_cleanup(photo_url) select distinct unnest(item.images) on conflict do nothing;
  delete from public.reports where listing_id=item.id;
  delete from public.listings where id=item.id;
  total:=total+1;
 end loop;
 return total;
end $$;
revoke all on function public.purge_inactive_listings(integer) from public,anon,authenticated;
grant execute on function public.purge_inactive_listings(integer) to service_role;
