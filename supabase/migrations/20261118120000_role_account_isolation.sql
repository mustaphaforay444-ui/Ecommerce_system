-- Separate customer, seller, and administrator accounts.
-- Public sign-up still creates customers only; seller accounts are provisioned by the site owner.

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('customer', 'seller', 'admin'));

-- Each account can read its own profile. Admins can see customer contact details required
-- for bookstore orders and support, but cannot read other admin or seller profiles.
drop policy if exists profiles_read_own_or_admin on public.profiles;
create policy profiles_read_own_or_customer_admin on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or ((select public.is_admin()) and role = 'customer'));

-- Profile role and email are never editable through the public API, including by admins.
-- Admins, sellers, and customers can only update their own name and phone.
drop policy if exists profiles_admin_update on public.profiles;
drop policy if exists profiles_customer_update_own on public.profiles;
drop policy if exists profiles_update_own_account on public.profiles;
create policy profiles_update_own_account on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) and role in ('customer', 'seller', 'admin'))
  with check (id = (select auth.uid()) and role in ('customer', 'seller', 'admin'));
revoke update on public.profiles from authenticated;
revoke update (id, email, role, admin_username, created_at, updated_at) on public.profiles from authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

-- Only customer accounts can use customer support threads. Sellers cannot impersonate a customer.
drop policy if exists customer_messages_read_thread on public.customer_messages;
create policy customer_messages_read_thread on public.customer_messages
  for select to authenticated
  using ((customer_id = (select auth.uid()) and exists (
    select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'customer'
  )) or (select public.is_admin()));

drop policy if exists customer_messages_customer_insert on public.customer_messages;
create policy customer_messages_customer_insert on public.customer_messages
  for insert to authenticated
  with check (customer_id = (select auth.uid()) and sender_id = (select auth.uid()) and exists (
    select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'customer'
  ));

drop policy if exists customer_messages_admin_insert on public.customer_messages;
create policy customer_messages_admin_insert on public.customer_messages
  for insert to authenticated
  with check ((select public.is_admin()) and sender_id = (select auth.uid()) and exists (
    select 1 from public.profiles p where p.id = customer_id and p.role = 'customer'
  ));
