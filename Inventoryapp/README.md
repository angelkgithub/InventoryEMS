# Inventory

A simple inventory system for a medical/pharmaceutical supply business.

- **Employees** open the website and see a read-only, searchable inventory list. No login.
- **The admin** signs in at `/admin` to change stock, add/edit/archive products, and see the full history.
- Built with Next.js (App Router), TypeScript, Tailwind CSS, Supabase (PostgreSQL + Auth) and Zod. Deploys on Vercel.

| Page | Who | What |
| --- | --- | --- |
| `/` | Everyone | Read-only inventory, search, filters |
| `/admin/login` | Admin | Sign in |
| `/admin` | Admin | Greeting, four summary cards, inventory table with **[-] 57 [+]** |
| `/admin/inventory` | Admin | Same table, without the summary cards |
| `/admin/history` | Admin | Every stock change, newest first |

---

## Setup (about 15 minutes)

### 1. Create the Supabase project
1. Go to <https://supabase.com>, sign in, and click **New project**.
2. Pick a name, a strong database password (save it somewhere safe) and a region near you.
3. Wait until the project finishes starting.
4. **Authentication > Sign In / Providers**: turn **off** "Allow new users to sign up" (only you should be able to create accounts).

### 2. Run the SQL migration
1. In Supabase, open **SQL Editor > New query**.
2. Open [`database/migrations/001_schema.sql`](database/migrations/001_schema.sql), copy everything, paste it in, and click **Run**.
   You should see "Success. No rows returned".

### 3. Load the starting inventory
1. New query again. Paste the contents of [`database/seed/002_seed_inventory.sql`](database/seed/002_seed_inventory.sql) and click **Run**.
2. Open **Table Editor > products**. You should see **237 products**.
   The seed is safe to run twice: it does nothing if products already exist.

### 4. Create the first admin account
1. **Authentication > Users > Add user > Create new user.** Enter the admin's email and a strong password. Tick **Auto Confirm User**.
2. Back in the **SQL Editor**, run this (change the email and name):

   ```sql
   insert into public.admin_users (user_id, name)
   select id, 'Admin Name' from auth.users where email = 'admin@example.com';
   ```

   The name appears in the History page. A user who is not in `admin_users` cannot sign in to the admin area and cannot change anything, even if they know the password.

### 5. Environment variables
Copy `.env.example` to `.env.local` and fill it in from Supabase **Project Settings > API**:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your anon / publishable key
```

The anon key is meant to be public; the database's Row Level Security decides what it can do.
**This app does not use the service-role key. Never put it in this project.**

### 6. Run locally
```
npm install
npm run dev
```
Open <http://localhost:3000> (employee view) and <http://localhost:3000/admin> (admin).

### 7. Deploy to Vercel
1. Put this folder in a GitHub repository.
2. On <https://vercel.com>: **Add New > Project**, import the repository. Framework is detected automatically (Next.js).
3. Under **Environment Variables** add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (same values as above).
4. Click **Deploy**.

### 8. Connect Vercel to Supabase
Nothing else is needed: the two environment variables *are* the connection. If you change them later, redeploy
(Vercel > Deployments > Redeploy) because they are baked in at build time.
Optional: in Supabase **Authentication > URL Configuration**, set **Site URL** to your Vercel address.

Bookmark your Vercel address for employees. Employees never see the admin login; there is only a small "Admin" link in the footer.

---

## How it works

**Stock changes are atomic and always logged.** The browser never sends an old or new total. It sends "add 1", "remove 5" or "set to 40" to a server action, which validates it with Zod, checks the admin session, and calls the database function `adjust_inventory`. That function locks the product row, does the math inside PostgreSQL, refuses to go below zero, updates the stock and writes the history row in one transaction. Two quick clicks can never overwrite each other.

**Security is enforced by the database, not by hidden buttons.**
- Row Level Security is on for every table. Only signed-in users listed in `admin_users` can read products or history.
- Anonymous visitors can only read a view called `employee_inventory` (name, SKU/NDC, category, stock, threshold, last updated; active products only). No IDs, no history, no admin data.
- Nobody, including the admin through the API, can write the `inventory` column directly, edit or delete history, or hard-delete products. Products are archived instead.
- `/admin/*` is protected by the Next.js proxy, again by the admin layout, again by every server action, and finally by the database.

**Fresh data for employees.** The employee page re-checks the database every 30 seconds, when the browser tab is reopened, and when the Refresh button is pressed. It is never cached. (Supabase Realtime was deliberately not used; polling is simpler and dependable for a list this size.)

**Status rules.** 0 = OUT OF STOCK. 1 up to the product's "Low Stock Alert At" number (default 5) = LOW STOCK. Above that = IN STOCK. Status is always shown as words and an icon, not just color.

### Everyday use (admin)
1. Sign in. Type part of a name in the search box (for example `Mounjaro 5 mg`).
2. Press **+** or **-** to change by 1. A message appears with an **Undo** button.
3. Click the number itself to type an exact amount (you will be asked to confirm with "Update Stock").
4. **Adjust Stock** adds/removes/sets a quantity with a note such as "New shipment". **Add Product** and **Edit** are on the same page. **Edit > Archive Product** hides a product from employees; tick "Show archived products" to find it and **Restore** it.
5. **Export CSV** and **Print** are on the same page. **History** shows every change.

---

## Starting inventory (from the two screenshots)

The transcribed list is in [`database/seed/inventory-source.txt`](database/seed/inventory-source.txt) and the seed SQL is generated from it with `npm run seed:generate`, which also prints a check report.

- **237 products, 3,347 total units, 38 products with 0 stock** (all included).
- Row counts checked per screenshot section: left/middle/right columns and the green table on screenshot 1 (42 / 42 / 20 / 21), and the left, middle columns and the yellow Inhalers table on screenshot 2 (42 / 33 / 37).
- `mint` / `ding` versions, dosages, package sizes and different NDCs are all separate products. Nothing was merged.
- Names are kept as written. Only obvious typing slips were cleaned: stray `)` characters (`Insulin Lispro (vials) )100 units/ml`, `Kerendia 20mg 30ct)`), and `Arnuity 200mg` was left as shown.
- Things in the source sheets you may want to tidy in the app (I did not guess):
  - **`Humalog KwikPen 200 units/ml` appears twice** (45 and 3), so both were kept as separate rows; the second is probably a "ding" version. Use **Edit** to rename it.
  - `veozah 45mg 30ct` (0) and `Veozah 45mg 30ct` (3) differ only by capitalization; `vraylar .75mg 30ct` and `VRAYLAR 0.75mg 30ct` look similar. Both pairs were kept.
  - `Vryalar` (sic) is spelled that way in the sheet. `Ozempic 1.5mg / 4mg / 9mg 30ct` (screenshot 2) were kept as written.
- NDC numbers found in names were also copied into the SKU/NDC field so they can be searched.
- Categories: GLP-1, Diabetes, Inhalers, Cardiovascular, Gastrointestinal, Dermatology, or Other when not certain (Restasis, biologics, psychiatric/migraine drugs, etc. are "Other"). The employee page's "Other" button shows every category that is not GLP-1, Diabetes or Inhalers.

---

## Project layout

```
app/                 pages (employee /, admin/*), server actions, /api/inventory (public, read-only)
components/          inventory/ (employee + shared list), admin/, ui/ (button, modal, toast...)
lib/supabase/        server-side Supabase clients (no service-role key anywhere)
lib/validation/      Zod schemas
lib/inventory/       status rules, search/sort, CSV, error messages, queries
database/migrations/ 001_schema.sql   (tables, RLS, functions)
database/seed/       inventory-source.txt and generated 002_seed_inventory.sql
scripts/             generate-seed.mjs, test-database.mjs
proxy.ts             session refresh + /admin redirect
```

## Checks

```
npm run typecheck     # TypeScript
npm run build         # production build
npm run test:db       # runs the real SQL in an in-memory Postgres: seed counts, RLS, atomic math, history, permissions
```

## Troubleshooting
- **"Incorrect email or password"**: check the user exists in Authentication > Users and is confirmed.
- **"This account does not have admin access"**: run the `insert into public.admin_users ...` step.
- **Employee page says it cannot load inventory**: check the two environment variables and that the migration ran.
