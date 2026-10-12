begin;
alter table public.listing_management_keys add column verified_user uuid references auth.users(id);
alter table public.listings add column phone_verified_at timestamptz;
create function public.submit_phone_verified_listing(p_listing jsonb, p_email text, p_management_hash text, p_user uuid, p_verified_phone text) returns uuid
language plpgsql set search_path = '' as $$
declare new_id uuid;
begin
  -- Only the server/service role may call this, after Auth getUser verifies the JWT.
  if p_user is null or p_verified_phone is null or p_verified_phone <> '+91' || (p_listing->>'contact_phone') then
    raise exception 'Verified phone does not match listing';
  end if;
  new_id := public.submit_managed_listing(p_listing,p_email,p_management_hash);
  update public.listings set moderation_status='approved',is_active=true,phone_verified_at=now() where id=new_id;
  update public.listing_management_keys set verified_user=p_user where listing_id=new_id;
  update public.notification_jobs set body='Confirm this email address for your ToLet Odisha listing. Your listing is live after phone verification and expires after 30 days. Verified email addresses receive a reminder three days before expiry. If you did not submit a listing, ignore this email.' where listing_id=new_id and kind='verify';
  return new_id;
end $$;
revoke all on function public.submit_phone_verified_listing(jsonb,text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.submit_phone_verified_listing(jsonb,text,text,uuid,text) to service_role;
commit;
