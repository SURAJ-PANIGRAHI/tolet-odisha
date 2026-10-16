alter table public.listings drop constraint listings_category_check;
alter table public.listings add constraint listings_category_check check (category in ('Boys Mess','Boys Hostel','Girls Hostel','Ladies Mess','Paying Guest (PG)','Bachelor Room','1 BHK Flat','2 BHK Flat','Family House','Commercial / Shop','Tutor / Tuition'));
