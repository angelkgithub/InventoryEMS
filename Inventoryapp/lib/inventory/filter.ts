import type { PublicProduct, StockStatus } from "@/types/inventory";
import { getStatus } from "./status";

export type SortKey = "name_asc" | "name_desc" | "stock_asc" | "stock_desc" | "recent";

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "name_asc", label: "Product name A-Z" },
  { value: "name_desc", label: "Product name Z-A" },
  { value: "stock_asc", label: "Stock low-high" },
  { value: "stock_desc", label: "Stock high-low" },
  { value: "recent", label: "Recently updated" },
];

/** Category chips shown to users. "Other" means every category not listed here. */
export const MAIN_CATEGORIES = ["GLP-1", "Diabetes", "Inhalers"] as const;
export const CATEGORY_SUGGESTIONS = [
  "GLP-1",
  "Diabetes",
  "Cardiovascular",
  "Inhalers",
  "Gastrointestinal",
  "Dermatology",
  "Other",
];

export interface ListFilters {
  query: string;
  category: string; // "All" | one of MAIN_CATEGORIES | "Other"
  status: StockStatus | "all";
  sort: SortKey;
}

export const DEFAULT_FILTERS: ListFilters = { query: "", category: "All", status: "all", sort: "name_asc" };

const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
const haystack = (p: PublicProduct) => `${norm(p.product_name)} ${norm(p.sku)} ${norm(p.category)}`;

function matchesCategory(p: PublicProduct, category: string): boolean {
  if (category === "All") return true;
  const c = p.category ?? "Other";
  if (category === "Other") return !(MAIN_CATEGORIES as readonly string[]).includes(c);
  return c === category;
}

const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

export function filterAndSort<T extends PublicProduct>(items: T[], f: ListFilters): T[] {
  const q = norm(f.query);
  let out = items.filter(
    (p) =>
      matchesCategory(p, f.category) &&
      (f.status === "all" || getStatus(p.inventory, p.low_stock_threshold) === f.status),
  );

  if (q) {
    // Whole phrase first ("mounjaro 5 mg" must not match "12.5 mg"); otherwise every word anywhere.
    const phrase = out.filter((p) => haystack(p).includes(q));
    out = phrase.length > 0 ? phrase : out.filter((p) => q.split(" ").every((w) => haystack(p).includes(w)));
  }

  const sorted = [...out];
  switch (f.sort) {
    case "name_desc":
      sorted.sort((a, b) => collator.compare(b.product_name, a.product_name));
      break;
    case "stock_asc":
      sorted.sort((a, b) => a.inventory - b.inventory || collator.compare(a.product_name, b.product_name));
      break;
    case "stock_desc":
      sorted.sort((a, b) => b.inventory - a.inventory || collator.compare(a.product_name, b.product_name));
      break;
    case "recent":
      sorted.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
      break;
    default:
      sorted.sort((a, b) => collator.compare(a.product_name, b.product_name));
  }
  return sorted;
}

export function latestUpdate(items: { updated_at: string }[]): string | null {
  return items.reduce<string | null>((max, p) => (max === null || p.updated_at > max ? p.updated_at : max), null);
}
