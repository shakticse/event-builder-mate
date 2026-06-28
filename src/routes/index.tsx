import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Search,
  Plus,
  Trash2,
  Package,
  Layers,
  FileSpreadsheet,
  Minus,
  RefreshCw,
  AlertCircle,
  Loader2,
} from "lucide-react";
import {
  evalExpression,
  type BomApiItem,
  type BomRow,
} from "@/lib/bom-types";
import { exportBomToXlsx } from "@/lib/bom-export";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-client";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BOM Builder — Event Rentals" },
      {
        name: "description",
        content:
          "Build, edit and export a Bill of Materials for any event rental job in seconds.",
      },
      { property: "og:title", content: "BOM Builder — Event Rentals" },
      {
        property: "og:description",
        content:
          "Build, edit and export a Bill of Materials for any event rental job in seconds.",
      },
    ],
  }),
  component: BomBuilderPage,
});

const API_URL = "/api/items/bomitems";

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function formatPrice(p: number | null) {
  if (p === null || p === undefined) return "N/A";
  return `₹${p.toLocaleString()}`;
}

function BomBuilderPage() {
  const [items, setItems] = useState<BomApiItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [eventName, setEventName] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<BomApiItem | null>(null);
  const [qtyInput, setQtyInput] = useState<string>("1");
  const [showPicker, setShowPicker] = useState(false);
  const [adding, setAdding] = useState(false);

  const [rows, setRows] = useState<BomRow[]>([]);

  const fetchItems = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(API_URL, { headers: { Accept: "application/json" } });
      if (!res.ok) {
        throw new Error(
          res.status === 401
            ? "Authentication required (401). The items API needs a Bearer token."
            : `Failed to load items (${res.status})`,
        );
      }
      const data = (await res.json()) as BomApiItem[];
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items.slice(0, 50);
    return items.filter((i) => i.name.toLowerCase().includes(q)).slice(0, 50);
  }, [items, search]);

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

    setAdding(true);
    try {
      if (selected.isGroupedItem && selected.childItems?.length) {
        const groupInstanceId = uid();
        const newRows: BomRow[] = selected.childItems.map((c) => {
          let finalQty = qty;
          try {
            finalQty = evalExpression(c.expression, qty, c.perunit);
          } catch {
            finalQty = qty * c.perunit;
          }
          return {
            rowId: uid(),
            itemId: c.id,
            name: c.name,
            quantity: finalQty,
            price: c.price,
            groupInstanceId,
            groupName: selected.name,
            standalone: false,
          };
        });
        setRows((prev) => [...prev, ...newRows]);
        toast.success(
          `Added ${newRows.length} items from "${selected.name}"`,
        );
      } else {
        // Standalone — if already exists, increment qty
        const existingIdx = rows.findIndex(
          (r) => r.standalone && r.itemId === selected.id,
        );
        if (existingIdx >= 0) {
          setRows((prev) =>
            prev.map((r, i) =>
              i === existingIdx ? { ...r, quantity: r.quantity + qty } : r,
            ),
          );
          toast.message(`Incremented "${selected.name}" by ${qty}`);
        } else {
          setRows((prev) => [
            ...prev,
            {
              rowId: uid(),
              itemId: selected.id,
              name: selected.name,
              quantity: qty,
              price: selected.itemPrice,
              standalone: true,
            },
          ]);
          toast.success(`Added "${selected.name}"`);
        }
      }
      setSelected(null);
      setSearch("");
      setQtyInput("1");
      setShowPicker(false);
    } finally {
      setAdding(false);
    }
  };

  const updateRowQty = (rowId: string, next: number) => {
    if (!Number.isFinite(next) || next <= 0) return;
    setRows((prev) =>
      prev.map((r) => (r.rowId === rowId ? { ...r, quantity: next } : r)),
    );
  };

  const removeRow = (row: BomRow) => {
    if (row.groupInstanceId) {
      const groupRows = rows.filter(
        (r) => r.groupInstanceId === row.groupInstanceId,
      );
      const ok = window.confirm(
        `Remove all ${groupRows.length} items from group "${row.groupName}"?`,
      );
      if (!ok) return;
      setRows((prev) =>
        prev.filter((r) => r.groupInstanceId !== row.groupInstanceId),
      );
      toast.success("Group removed");
    } else {
      setRows((prev) => prev.filter((r) => r.rowId !== row.rowId));
    }
  };

  const handleExport = () => {
    if (rows.length === 0) return;
    try {
      const file = exportBomToXlsx(rows, eventName.trim() || "Event");
      toast.success(`Exported ${file}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    }
  };

  // Group rows together visually
  const grouped = useMemo(() => {
    const order: string[] = [];
    const map = new Map<string, BomRow[]>();
    for (const r of rows) {
      const key = r.groupInstanceId ?? `__solo_${r.rowId}`;
      if (!map.has(key)) {
        order.push(key);
        map.set(key, []);
      }
      map.get(key)!.push(r);
    }
    return order.map((k) => ({ key: k, rows: map.get(k)! }));
  }, [rows]);

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-border bg-primary text-primary-foreground shadow-sm">
        <div className="mx-auto max-w-2xl px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <Package className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h1 className="text-base font-bold leading-tight">BOM Builder</h1>
              <p className="text-xs text-primary-foreground/70 leading-tight">
                Event Rentals
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
          <input
            type="text"
            value={eventName}
            onChange={(e) => setEventName(e.target.value)}
            placeholder="Event name (e.g. ACME Wedding)"
            className="mt-3 w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-primary-foreground placeholder:text-primary-foreground/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-4 space-y-4">
        {/* Add-item card */}
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            Add an item
          </h2>

          {/* Picker trigger */}
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
                  {loading
                    ? "Loading items…"
                    : "Search & select an item"}
                </span>
              )}
            </span>
            {selected?.isGroupedItem && (
              <span className="inline-flex items-center gap-1 rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-semibold text-accent-foreground">
                <Layers className="h-3 w-3" />
                Group
              </span>
            )}
          </button>

          {/* Qty + Add */}
          <div className="mt-3 flex items-center gap-2">
            <div className="flex items-center rounded-lg border border-input bg-background">
              <button
                type="button"
                onClick={() =>
                  setQtyInput((q) => String(Math.max(1, (Number(q) || 1) - 1)))
                }
                className="flex h-11 w-11 items-center justify-center text-muted-foreground hover:text-foreground"
                aria-label="Decrease"
              >
                <Minus className="h-4 w-4" />
              </button>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                value={qtyInput}
                onChange={(e) => setQtyInput(e.target.value)}
                className="h-11 w-16 border-0 bg-transparent text-center text-base font-semibold text-foreground focus:outline-none"
              />
              <button
                type="button"
                onClick={() =>
                  setQtyInput((q) => String((Number(q) || 0) + 1))
                }
                className="flex h-11 w-11 items-center justify-center text-muted-foreground hover:text-foreground"
                aria-label="Increase"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={handleAdd}
              disabled={!selected || adding}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground shadow-sm transition active:scale-[0.98] disabled:opacity-50"
            >
              {adding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Add to BOM
            </button>
          </div>

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

        {/* BOM list */}
        <section>
          <div className="mb-2 flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold text-foreground">
              Bill of Materials
            </h2>
            <span className="text-xs text-muted-foreground">
              {rows.length} {rows.length === 1 ? "item" : "items"}
            </span>
          </div>

          {loading && rows.length === 0 && (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-20 animate-pulse rounded-xl bg-muted"
                />
              ))}
            </div>
          )}

          {!loading && rows.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
              <Package className="mx-auto h-10 w-10 text-muted-foreground/50" />
              <p className="mt-3 text-sm font-medium text-foreground">
                No items added yet
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Search above to get started.
              </p>
            </div>
          )}

          <div className="space-y-3">
            {grouped.map(({ key, rows: groupRows }) => {
              const first = groupRows[0];
              const isGroup = !!first.groupInstanceId;
              return (
                <div
                  key={key}
                  className={cn(
                    "rounded-2xl border bg-card shadow-sm overflow-hidden",
                    isGroup
                      ? "border-accent/40"
                      : "border-border",
                  )}
                >
                  {isGroup && (
                    <div className="flex items-center gap-2 border-b border-accent/30 bg-accent/10 px-3 py-2">
                      <Layers className="h-3.5 w-3.5 text-accent-foreground" />
                      <span className="text-xs font-semibold text-accent-foreground">
                        {first.groupName}
                      </span>
                      <span className="ml-auto text-[10px] text-muted-foreground">
                        {groupRows.length} sub-items
                      </span>
                    </div>
                  )}
                  <ul className="divide-y divide-border">
                    {groupRows.map((row) => (
                      <BomRowItem
                        key={row.rowId}
                        row={row}
                        onChangeQty={(n) => updateRowQty(row.rowId, n)}
                        onRemove={() => removeRow(row)}
                      />
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* Sticky export footer */}
      <footer className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <div className="flex-1">
            <div className="text-xs text-muted-foreground">Total items</div>
            <div className="text-base font-bold text-foreground">
              {rows.reduce((a, r) => a + r.quantity, 0)}
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                ({rows.length} rows)
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleExport}
            disabled={rows.length === 0}
            title={rows.length === 0 ? "Add items first" : "Export to Excel"}
            className="flex h-12 items-center gap-2 rounded-xl bg-accent px-5 text-sm font-semibold text-accent-foreground shadow-md transition active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
          >
            <FileSpreadsheet className="h-5 w-5" />
            Export Excel
          </button>
        </div>
      </footer>

      {/* Item picker sheet */}
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

function BomRowItem({
  row,
  onChangeQty,
  onRemove,
}: {
  row: BomRow;
  onChangeQty: (n: number) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(row.quantity));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = () => {
    const n = Number(val);
    if (Number.isFinite(n) && n > 0) onChangeQty(n);
    else setVal(String(row.quantity));
    setEditing(false);
  };

  return (
    <li className="flex items-center gap-3 px-3 py-3">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-foreground">
          {row.name}
        </div>
        <div className="mt-1 flex items-center gap-2">
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
              className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary"
            >
              Qty: {row.quantity}
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
                  <div
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-lg",
                      it.isGroupedItem
                        ? "bg-accent/20 text-accent-foreground"
                        : "bg-primary/10 text-primary",
                    )}
                  >
                    {it.isGroupedItem ? (
                      <Layers className="h-4 w-4" />
                    ) : (
                      <Package className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-foreground">
                      {it.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {it.isGroupedItem
                        ? `Group · ${it.childItems?.length ?? 0} items`
                        : formatPrice(it.itemPrice)}
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
