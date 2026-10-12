begin;
create table public.listing_management_keys (
  listing_id uuid primary key references public.listings(id) on delete cascade,
  key_hash text not null check (key_hash ~ '^[0-9a-f]{64}$'),
  removed_at timestamptz
);
alter table public.listing_management_keys enable row level security;
revoke all on public.listing_management_keys from public, anon, authenticated;
grant all on public.listing_management_keys to service_role;
create function public.submit_managed_listing(p_listing jsonb, p_email text, p_management_hash text) returns uuid
language plpgsql set search_path = '' as $$
declare new_id uuid;
begin
  new_id := public.submit_listing_with_owner(p_listing, p_email);
  insert into public.listing_management_keys(listing_id,key_hash) values(new_id,p_management_hash);
  return new_id;
end $$;
create function public.remove_owned_listing(p_listing uuid, p_management_hash text) returns boolean
language plpgsql set search_path = '' as $$
declare matching public.listing_management_keys;
begin
  select * into matching from public.listing_management_keys where listing_id=p_listing and key_hash=p_management_hash for update;
  if not found then return false; end if;
  if matching.removed_at is not null then return true; end if;
  update public.listings set is_active=false,moderation_status='rejected' where id=p_listing;
  update public.listing_management_keys set removed_at=now() where listing_id=p_listing;
  delete from public.listing_owner_contacts where listing_id=p_listing;
  return true;
end $$;
revoke all on function public.submit_managed_listing(jsonb,text,text),public.remove_owned_listing(uuid,text) from public, anon, authenticated;
grant execute on function public.submit_managed_listing(jsonb,text,text),public.remove_owned_listing(uuid,text) to service_role;
commit;
