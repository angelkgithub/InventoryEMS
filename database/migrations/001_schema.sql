-- =====================================================================
-- Inventory system: schema, security (RLS), and atomic stock functions
-- Run this ONCE in the Supabase SQL Editor (see README.md).
-- =====================================================================

-- ---------- Tables ----------------------------------------------------

create table if not exists public.admin_users (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  role       text not null default 'admin' check (role in ('admin')),
  name       text,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id                  uuid primary key default gen_random_uuid(),
  product_name        text not null check (char_length(btrim(product_name)) > 0),
  sku                 text,
  category            text,
  inventory           integer not null default 0 check (inventory >= 0),
  low_stock_threshold integer not null default 5 check (low_stock_threshold >= 0),
  active              boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table if not exists public.inventory_transactions (
  id                uuid primary key default gen_random_uuid(),
  product_id        uuid not null references public.products (id) on delete restrict,
  previous_quantity integer not null check (previous_quantity >= 0),
  quantity_change   integer not null,
  new_quantity      integer not null check (new_quantity >= 0),
  transaction_type  text not null
    check (transaction_type in ('stock_added', 'stock_removed', 'manual_adjustment', 'initial_stock')),
  note              text,
  created_by        uuid,           -- auth user id of the admin (kept even if the admin is removed)
  created_by_name   text,           -- snapshot of the admin's name for the history page
  created_at        timestamptz not null default now(),
  constraint transaction_math check (new_quantity = previous_quantity + quantity_change)
);

-- ---------- Indexes ---------------------------------------------------

create index if not exists products_name_idx     on public.products (product_name);
create index if not exists products_sku_idx      on public.products (sku);
create index if not exists products_active_idx   on public.products (active);
create index if not exists products_category_idx on public.products (category);
create index if not exists products_updated_idx  on public.products (updated_at desc);
create index if not exists transactions_created_idx on public.inventory_transactions (created_at desc);
create index if not exists transactions_product_idx on public.inventory_transactions (product_id, created_at desc);

-- ---------- Triggers --------------------------------------------------

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- Inventory may ONLY change through adjust_inventory() (which logs history).
create or replace function public.guard_inventory_column()
returns trigger language plpgsql as $$
begin
  if new.inventory is distinct from old.inventory
     and coalesce(current_setting('app.allow_inventory_write', true), '') <> 'on' then
    raise exception 'Inventory can only be changed through adjust_inventory()' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists products_guard_inventory on public.products;
create trigger products_guard_inventory
  before update on public.products
  for each row execute function public.guard_inventory_column();

-- History can never be edited or deleted.
create or replace function public.block_history_changes()
returns trigger language plpgsql as $$
begin
  raise exception 'Inventory history cannot be changed' using errcode = '42501';
end $$;

drop trigger if exists transactions_immutable on public.inventory_transactions;
create trigger transactions_immutable
  before update or delete on public.inventory_transactions
  for each row execute function public.block_history_changes();

-- ---------- Admin check -----------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users
    where user_id = auth.uid() and role = 'admin'
  );
$$;

-- ---------- Row Level Security ---------------------------------------

alter table public.admin_users            enable row level security;
alter table public.products               enable row level security;
alter table public.inventory_transactions enable row level security;

drop policy if exists "admins read admin_users" on public.admin_users;
create policy "admins read admin_users" on public.admin_users
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists "admins read products" on public.products;
create policy "admins read products" on public.products
  for select to authenticated using (public.is_admin());

drop policy if exists "admins update products" on public.products;
create policy "admins update products" on public.products
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins read history" on public.inventory_transactions;
create policy "admins read history" on public.inventory_transactions
  for select to authenticated using (public.is_admin());

-- No insert/delete policies exist on purpose: rows are created only by the
-- functions below, and nothing can ever be deleted through the API.

-- ---------- Table privileges (defence in depth) ------------------------

revoke all on public.admin_users, public.products, public.inventory_transactions from public, anon, authenticated;

grant select on public.admin_users, public.products, public.inventory_transactions to authenticated;
-- Admins may edit descriptive fields directly; `inventory` is deliberately NOT listed.
grant update (product_name, sku, category, low_stock_threshold, active) on public.products to authenticated;

-- ---------- What employees (anonymous visitors) can see ---------------
-- A read-only view with only the columns needed for the employee page,
-- and only active products. No IDs, no history, no admin data.

create or replace view public.employee_inventory as
  select product_name, sku, category, inventory, low_stock_threshold, updated_at
  from public.products
  where active = true;

revoke all on public.employee_inventory from public, anon, authenticated;
grant select on public.employee_inventory to anon, authenticated;

-- ---------- Atomic stock adjustment -----------------------------------
-- p_action: 'add' | 'remove' | 'set'.  The math happens inside the
-- database while the product row is locked, so simultaneous updates
-- can never overwrite each other and stock can never go below zero.

create or replace function public.adjust_inventory(
  p_product_id uuid,
  p_action     text,
  p_quantity   integer,
  p_note       text default null
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_prev   integer;
  v_new    integer;
  v_change integer;
  v_type   text;
  v_name   text;
  v_tx     uuid;
  v_time   timestamptz;
begin
  if v_uid is null or not public.is_admin() then
    raise exception 'NOT_AUTHORIZED' using errcode = '42501';
  end if;

  if p_action is null or p_action not in ('add', 'remove', 'set')
     or p_quantity is null or p_quantity < 0 or p_quantity > 1000000
     or (p_action in ('add', 'remove') and p_quantity < 1) then
    raise exception 'INVALID_INPUT' using errcode = '22023';
  end if;

  select inventory into v_prev from public.products where id = p_product_id for update;
  if not found then
    raise exception 'PRODUCT_NOT_FOUND' using errcode = 'P0002';
  end if;

  if p_action = 'add' then
    v_new := v_prev + p_quantity;  v_type := 'stock_added';
  elsif p_action = 'remove' then
    v_new := v_prev - p_quantity;  v_type := 'stock_removed';
  else
    v_new := p_quantity;           v_type := 'manual_adjustment';
  end if;

  if v_new < 0 then
    raise exception 'STOCK_BELOW_ZERO' using errcode = '23514';
  end if;
  v_change := v_new - v_prev;
  if v_change = 0 then
    raise exception 'NO_CHANGE' using errcode = '22023';
  end if;

  perform set_config('app.allow_inventory_write', 'on', true);
  update public.products set inventory = v_new where id = p_product_id
    returning updated_at into v_time;
  perform set_config('app.allow_inventory_write', 'off', true);

  select coalesce(nullif(btrim(name), ''), 'Admin') into v_name
    from public.admin_users where user_id = v_uid;

  insert into public.inventory_transactions
    (product_id, previous_quantity, quantity_change, new_quantity,
     transaction_type, note, created_by, created_by_name)
  values
    (p_product_id, v_prev, v_change, v_new, v_type,
     nullif(btrim(p_note), ''), v_uid, coalesce(v_name, 'Admin'))
  returning id into v_tx;

  return jsonb_build_object(
    'product_id', p_product_id,
    'previous_quantity', v_prev,
    'quantity_change', v_change,
    'new_quantity', v_new,
    'updated_at', v_time,
    'transaction_id', v_tx
  );
end $$;

-- ---------- Create product (with history for the starting stock) -------

create or replace function public.create_product(
  p_name      text,
  p_sku       text,
  p_category  text,
  p_inventory integer,
  p_threshold integer
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_id   uuid;
  v_name text;
begin
  if v_uid is null or not public.is_admin() then
    raise exception 'NOT_AUTHORIZED' using errcode = '42501';
  end if;

  if p_name is null or char_length(btrim(p_name)) = 0
     or p_inventory is null or p_inventory < 0 or p_inventory > 1000000
     or p_threshold is null or p_threshold < 0 or p_threshold > 1000000 then
    raise exception 'INVALID_INPUT' using errcode = '22023';
  end if;

  insert into public.products (product_name, sku, category, inventory, low_stock_threshold)
  values (btrim(p_name), nullif(btrim(p_sku), ''), nullif(btrim(p_category), ''), p_inventory, p_threshold)
  returning id into v_id;

  if p_inventory > 0 then
    select coalesce(nullif(btrim(name), ''), 'Admin') into v_name
      from public.admin_users where user_id = v_uid;

    insert into public.inventory_transactions
      (product_id, previous_quantity, quantity_change, new_quantity,
       transaction_type, note, created_by, created_by_name)
    values
      (v_id, 0, p_inventory, p_inventory, 'initial_stock', 'Starting inventory', v_uid, coalesce(v_name, 'Admin'));
  end if;

  return jsonb_build_object('product_id', v_id);
end $$;

-- Only signed-in users may call these (and they re-check is_admin() inside).
revoke all on function public.is_admin()        from public, anon;
revoke all on function public.adjust_inventory(uuid, text, integer, text) from public, anon;
revoke all on function public.create_product(text, text, text, integer, integer) from public, anon;
grant execute on function public.is_admin()        to authenticated;
grant execute on function public.adjust_inventory(uuid, text, integer, text) to authenticated;
grant execute on function public.create_product(text, text, text, integer, integer) to authenticated;
