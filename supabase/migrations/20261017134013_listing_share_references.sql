alter table public.listings add column listing_number bigint generated always as identity;
alter table public.listings add constraint listings_number_unique unique(listing_number);
alter table public.listings add column listing_ref text generated always as ('TO-'||lpad(listing_number::text,greatest(6,length(listing_number::text)),'0')) stored;
alter table public.listings add constraint listings_ref_unique unique(listing_ref);
grant usage,select on sequence public.listings_listing_number_seq to service_role;
create function public.keep_listing_reference() returns trigger language plpgsql set search_path='' as $$
begin
 if new.listing_number is distinct from old.listing_number then raise exception 'Listing reference cannot be changed';end if;
 return new;
end $$;
revoke all on function public.keep_listing_reference() from public,anon,authenticated;
grant execute on function public.keep_listing_reference() to service_role;
create trigger listing_reference_immutable before update of listing_number on public.listings for each row execute function public.keep_listing_reference();
