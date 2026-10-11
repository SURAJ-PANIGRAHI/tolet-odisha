begin;
create or replace function public.submit_listing_with_owner(p_listing jsonb, p_email text) returns uuid
language plpgsql set search_path = '' as $$
declare new_id uuid; deadline timestamptz;
begin
  insert into public.listings(title, description, category, rent_monthly, deposit, district, locality, landmark, contact_name, contact_phone, whatsapp_number, amenities, images, is_active, is_featured, moderation_status)
  values(p_listing->>'title', p_listing->>'description', p_listing->>'category', (p_listing->>'rent_monthly')::integer, (p_listing->>'deposit')::integer, p_listing->>'district', p_listing->>'locality', p_listing->>'landmark', p_listing->>'contact_name', p_listing->>'contact_phone', p_listing->>'whatsapp_number', array(select jsonb_array_elements_text(p_listing->'amenities')), array(select jsonb_array_elements_text(p_listing->'images')), false, false, 'pending')
  returning id, expires_at into new_id, deadline;
  p_email := nullif(btrim(p_email), '');
  if p_email is not null then
  insert into public.listing_owner_contacts(listing_id, email, cycle) values(new_id, p_email, deadline);
  insert into public.notification_jobs(dedupe_key, listing_id, kind, recipient, cycle, subject, body)
    values('verify:' || new_id, new_id, 'verify', p_email, deadline, 'Confirm your ToLet Odisha listing email', 'Confirm this email address for your listing. Your listing requires administrator approval and expires after 30 days. If you did not submit a listing, ignore this email.');
  end if;
  return new_id;
end $$;

commit;
