alter table public.listings add constraint listings_nonnegative_amounts check (rent_monthly>=0 and deposit>=0);
