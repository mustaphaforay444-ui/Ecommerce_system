-- Seller sign-up always creates a pending application; only the admin RPC below can approve it.
alter table public.profiles
  add column if not exists seller_status text not null default 'not_applicable',
  add column if not exists seller_reviewed_at timestamptz,
  add column if not exists seller_reviewed_by uuid references public.profiles(id) on delete set null;

-- Previously provisioned sellers require review before they can sign in.
update public.profiles set seller_status = 'pending'
where role = 'seller' and seller_status = 'not_applicable';

alter table public.profiles drop constraint if exists profiles_seller_status_check;
alter table public.profiles add constraint profiles_seller_status_check
  check (seller_status in ('not_applicable', 'pending', 'approved', 'rejected'));
alter table public.profiles drop constraint if exists profiles_role_seller_status_check;
alter table public.profiles add constraint profiles_role_seller_status_check
  check ((role = 'seller' and seller_status in ('pending', 'approved', 'rejected'))
      or (role <> 'seller' and seller_status = 'not_applicable'));

-- The account type comes only from sign-up intent. User metadata can request seller review,
-- but it can never create an approved seller or administrator account.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_is_seller boolean := coalesce(new.raw_user_meta_data ->> 'account_type', '') = 'seller';
begin
  insert into public.profiles (id, email, full_name, phone, role, seller_status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    case when v_is_seller then 'seller' else 'customer' end,
    case when v_is_seller then 'pending' else 'not_applicable' end
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(nullif(excluded.full_name, ''), public.profiles.full_name),
    phone = coalesce(excluded.phone, public.profiles.phone),
    updated_at = now();
  return new;
end;
$$;

create or replace function public.seller_registration_enabled()
returns boolean
language sql immutable
set search_path = ''
as $$ select true $$;
revoke all on function public.seller_registration_enabled() from public;
grant execute on function public.seller_registration_enabled() to anon, authenticated;

-- Admins can screen customer and seller profiles; sellers still see only their own profile.
drop policy if exists profiles_read_own_or_customer_admin on public.profiles;
create policy profiles_read_own_or_customer_admin on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or ((select public.is_admin()) and role in ('customer', 'seller')));

create or replace function public.review_seller_application(p_seller_id uuid, p_decision text)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_role text;
  v_status text;
  v_profile record;
begin
  if not coalesce((select public.is_admin()), false) then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;
  if p_decision is null or p_decision not in ('approved', 'rejected') then
    raise exception 'Choose approve or reject.' using errcode = '22023';
  end if;

  select p.role, p.seller_status into v_role, v_status
  from public.profiles p where p.id = p_seller_id for update;
  if not found or v_role <> 'seller' or v_status <> 'pending' then
    raise exception 'This seller application is no longer pending.' using errcode = '22023';
  end if;

  update public.profiles
  set seller_status = p_decision,
      seller_reviewed_at = now(),
      seller_reviewed_by = (select auth.uid()),
      updated_at = now()
  where id = p_seller_id
  returning id, email, full_name, phone, role, seller_status, seller_reviewed_at
  into v_profile;

  return jsonb_build_object(
    'id', v_profile.id,
    'email', v_profile.email,
    'full_name', v_profile.full_name,
    'phone', v_profile.phone,
    'role', v_profile.role,
    'seller_status', v_profile.seller_status,
    'seller_reviewed_at', v_profile.seller_reviewed_at
  );
end;
$$;
revoke all on function public.review_seller_application(uuid, text) from public, anon;
grant execute on function public.review_seller_application(uuid, text) to authenticated;
