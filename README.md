# Reader’s Corner Bookstore

Static multi-page storefront with Supabase Auth, PostgreSQL, Storage and Vercel Functions.

## Local development

1. Copy `.env.example` to `.env.local` and fill in `SUPABASE_PUBLISHABLE_KEY`.
2. Keep `SUPABASE_SECRET_KEY` server-side only. Never add it to a `VITE_*` variable or browser code.
3. Run `npm install`, then `npm run dev`.

Production builds run with `npm run build`. The `/shop`, `/admin`, and `/orders` routes resolve to the existing page files.

## Supabase setup

Migrations live in `supabase/migrations`. They create the bookstore tables and RLS policies without seeding sample products, orders, buyers, or reviews. Categories are added as navigation data only.

The first administrator must be provisioned outside the public site. Create/invite the chosen user in Supabase Auth, then run a targeted SQL update for that exact email in the SQL Editor:

```sql
update public.profiles
set role = 'admin', admin_username = 'YOUR_ADMIN_USERNAME'
where lower(email) = lower('YOUR_ADMIN_EMAIL')
returning id, email, role, admin_username;
```

Confirm exactly one expected account is returned. Do not add an admin registration form to the public site.

## Customer accounts and checkout

Customer accounts use Supabase Auth; the database trigger creates each profile from the authenticated user metadata. Password reset links return to the login page, where customers set a new password. The storefront provides a Supabase sign-out action for signed-in customers.

Cart contents are stored in `cart_items` for the authenticated user. Checkout calls the `place_order` database function, which locks and validates those cart rows, checks current product stock and prices, creates the order and line items, decrements stock, and clears the cart in one transaction. A second checkout request after the first commits cannot create a duplicate order from the cleared cart.

## Payment status

Checkout creates an order with `payment_status = 'unpaid'`. No payment gateway is configured in this project, so the app does not claim a payment succeeded. The sales report only counts payments that have a provider-verified `verified_at` value and `paid` status.
