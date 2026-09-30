// Runs the real migration + seed against an in-memory Postgres (PGlite) with a tiny
// stand-in for Supabase's roles/auth, then checks security rules and stock maths.
//   npm run test:db
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");

const db = new PGlite();
await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema public, auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
`);
await db.exec(read("database/migrations/001_schema.sql"));
await db.exec(read("database/seed/002_seed_inventory.sql"));
await db.exec(read("database/seed/002_seed_inventory.sql")); // second run must be a no-op

const ADMIN = "11111111-1111-1111-1111-111111111111";
const OUTSIDER = "22222222-2222-2222-2222-222222222222";
await db.exec(`
  insert into auth.users (id, email) values ('${ADMIN}', 'admin@test'), ('${OUTSIDER}', 'other@test');
  insert into public.admin_users (user_id, name) values ('${ADMIN}', 'Test Admin');
`);

let passed = 0, failed = 0;
const check = (name, cond, extra = "") => {
  if (cond) passed++; else { failed++; console.error(`FAIL: ${name} ${extra}`); }
};

// Run SQL as a given role/user. Returns {rows} or {error}.
async function as(role, uid, sql) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid ?? ""}', false); set role ${role};`);
  try { return { rows: (await db.query(sql)).rows }; }
  catch (e) { return { error: String(e.message) }; }
  finally { await db.exec("reset role;"); }
}

// ---- seed checks ----
const total = (await db.query("select count(*)::int c, sum(inventory)::int s from public.products")).rows[0];
check("seed: 237 products (and second run added none)", total.c === 237, JSON.stringify(total));
check("seed: 3347 units", total.s === 3347, JSON.stringify(total));
const zero = (await db.query("select count(*)::int c from public.products where inventory = 0")).rows[0].c;
check("seed: 38 zero-stock products", zero === 38);
const spot = async (n) => (await db.query("select inventory from public.products where product_name = $1", [n])).rows.map((r) => r.inventory);
check("Mounjaro 5 mg - ding = 21", (await spot("Mounjaro 5 mg - ding"))[0] === 21);
check("Mounjaro 5 mg - mint = 57", (await spot("Mounjaro 5 mg - mint"))[0] === 57);
check("Ozempic .25 mg (red) - ding and - mint are separate (19/35)",
  (await spot("Ozempic .25 mg (red) - ding"))[0] === 19 && (await spot("Ozempic .25 mg (red) - mint"))[0] === 35);
check("Humalog KwikPen 200 units/ml listed twice (45 and 3)", JSON.stringify((await spot("Humalog KwikPen 200 units/ml")).sort()) === "[3,45]");
const hist = (await db.query("select count(*)::int c from public.inventory_transactions where transaction_type='initial_stock'")).rows[0].c;
check("seed history = one row per in-stock product (199)", hist === 199, String(hist));

const pid = async (n) => (await db.query("select id from public.products where product_name = $1", [n])).rows[0].id;
const mint = await pid("Mounjaro 5 mg - mint");

// ---- anonymous visitor (employee) ----
let r = await as("anon", null, "select product_name, inventory from public.employee_inventory");
check("anon can read employee_inventory", r.rows?.length === 237, r.error);
r = await as("anon", null, "select * from public.products");
check("anon cannot read products table", !!r.error);
r = await as("anon", null, "select * from public.inventory_transactions");
check("anon cannot read history", !!r.error);
r = await as("anon", null, "select * from public.admin_users");
check("anon cannot read admin_users", !!r.error);
r = await as("anon", null, `select public.adjust_inventory('${mint}', 'add', 10, null)`);
check("anon cannot call adjust_inventory", !!r.error);
r = await as("anon", null, "select public.create_product('x', null, null, 1, 5)");
check("anon cannot call create_product", !!r.error);
r = await as("anon", null, `update public.products set inventory = 9999 where id = '${mint}'`);
check("anon cannot update products", !!r.error);
r = await as("anon", null, "select column_name from information_schema.columns where table_name='employee_inventory'");
check("employee view exposes no id/cost columns", !r.rows?.some((c) => ["id", "created_by"].includes(c.column_name)));

// ---- signed-in but NOT an admin ----
r = await as("authenticated", OUTSIDER, "select * from public.products");
check("non-admin sees zero product rows (RLS)", r.rows?.length === 0, r.error);
r = await as("authenticated", OUTSIDER, `select public.adjust_inventory('${mint}', 'add', 10, null)`);
check("non-admin cannot adjust inventory", /NOT_AUTHORIZED/.test(r.error ?? ""), r.error);
r = await as("authenticated", OUTSIDER, `update public.products set product_name = 'hacked' where id = '${mint}'`);
check("non-admin update changes nothing", (await spot("hacked")).length === 0);
r = await as("authenticated", OUTSIDER, "select * from public.inventory_transactions");
check("non-admin cannot read history", r.rows?.length === 0, r.error);

// ---- admin ----
const adj = async (action, qty, note = null) =>
  as("authenticated", ADMIN, `select public.adjust_inventory('${mint}', '${action}', ${qty}, ${note ? `'${note}'` : "null"}) as r`);

r = await adj("add", 10, "New shipment");
check("add +10 => 67", r.rows?.[0].r.new_quantity === 67 && r.rows[0].r.previous_quantity === 57 && r.rows[0].r.quantity_change === 10, r.error);
r = await adj("remove", 5);
check("remove -5 => 62", r.rows?.[0].r.new_quantity === 62 && r.rows[0].r.quantity_change === -5, r.error);
r = await adj("set", 40);
check("set 40 => change -22", r.rows?.[0].r.new_quantity === 40 && r.rows[0].r.quantity_change === -22, r.error);
r = await adj("remove", 41);
check("cannot go below zero", /STOCK_BELOW_ZERO/.test(r.error ?? ""), r.error);
check("stock unchanged after rejected removal", (await spot("Mounjaro 5 mg - mint"))[0] === 40);
r = await adj("set", 40);
check("set to same value rejected", /NO_CHANGE/.test(r.error ?? ""), r.error);
r = await adj("set", -3);
check("negative set rejected", /INVALID_INPUT/.test(r.error ?? ""), r.error);
r = await adj("add", 0);
check("add 0 rejected", /INVALID_INPUT/.test(r.error ?? ""), r.error);
r = await adj("bogus", 1);
check("bad action rejected", /INVALID_INPUT/.test(r.error ?? ""), r.error);
r = await as("authenticated", ADMIN, `select public.adjust_inventory(gen_random_uuid(), 'add', 1, null)`);
check("unknown product rejected", /PRODUCT_NOT_FOUND/.test(r.error ?? ""), r.error);

const h = (await db.query(
  `select previous_quantity p, quantity_change c, new_quantity n, transaction_type t, note, created_by_name a
   from public.inventory_transactions where product_id = '${mint}' and transaction_type <> 'initial_stock' order by created_at, id`)).rows;
check("history has exactly the 3 successful changes", h.length === 3, JSON.stringify(h));
check("history rows correct", h[0]?.p === 57 && h[0].c === 10 && h[0].n === 67 && h[0].t === "stock_added" && h[0].note === "New shipment" && h[0].a === "Test Admin"
  && h[1]?.p === 67 && h[1].c === -5 && h[1].n === 62 && h[1].t === "stock_removed"
  && h[2]?.p === 62 && h[2].c === -22 && h[2].n === 40 && h[2].t === "manual_adjustment", JSON.stringify(h));

r = await as("authenticated", ADMIN, `update public.products set inventory = 500 where id = '${mint}'`);
check("admin cannot write inventory column directly", !!r.error, "no error");
r = await as("authenticated", ADMIN, `update public.products set product_name='Mounjaro 5 mg - mint', category='GLP-1', low_stock_threshold=8 where id = '${mint}'`);
check("admin can edit descriptive fields", !r.error, r.error);
r = await as("authenticated", ADMIN, `update public.products set active = false where id = '${mint}'`);
check("admin can archive", !r.error, r.error);
r = await as("anon", null, "select count(*)::int c from public.employee_inventory");
check("archived product disappears from employee view", r.rows?.[0].c === 236, JSON.stringify(r));
r = await as("authenticated", ADMIN, `update public.products set active = true where id = '${mint}'`);
check("admin can restore", !r.error, r.error);
r = await as("authenticated", ADMIN, "update public.inventory_transactions set note = 'edited'");
check("history cannot be updated by admin", !!r.error);
r = await as("authenticated", ADMIN, "delete from public.inventory_transactions");
check("history cannot be deleted by admin", !!r.error);
r = await as("authenticated", ADMIN, `delete from public.products where id = '${mint}'`);
check("admin cannot hard-delete products", !!r.error);
r = await db.query("select 1"); // superuser attempts still blocked by trigger
try { await db.exec("delete from public.inventory_transactions"); check("trigger blocks even superuser delete", false); }
catch { check("trigger blocks even superuser delete", true); }
try { await db.exec(`update public.products set inventory = 1 where id = '${mint}'`); check("guard trigger blocks superuser inventory write", false); }
catch { check("guard trigger blocks superuser inventory write", true); }

r = await as("authenticated", ADMIN, "select public.create_product('  Test Item  ', ' ABC-1 ', '', 12, 3) as r");
check("create_product works", !!r.rows?.[0]?.r.product_id, r.error);
const np = (await db.query("select product_name n, sku, category c, inventory i, low_stock_threshold t from public.products where product_name = 'Test Item'")).rows[0];
check("create_product trims/normalises", np?.sku === "ABC-1" && np.c === null && np.i === 12 && np.t === 3, JSON.stringify(np));
const ih = (await db.query("select quantity_change c, transaction_type t from public.inventory_transactions where product_id = (select id from public.products where product_name='Test Item')")).rows;
check("create_product logs starting stock", ih.length === 1 && ih[0].c === 12 && ih[0].t === "initial_stock");
r = await as("authenticated", ADMIN, "select public.create_product('  ', null, null, 1, 5)");
check("blank name rejected", /INVALID_INPUT/.test(r.error ?? ""));
r = await as("authenticated", ADMIN, "select public.create_product('Neg', null, null, -1, 5)");
check("negative starting stock rejected", /INVALID_INPUT/.test(r.error ?? ""));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
