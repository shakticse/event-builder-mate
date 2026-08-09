import { APP_NAME } from "@/lib/app-config";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Search,
  Plus,
  Trash2,
  Package,
  FileSpreadsheet,
  Minus,
  RefreshCw,
  AlertCircle,
  Loader2,
  Pencil,
  Layers,
} from "lucide-react";
import { type BomApiItem } from "@/lib/bom-types";
import {
  exportStockConsolidationToXlsx,
  type StockConsolidationRow,
} from "@/lib/stock-consolidation-export";
import { cn } from "@/lib/utils";
import { apiFetch, isSessionExpired, SESSION_TIMED_OUT } from "@/lib/api-client";

export const Route = createFileRoute("/stock-consolidation")({
  head: () => ({
    meta: [
      { title: `Stock Consolidation — ${APP_NAME}` },
      {
        name: "description",
        content:
          "Consolidate stock quantities by item and export the list to Excel.",
      },
      { property: "og:title", content: `Stock Consolidation — ${APP_NAME}` },
      {
        property: "og:description",
        content:
          "Consolidate stock quantities by item and export the list to Excel.",
      },
    ],
  }),
  component: StockConsolidationPage,
});

const API_URL = "/api/items/bomitems";

const STORE_OPTIONS = ["Noida", "Bangalore", "Chennai"] as const;

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function formatPrice(p: number | null) {
  if (p === null || p === undefined) return "N/A";
  return `₹${p.toLocaleString()}`;
}

function StockConsolidationPage() {
  const [items, setItems] = useState<BomApiItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [storeName, setStoreName] = useState("");
  const [portfolioNo, setPortfolioNo] = useState("");

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<BomApiItem | null>(null);
  const [qtyInput, setQtyInput] = useState<string>("1");
  const [damagedInput, setDamagedInput] = useState<string>("0");
  const [showPicker, setShowPicker] = useState(false);
  const [adding, setAdding] = useState(false);

  const [rows, setRows] = useState<StockConsolidationRow[]>([]);
  const [exporting, setExporting] = useState(false);

  const fetchItems = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(API_URL);
      if (!res.ok) {
        throw new Error(
            `Failed to load items (${res.status})`,
        );
      }
      const data = (await res.json()) as BomApiItem[];
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      if (isSessionExpired(e)) {
        setError(SESSION_TIMED_OUT);
        return;
      }
      const msg = e instanceof Error ? e.message : "Failed to load items";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchItems();
  }, []);

  const standaloneItems = useMemo(
    () => items.filter((i) => !i.isGroupedItem),
    [items],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return standaloneItems.slice(0, 50);
    return standaloneItems
      .filter((i) => i.name.toLowerCase().includes(q))
      .slice(0, 50);
  }, [standaloneItems, search]);

  const handleAdd = () => {
    if (!selected) {
      toast.error("Pick an item first");
      return;
    }
    const qty = Number(qtyInput);
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error("Quantity must be greater than 0");
      return;
    }
    const damaged = Number(damagedInput) || 0;
    if (damaged < 0) {
      toast.error("Damaged quantity cannot be negative");
      return;
    }
    if (damaged > qty) {
      toast.error("Damaged quantity cannot exceed quantity");
      return;
    }

    setAdding(true);
    try {
      const existingIdx = rows.findIndex((r) => r.itemId === selected.id);
      if (existingIdx >= 0) {
        setRows((prev) => {
          const existing = prev[existingIdx];
          const updated = {
            ...existing,
            quantity: existing.quantity + qty,
            damagedQty: existing.damagedQty + damaged,
          };
          return [updated, ...prev.filter((_, i) => i !== existingIdx)];
        });
        toast.message(`Incremented "${selected.name}" by ${qty}`);
      } else {
        setRows((prev) => [
          {
            rowId: uid(),
            itemId: selected.id,
            name: selected.name,
            quantity: qty,
            damagedQty: damaged,
            price: selected.itemPrice,
            categoryName: selected.categoryName,
          },
          ...prev,
        ]);
        toast.success(`Added "${selected.name}"`);
      }
      setSelected(null);
      setSearch("");
      setQtyInput("1");
      setDamagedInput("0");
      setShowPicker(false);
    } finally {
      setAdding(false);
    }
  };

  const updateRowQty = (rowId: string, next: number) => {
    if (!Number.isFinite(next) || next <= 0) return;
    setRows((prev) =>
      prev.map((r) =>
        r.rowId === rowId
          ? { ...r, quantity: next, damagedQty: Math.min(r.damagedQty, next) }
          : r,
      ),
    );
  };

  const updateRowDamaged = (rowId: string, next: number) => {
    if (!Number.isFinite(next) || next < 0) return;
    setRows((prev) =>
      prev.map((r) =>
        r.rowId === rowId
          ? { ...r, damagedQty: Math.min(next, r.quantity) }
          : r,
      ),
    );
  };

  const removeRow = (rowId: string) => {
    setRows((prev) => prev.filter((r) => r.rowId !== rowId));
  };

  const handleExport = async () => {
    if (rows.length === 0) return;
    setExporting(true);
    try {
      const file = await exportStockConsolidationToXlsx(rows, {
        storeName,
        portfolioNo,
      });
      toast.success(`Exported ${file}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-primary text-primary-foreground shadow-sm">
        <div className="mx-auto max-w-2xl px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <Layers className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h1 className="text-base font-bold leading-tight">
                Stock Consolidation
              </h1>
              <p className="text-xs text-primary-foreground/70 leading-tight">
                {APP_NAME}
              </p>
            </div>
            <button
              onClick={() => void fetchItems()}
              className="rounded-md p-2 text-primary-foreground/80 hover:bg-white/10 active:bg-white/20"
              aria-label="Refresh items"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-4 space-y-4">
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            Store details
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="store-name"
                className="mb-1 block text-xs font-medium text-muted-foreground"
              >
                Store Name
              </label>
              <select
                id="store-name"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:border-primary/40 focus:outline-none"
              >
                <option value="">Select store</option>
                {STORE_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="portfolio-no"
                className="mb-1 block text-xs font-medium text-muted-foreground"
              >
                Portfolio No
              </label>
              <input
                id="portfolio-no"
                value={portfolioNo}
                onChange={(e) => setPortfolioNo(e.target.value)}
                placeholder="e.g. PF-1024"
                className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:border-primary/40 focus:outline-none"
              />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            Add an item
          </h2>


          <button
            type="button"
            onClick={() => setShowPicker(true)}
            disabled={loading && items.length === 0}
            className="flex w-full items-center gap-2 rounded-lg border border-input bg-background px-3 py-3 text-left text-sm hover:border-primary/40 disabled:opacity-50"
          >
            <Search className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1 truncate">
              {selected ? (
                <span className="font-medium text-foreground">
                  {selected.name}
                </span>
              ) : (
                <span className="text-muted-foreground">
                  {loading ? "Loading items…" : "Search & select an item"}
                </span>
              )}
            </span>
          </button>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <div className="mb-1 text-xs font-medium text-muted-foreground">
                Quantity
              </div>
              <div className="flex items-center rounded-lg border border-input bg-background">
                <button
                  type="button"
                  onClick={() =>
                    setQtyInput((q) => String(Math.max(1, (Number(q) || 1) - 1)))
                  }
                  className="flex h-11 w-11 items-center justify-center text-muted-foreground hover:text-foreground"
                  aria-label="Decrease quantity"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={qtyInput}
                  onChange={(e) => setQtyInput(e.target.value)}
                  className="h-11 min-w-0 flex-1 border-0 bg-transparent text-center text-base font-semibold text-foreground focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setQtyInput((q) => String((Number(q) || 0) + 1))}
                  className="flex h-11 w-11 items-center justify-center text-muted-foreground hover:text-foreground"
                  aria-label="Increase quantity"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div>
              <div className="mb-1 text-xs font-medium text-muted-foreground">
                Damaged Qty
              </div>
              <div className="flex items-center rounded-lg border border-input bg-background">
                <button
                  type="button"
                  onClick={() =>
                    setDamagedInput((q) =>
                      String(Math.max(0, (Number(q) || 0) - 1)),
                    )
                  }
                  className="flex h-11 w-11 items-center justify-center text-muted-foreground hover:text-foreground"
                  aria-label="Decrease damaged quantity"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={damagedInput}
                  onChange={(e) => setDamagedInput(e.target.value)}
                  className="h-11 min-w-0 flex-1 border-0 bg-transparent text-center text-base font-semibold text-foreground focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() =>
                    setDamagedInput((q) => String((Number(q) || 0) + 1))
                  }
                  className="flex h-11 w-11 items-center justify-center text-muted-foreground hover:text-foreground"
                  aria-label="Increase damaged quantity"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleAdd}
            disabled={!selected || adding}
            className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground shadow-sm transition active:scale-[0.98] disabled:opacity-50"
          >
            {adding ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Add to List
          </button>


          {error && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <div className="flex-1">{error}</div>
              <button
                onClick={() => void fetchItems()}
                className="font-semibold underline"
              >
                Retry
              </button>
            </div>
          )}
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold text-foreground">
              Consolidated Items
            </h2>
            <span className="text-xs text-muted-foreground">
              {rows.length} {rows.length === 1 ? "item" : "items"}
            </span>
          </div>

          {!loading && rows.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
              <Package className="mx-auto h-10 w-10 text-muted-foreground/50" />
              <p className="mt-3 text-sm font-medium text-foreground">
                No items added yet
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Search above to add items to the consolidation list.
              </p>
            </div>
          )}

          {rows.length > 0 && (
            <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
              <ul className="divide-y divide-border">
                {rows.map((row) => (
                  <StockRowItem
                    key={row.rowId}
                    row={row}
                    onChangeQty={(n) => updateRowQty(row.rowId, n)}
                    onChangeDamaged={(n) => updateRowDamaged(row.rowId, n)}
                    onRemove={() => removeRow(row.rowId)}
                  />
                ))}
              </ul>
            </div>
          )}
        </section>
      </main>

      <footer className="sticky bottom-0 z-20 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <div className="flex-1">
            <div className="text-xs text-muted-foreground">Total items</div>
            <div className="text-base font-bold text-foreground">
              {rows.reduce((a, r) => a + r.quantity, 0)}
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                ({rows.length} rows · {rows.reduce((a, r) => a + r.damagedQty, 0)}{" "}
                damaged)
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleExport}
            disabled={rows.length === 0 || exporting}
            title={rows.length === 0 ? "Add items first" : "Export to Excel"}
            className="flex h-12 items-center gap-2 rounded-xl bg-accent px-5 text-sm font-semibold text-accent-foreground shadow-md transition active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
          >
            {exporting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-5 w-5" />
            )}
            Export Excel
          </button>
        </div>
      </footer>

      {showPicker && (
        <ItemPickerSheet
          items={filtered}
          loading={loading}
          search={search}
          onSearch={setSearch}
          onPick={(it) => {
            setSelected(it);
            setShowPicker(false);
          }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}

function StockRowItem({
  row,
  onChangeQty,
  onChangeDamaged,
  onRemove,
}: {
  row: StockConsolidationRow;
  onChangeQty: (n: number) => void;
  onChangeDamaged: (n: number) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(row.quantity));
  const [editingDamaged, setEditingDamaged] = useState(false);
  const [dmgVal, setDmgVal] = useState(String(row.damagedQty));
  const inputRef = useRef<HTMLInputElement>(null);
  const dmgRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  useEffect(() => {
    if (editingDamaged) dmgRef.current?.focus();
  }, [editingDamaged]);

  const commit = () => {
    const n = Number(val);
    if (Number.isFinite(n) && n > 0) onChangeQty(n);
    else setVal(String(row.quantity));
    setEditing(false);
  };

  const commitDamaged = () => {
    const n = Number(dmgVal);
    if (Number.isFinite(n) && n >= 0) onChangeDamaged(n);
    else setDmgVal(String(row.damagedQty));
    setEditingDamaged(false);
  };

  return (
    <li className="flex items-center gap-3 px-3 py-3">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-foreground">
          {row.name}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {editing ? (
            <input
              ref={inputRef}
              type="number"
              inputMode="numeric"
              value={val}
              onChange={(e) => setVal(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
              }}
              className="w-20 rounded-md border border-input bg-background px-2 py-1 text-xs"
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setVal(String(row.quantity));
                setEditing(true);
              }}
              aria-label="Edit quantity"
              className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-2.5 py-1 text-xs font-semibold text-foreground shadow-sm hover:border-primary/40 hover:bg-accent/10 active:bg-accent/20"
            >
              <span className="text-muted-foreground">Qty:</span>
              {row.quantity}
              <Pencil className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
          {editingDamaged ? (
            <input
              ref={dmgRef}
              type="number"
              inputMode="numeric"
              value={dmgVal}
              onChange={(e) => setDmgVal(e.target.value)}
              onBlur={commitDamaged}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitDamaged();
              }}
              className="w-20 rounded-md border border-input bg-background px-2 py-1 text-xs"
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setDmgVal(String(row.damagedQty));
                setEditingDamaged(true);
              }}
              aria-label="Edit damaged quantity"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold shadow-sm",
                row.damagedQty > 0
                  ? "border-destructive/40 bg-destructive/5 text-destructive"
                  : "border-input bg-background text-foreground",
              )}
            >
              <span className="opacity-70">Damaged:</span>
              {row.damagedQty}
              <Pencil className="h-3 w-3 opacity-70" />
            </button>
          )}
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
            {formatPrice(row.price)}
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-destructive hover:bg-destructive/10"
      >
        <Trash2 className="h-5 w-5" />
      </button>
    </li>
  );
}

function ItemPickerSheet({
  items,
  loading,
  search,
  onSearch,
  onPick,
  onClose,
}: {
  items: BomApiItem[];
  loading: boolean;
  search: string;
  onSearch: (s: string) => void;
  onPick: (it: BomApiItem) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center gap-2 border-b border-border bg-card px-3 py-3">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          autoFocus
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search items…"
          className="flex-1 bg-transparent text-sm focus:outline-none"
        />
        <button
          onClick={onClose}
          className="rounded-md px-3 py-1.5 text-sm font-semibold text-primary"
        >
          Cancel
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading && items.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No items match “{search}”.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((it) => (
              <li key={it.id}>
                <button
                  type="button"
                  onClick={() => onPick(it)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-secondary"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Package className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-foreground">
                      {it.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatPrice(it.itemPrice)}
                      {typeof it.availableStock === "number" && (
                        <> · stock {it.availableStock}</>
                      )}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
