alter table public.orders add column if not exists requested_fulfillment_at timestamptz;

drop function if exists public.place_order(jsonb, text, numeric, text, timestamptz);
drop function if exists public.place_order(jsonb, text, numeric, text);
create function public.place_order(
  p_items jsonb,
  p_delivery_type text,
  p_delivery_fee numeric default 0,
  p_delivery_address text default null,
  p_requested_fulfillment_at timestamptz default null
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
  v_cart_items jsonb;
begin
  if v_user_id is null then raise exception 'Sign in before placing an order.'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 50 then
    raise exception 'Your cart is empty or contains too many items.';
  end if;
  if p_requested_fulfillment_at is not null and p_requested_fulfillment_at < now() then
    raise exception 'Choose a fulfilment time in the future.';
  end if;
  if p_delivery_type = 'Pickup at Store' then v_delivery_fee := 0;
  elsif p_delivery_type = 'Home Delivery (Mombasa)' then v_delivery_fee := 500;
  elsif p_delivery_type = 'Express Delivery (24hrs)' then v_delivery_fee := 1500;
  else raise exception 'Choose a valid delivery option.';
  end if;
  if v_delivery_fee > 0 and length(trim(coalesce(p_delivery_address, ''))) < 5 then
    raise exception 'Enter a complete delivery location.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('product_id', locked.product_id, 'quantity', locked.quantity) order by locked.product_id), '[]'::jsonb)
  into v_cart_items
  from (select ci.product_id, ci.quantity from public.cart_items ci where ci.user_id = v_user_id order by ci.product_id for update) locked;
  if jsonb_array_length(v_cart_items) = 0 then raise exception 'Your cart is empty or has already been checked out.'; end if;

  if exists (
    select 1 from (
      select requested.product_id, sum(requested.quantity)::integer as quantity
      from jsonb_to_recordset(p_items) as requested(product_id uuid, quantity integer) group by requested.product_id
    ) requested
    full join jsonb_to_recordset(v_cart_items) as actual(product_id uuid, quantity integer) using (product_id)
    where requested.product_id is null or actual.product_id is null or requested.quantity is distinct from actual.quantity
  ) then raise exception 'Your cart changed. Refresh it before placing the order.'; end if;

  for v_line in select item.product_id, item.quantity from jsonb_to_recordset(v_cart_items) as item(product_id uuid, quantity integer) order by item.product_id loop
    if v_line.product_id is null or v_line.quantity is null or v_line.quantity < 1 then raise exception 'Invalid cart item.'; end if;
    select * into v_product from public.products where id = v_line.product_id and is_active = true for update;
    if not found then raise exception 'A selected book is no longer available.'; end if;
    if v_product.stock < v_line.quantity then raise exception 'Not enough stock for "%".', v_product.title; end if;
    v_subtotal := v_subtotal + v_product.price * v_line.quantity;
  end loop;

  insert into public.orders (user_id, subtotal, delivery_fee, total, delivery_type, delivery_address, requested_fulfillment_at)
  values (v_user_id, v_subtotal, v_delivery_fee, v_subtotal + v_delivery_fee, p_delivery_type, nullif(trim(p_delivery_address), ''), p_requested_fulfillment_at)
  returning id into v_order_id;
  for v_line in select item.product_id, item.quantity from jsonb_to_recordset(v_cart_items) as item(product_id uuid, quantity integer) order by item.product_id loop
    select * into v_product from public.products where id = v_line.product_id for update;
    insert into public.order_items (order_id, product_id, title_snapshot, quantity, unit_price) values (v_order_id, v_product.id, v_product.title, v_line.quantity, v_product.price);
    update public.products set stock = stock - v_line.quantity where id = v_product.id;
    delete from public.cart_items where user_id = v_user_id and product_id = v_product.id;
  end loop;
  return jsonb_build_object('order_id', v_order_id, 'total', v_subtotal + v_delivery_fee, 'payment_status', 'unpaid');
end;
$$;
revoke all on function public.place_order(jsonb, text, numeric, text, timestamptz) from public;
grant execute on function public.place_order(jsonb, text, numeric, text, timestamptz) to authenticated;

create table if not exists public.customer_messages (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists customer_messages_thread_idx on public.customer_messages(customer_id, created_at);
alter table public.customer_messages enable row level security;
drop policy if exists customer_messages_read_thread on public.customer_messages;
create policy customer_messages_read_thread on public.customer_messages for select to authenticated
  using (customer_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists customer_messages_customer_insert on public.customer_messages;
create policy customer_messages_customer_insert on public.customer_messages for insert to authenticated
  with check (customer_id = (select auth.uid()) and sender_id = (select auth.uid()));
drop policy if exists customer_messages_admin_insert on public.customer_messages;
create policy customer_messages_admin_insert on public.customer_messages for insert to authenticated
  with check ((select public.is_admin()) and sender_id = (select auth.uid()) and exists (
    select 1 from public.profiles p where p.id = customer_id and p.role = 'customer'
  ));
grant select, insert on public.customer_messages to authenticated;

drop policy if exists profiles_customer_update_own on public.profiles;
create policy profiles_customer_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid()) and role = 'customer')
  with check (id = (select auth.uid()) and role = 'customer');

revoke update on public.profiles from authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'customer_messages') then
    alter publication supabase_realtime add table public.customer_messages;
  end if;
end $$;
