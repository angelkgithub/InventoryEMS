"use client";

import { SORT_OPTIONS, type ListFilters, type SortKey } from "@/lib/inventory/filter";
import { inputClass } from "@/components/ui/field";
import type { StockStatus } from "@/types/inventory";

const CATEGORIES = ["All", "GLP-1", "Diabetes", "Inhalers", "Other"];
const STATUSES: { value: StockStatus | "all"; label: string }[] = [
  { value: "all", label: "Any stock level" },
  { value: "in_stock", label: "In Stock" },
  { value: "low_stock", label: "Low Stock" },
  { value: "out_of_stock", label: "Out of Stock" },
];

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-11 rounded-full border-2 px-4 text-base font-semibold ${
        active ? "border-accent bg-accent text-white" : "border-line bg-white text-ink hover:bg-accent-soft"
      }`}
    >
      {active && <span aria-hidden>{"✓ "}</span>}
      {children}
    </button>
  );
}

interface Props {
  filters: ListFilters;
  onChange: (next: ListFilters) => void;
  searchPlaceholder: string;
  resultCount: number;
}

/** Search box, category chips, stock-level chips and sort. Shared by the employee and admin pages. */
export function ListControls({ filters, onChange, searchPlaceholder, resultCount }: Props) {
  const set = (patch: Partial<ListFilters>) => onChange({ ...filters, ...patch });
  return (
    <div className="no-print space-y-4">
      <div>
        <label htmlFor="search" className="sr-only">
          {searchPlaceholder}
        </label>
        <div className="relative">
          <span aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-2xl text-muted">
            {"⌕"}
          </span>
          <input
            id="search"
            type="search"
            inputMode="search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            value={filters.query}
            onChange={(e) => set({ query: e.target.value })}
            placeholder={searchPlaceholder}
            className={`${inputClass} min-h-14 pl-12 text-xl`}
          />
        </div>
      </div>

      <div role="group" aria-label="Category" className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <Chip key={c} active={filters.category === c} onClick={() => set({ category: c })}>
            {c}
          </Chip>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Stock level" className="flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <Chip key={s.value} active={filters.status === s.value} onClick={() => set({ status: s.value })}>
              {s.label}
            </Chip>
          ))}
        </div>
        <div className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto">
          <label htmlFor="sort" className="text-base font-semibold">
            Sort
          </label>
          <select
            id="sort"
            value={filters.sort}
            onChange={(e) => set({ sort: e.target.value as SortKey })}
            className={`${inputClass} flex-1 sm:w-auto sm:flex-none`}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="text-base text-muted" aria-live="polite">
        Showing {resultCount} {resultCount === 1 ? "product" : "products"}
      </p>
    </div>
  );
}
