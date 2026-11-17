-- Core bookstore schema for the empty Ecommerce_system project.
-- Product/customer/order records are intentionally not seeded with demo data.

create extension if not exists pgcrypto with schema extensions;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  phone text,
  role text not null default 'customer' check (role in ('customer', 'admin')),
  admin_username text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index profiles_email_lower_uq on public.profiles (lower(email));
create unique index profiles_admin_username_lower_uq on public.profiles (lower(admin_username)) where admin_username is not null;

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.categories (name, slug, sort_order) values
  ('Biology', 'biology', 1),
  ('Chemistry', 'chemistry', 2),
  ('Physics', 'physics', 3),
  ('Arabic', 'arabic', 4),
  ('Mathematics', 'mathematics', 5),
  ('Computer Science & IT', 'computer-science-it', 6),
  ('Cybersecurity', 'cybersecurity', 7),
  ('Business & Humanities', 'business-humanities', 8)
on conflict (slug) do nothing;

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete restrict,
  title text not null,
  author text,
  isbn text,
  publisher text,
  publication_year integer,
  description text,
  price numeric(12,2) not null check (price >= 0),
  stock integer not null default 0 check (stock >= 0),
  average_rating numeric(3,2) not null default 0 check (average_rating between 0 and 5),
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_category_active_idx on public.products(category_id, is_active);
create index products_title_lower_idx on public.products(lower(title));

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  storage_path text,
  public_url text not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  check (storage_path is not null or public_url <> '')
);
create index product_images_product_idx on public.product_images(product_id);

create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, product_id)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  subtotal numeric(12,2) not null check (subtotal >= 0),
  delivery_fee numeric(12,2) not null default 0 check (delivery_fee >= 0),
  total numeric(12,2) not null check (total >= 0),
  delivery_type text not null,
  delivery_address text,
  status text not null default 'pending_payment' check (status in ('pending_payment', 'processing', 'shipped', 'delivered', 'cancelled')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'pending', 'paid', 'failed', 'refunded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_user_created_idx on public.orders(user_id, created_at desc);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  title_snapshot text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  created_at timestamptz not null default now()
);
create index order_items_order_idx on public.order_items(order_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  provider text not null,
  provider_reference text,
  amount numeric(12,2) not null check (amount >= 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'refunded')),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  unique(provider, provider_reference)
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  body text not null check (length(trim(body)) between 1 and 5000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(product_id, user_id)
);
create index reviews_product_status_idx on public.reviews(product_id, status);

create or replace function public.refresh_product_rating()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' or (tg_op = 'UPDATE' and old.product_id <> new.product_id) then
    update public.products p set average_rating = coalesce((
      select round(avg(r.rating)::numeric, 2) from public.reviews r
      where r.product_id = old.product_id and r.status = 'approved'
    ), 0) where p.id = old.product_id;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  update public.products p set average_rating = coalesce((
    select round(avg(r.rating)::numeric, 2) from public.reviews r
    where r.product_id = new.product_id and r.status = 'approved'
  ), 0) where p.id = new.product_id;
  return new;
end;
$$;
create trigger refresh_product_rating_after_review
  after insert or update or delete on public.reviews
  for each row execute function public.refresh_product_rating();

create table public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, product_id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null default '',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_created_idx on public.notifications(user_id, created_at desc);

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  );
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, phone)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'phone', '')
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(nullif(excluded.full_name, ''), public.profiles.full_name),
    phone = coalesce(excluded.phone, public.profiles.phone),
    updated_at = now();
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

create or replace function public.sync_auth_user_email()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email, updated_at = now() where id = new.id;
  end if;
  return new;
end;
$$;
create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row execute function public.sync_auth_user_email();

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger products_updated_at before update on public.products for each row execute function public.set_updated_at();
create trigger cart_items_updated_at before update on public.cart_items for each row execute function public.set_updated_at();
create trigger orders_updated_at before update on public.orders for each row execute function public.set_updated_at();
create trigger reviews_updated_at before update on public.reviews for each row execute function public.set_updated_at();

create or replace function public.place_order(
  p_items jsonb,
  p_delivery_type text,
  p_delivery_fee numeric default 0,
  p_delivery_address text default null
)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_delivery_fee numeric(12,2);
  v_subtotal numeric(12,2) := 0;
  v_order_id uuid;
  v_line record;
  v_product public.products%rowtype;
begin
  if v_user_id is null then raise exception 'Sign in before placing an order.'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 50 then
    raise exception 'Your cart is empty or contains too many items.';
  end if;
  if p_delivery_type = 'Pickup at Store' then v_delivery_fee := 0;
  elsif p_delivery_type = 'Home Delivery (Mombasa)' then v_delivery_fee := 500;
  elsif p_delivery_type = 'Express Delivery (24hrs)' then v_delivery_fee := 1500;
  else raise exception 'Choose a valid delivery option.';
  end if;
  if v_delivery_fee > 0 and length(trim(coalesce(p_delivery_address, ''))) < 5 then
    raise exception 'Enter a complete delivery location.';
  end if;

  for v_line in
    select x.product_id, sum(x.quantity)::integer as quantity
    from jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer)
    group by x.product_id order by x.product_id
  loop
    if v_line.product_id is null or v_line.quantity is null or v_line.quantity < 1 then
      raise exception 'Invalid cart item.';
    end if;
    select * into v_product from public.products
      where id = v_line.product_id and is_active = true for update;
    if not found then raise exception 'A selected book is no longer available.'; end if;
    if v_product.stock < v_line.quantity then raise exception 'Not enough stock for "%".', v_product.title; end if;
    v_subtotal := v_subtotal + v_product.price * v_line.quantity;
  end loop;

  insert into public.orders (user_id, subtotal, delivery_fee, total, delivery_type, delivery_address)
  values (v_user_id, v_subtotal, v_delivery_fee, v_subtotal + v_delivery_fee, p_delivery_type, nullif(trim(p_delivery_address), ''))
  returning id into v_order_id;

  for v_line in
    select x.product_id, sum(x.quantity)::integer as quantity
    from jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer)
    group by x.product_id order by x.product_id
  loop
    select * into v_product from public.products where id = v_line.product_id for update;
    insert into public.order_items (order_id, product_id, title_snapshot, quantity, unit_price)
    values (v_order_id, v_product.id, v_product.title, v_line.quantity, v_product.price);
    update public.products set stock = stock - v_line.quantity where id = v_product.id;
    delete from public.cart_items where user_id = v_user_id and product_id = v_product.id;
  end loop;

  return jsonb_build_object('order_id', v_order_id, 'total', v_subtotal + v_delivery_fee, 'payment_status', 'unpaid');
end;
$$;
revoke all on function public.place_order(jsonb, text, numeric, text) from public;
grant execute on function public.place_order(jsonb, text, numeric, text) to authenticated;

create or replace view public.admin_customer_summary with (security_invoker = true) as
select p.id, p.full_name, p.email, p.phone, coalesce(o.order_count, 0)::bigint as order_count,
       o.last_order, o.delivery_address
from public.profiles p
left join lateral (
  select count(*) as order_count, max(created_at) as last_order,
         (array_agg(delivery_address order by created_at desc) filter (where delivery_address is not null))[1] as delivery_address
  from public.orders where user_id = p.id
) o on true
where p.role = 'customer';

create or replace view public.sales_report with (security_invoker = true) as
select date_trunc('day', verified_at)::date as sale_day,
       count(*)::bigint as transaction_count,
       sum(amount)::numeric(12,2) as total_amount
from public.payments
where status = 'paid' and verified_at is not null
group by date_trunc('day', verified_at)::date;

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.cart_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.reviews enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.notifications enable row level security;

create policy profiles_read_own_or_admin on public.profiles for select to authenticated using (id = (select auth.uid()) or (select public.is_admin()));
create policy profiles_admin_update on public.profiles for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy categories_public_read on public.categories for select to anon, authenticated using (is_active or (select public.is_admin()));
create policy categories_admin_insert on public.categories for insert to authenticated with check ((select public.is_admin()));
create policy categories_admin_update on public.categories for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy categories_admin_delete on public.categories for delete to authenticated using ((select public.is_admin()));

create policy products_public_read on public.products for select to anon, authenticated using (is_active or (select public.is_admin()));
create policy products_admin_insert on public.products for insert to authenticated with check ((select public.is_admin()));
create policy products_admin_update on public.products for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy products_admin_delete on public.products for delete to authenticated using ((select public.is_admin()));

create policy product_images_public_read on public.product_images for select to anon, authenticated using (true);
create policy product_images_admin_insert on public.product_images for insert to authenticated with check ((select public.is_admin()));
create policy product_images_admin_update on public.product_images for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy product_images_admin_delete on public.product_images for delete to authenticated using ((select public.is_admin()));

create policy cart_items_own_all on public.cart_items for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy orders_read_own_or_admin on public.orders for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy orders_admin_update on public.orders for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy order_items_read_own_or_admin on public.order_items for select to authenticated using (
  exists (select 1 from public.orders o where o.id = order_id and (o.user_id = (select auth.uid()) or (select public.is_admin())))
);
create policy order_items_admin_all on public.order_items for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy payments_read_own_or_admin on public.payments for select to authenticated using (
  exists (select 1 from public.orders o where o.id = order_id and (o.user_id = (select auth.uid()) or (select public.is_admin())))
);
create policy reviews_public_approved_read on public.reviews for select to anon, authenticated using (status = 'approved' or user_id = (select auth.uid()) or (select public.is_admin()));
create policy reviews_own_insert on public.reviews for insert to authenticated with check (user_id = (select auth.uid()) and status = 'pending');
create policy reviews_admin_update on public.reviews for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy reviews_admin_delete on public.reviews for delete to authenticated using ((select public.is_admin()));
create policy wishlist_items_own_all on public.wishlist_items for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notifications_read_own on public.notifications for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy notifications_update_own on public.notifications for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant usage on schema public to anon, authenticated;
grant select on public.categories, public.products, public.product_images to anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.cart_items, public.wishlist_items to authenticated;
grant select, insert, update, delete on public.categories, public.products, public.product_images to authenticated;
grant select, update (status) on public.orders to authenticated;
grant select on public.order_items, public.payments to authenticated;
grant select, insert, update, delete on public.reviews to authenticated;
grant select on public.admin_customer_summary, public.sales_report to authenticated;
grant select, update (read_at) on public.notifications to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('book-covers', 'book-covers', true, 10485760, array['image/jpeg','image/png','image/webp']::text[])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy readers_corner_book_covers_public_read on storage.objects for select to anon, authenticated using (bucket_id = 'book-covers');
create policy readers_corner_book_covers_admin_insert on storage.objects for insert to authenticated with check (bucket_id = 'book-covers' and (select public.is_admin()));
create policy readers_corner_book_covers_admin_update on storage.objects for update to authenticated using (bucket_id = 'book-covers' and (select public.is_admin())) with check (bucket_id = 'book-covers' and (select public.is_admin()));
create policy readers_corner_book_covers_admin_delete on storage.objects for delete to authenticated using (bucket_id = 'book-covers' and (select public.is_admin()));

