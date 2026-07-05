import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Search,
  Plus,
  Trash2,
  Package,
  FileSpreadsheet,
  RefreshCw,
  AlertCircle,
  Loader2,
  Undo2,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { type BomApiItem } from "@/lib/bom-types";
import {
  exportReturnsToXlsx,
  type ReturnRow,
  type ReturnMeta,
} from "@/lib/returns-export";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-client";

export const Route = createFileRoute("/returns")({
  head: () => ({
    meta: [
      { title: "Return Items — Event Rentals" },
      {
        name: "description",
        content:
          "Record returned rental items and split quantities by Good, Needs Repair, and Rejected.",
      },
      { property: "og:title", content: "Return Items — Event Rentals" },
      {
        property: "og:description",
        content:
          "Record returned rental items and split quantities by Good, Needs Repair, and Rejected.",
      },
    ],
  }),
  component: ReturnsPage,
});

const API_URL = "/api/items/bomitems";

type QtyField = "goodQty" | "repairQty" | "rejectedQty";

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function formatPrice(p: number | null) {
  if (p === null || p === undefined) return "N/A";
  return `₹${p.toLocaleString()}`;
}

function ReturnsPage() {
  const [items, setItems] = useState<BomApiItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [meta, setMeta] = useState<ReturnMeta>({
    projectName: "",
    siteLocation: "",
    description: "",
  });

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<BomApiItem | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [adding, setAdding] = useState(false);

  const [goodInput, setGoodInput] = useState("");
  const [repairInput, setRepairInput] = useState("");
  const [rejectedInput, setRejectedInput] = useState("");

  const [rows, setRows] = useState<ReturnRow[]>([]);
  const [exporting, setExporting] = useState(false);

  const fetchItems = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(API_URL);
      if (!res.ok) {
        throw new Error(
          res.status === 401
            ? "Authentication required (401)."
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

  const resetInputs = () => {
    setSelected(null);
    setSearch("");
    setGoodInput("");
    setRepairInput("");
    setRejectedInput("");
  };

  const parseQty = (v: string) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  };

  const handleAdd = () => {
    if (!selected) {
      toast.error("Pick an item first");
      return;
    }
    const good = parseQty(goodInput);
    const repair = parseQty(repairInput);
    const rejected = parseQty(rejectedInput);
    if (good + repair + rejected <= 0) {
      toast.error("Enter at least one quantity");
      return;
    }

    setAdding(true);
    try {
      const existingIdx = rows.findIndex((r) => r.itemId === selected.id);
      if (existingIdx >= 0) {
        setRows((prev) => {
          const ex = prev[existingIdx];
          const updated: ReturnRow = {
            ...ex,
            goodQty: ex.goodQty + good,
            repairQty: ex.repairQty + repair,
            rejectedQty: ex.rejectedQty + rejected,
          };
          return [updated, ...prev.filter((_, i) => i !== existingIdx)];
        });
        toast.message(`Updated "${selected.name}"`);
      } else {
        setRows((prev) => [
          {
            rowId: uid(),
            itemId: selected.id,
            name: selected.name,
            goodQty: good,
            repairQty: repair,
            rejectedQty: rejected,
            price: selected.itemPrice,
            categoryName: selected.categoryName,
          },
          ...prev,
        ]);
        toast.success(`Added "${selected.name}"`);
      }
      resetInputs();
    } finally {
      setAdding(false);
    }
  };

  const updateQty = (rowId: string, field: QtyField, val: number) => {
    const n = Number.isFinite(val) && val >= 0 ? Math.floor(val) : 0;
    setRows((prev) =>
      prev.map((r) => (r.rowId === rowId ? { ...r, [field]: n } : r)),
    );
  };

  const removeRow = (rowId: string) =>
    setRows((prev) => prev.filter((r) => r.rowId !== rowId));

  const setField = (k: keyof ReturnMeta, v: string) =>
    setMeta((m) => ({ ...m, [k]: v }));

  const handleExport = async () => {
    if (rows.length === 0) return;
    if (!meta.projectName.trim()) {
      toast.error("Please enter a Project / BOM number");
      return;
    }
    const hasAnyQty = rows.some(
      (r) => r.goodQty + r.repairQty + r.rejectedQty > 0,
    );
    if (!hasAnyQty) {
      toast.error("Enter at least one quantity");
      return;
    }
    setExporting(true);
    try {
      const file = await exportReturnsToXlsx(rows, meta);
      toast.success(`Exported ${file}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const totals = rows.reduce(
    (a, r) => {
      a.good += r.goodQty;
      a.repair += r.repairQty;
      a.rejected += r.rejectedQty;
      return a;
    },
    { good: 0, repair: 0, rejected: 0 },
  );

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="sticky top-0 z-20 border-b border-border bg-primary text-primary-foreground shadow-sm">
        <div className="mx-auto max-w-2xl px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <Undo2 className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h1 className="text-base font-bold leading-tight">Return Items</h1>
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
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-4 space-y-4">
        {/* Return details */}
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            Return details
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              label="Project / BOM No"
              value={meta.projectName}
              onChange={(v) => setField("projectName", v)}
              placeholder="e.g. BOM-2026-0142"
              required
            />
            <Field
              label="Returned Site Location"
              value={meta.siteLocation}
              onChange={(v) => setField("siteLocation", v)}
              placeholder="City / venue"
            />
          </div>
          <div className="mt-3 space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Description
            </label>
            <textarea
              value={meta.description}
              onChange={(e) => setField("description", e.target.value)}
              placeholder="BOM numbers, notes, remarks…"
              rows={3}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </section>

        {/* Add item */}
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

          <div className="mt-3 grid grid-cols-3 gap-2">
            <QtyField
              label="Good"
              tone="good"
              value={goodInput}
              onChange={setGoodInput}
            />
            <QtyField
              label="Repair"
              tone="repair"
              value={repairInput}
              onChange={setRepairInput}
            />
            <QtyField
              label="Rejected"
              tone="rejected"
              value={rejectedInput}
              onChange={setRejectedInput}
            />
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
            Add to Return
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

        {/* Items list */}
        <section>
          <div className="mb-2 flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold text-foreground">
              Returned Items
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
                Search above to add items to the return.
              </p>
            </div>
          )}

          {rows.length > 0 && (
            <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
              <ul className="divide-y divide-border">
                {rows.map((row) => (
                  <ReturnRowItem
                    key={row.rowId}
                    row={row}
                    onChangeQty={(f, v) => updateQty(row.rowId, f, v)}
                    onRemove={() => removeRow(row.rowId)}
                  />
                ))}
              </ul>
            </div>
          )}
        </section>
      </main>

      <footer className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <div className="flex-1 text-xs text-muted-foreground">
            <div className="font-semibold text-foreground">
              Good {totals.good} · Repair {totals.repair} · Rejected{" "}
              {totals.rejected}
            </div>
            <div>{rows.length} rows</div>
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

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
      />
    </div>
  );
}

const TONE_CLASSES = {
  good: {
    label: "text-emerald-700",
    input:
      "border-emerald-300 focus:border-emerald-500 focus:ring-emerald-500/30",
    chip: "bg-emerald-100 text-emerald-800",
  },
  repair: {
    label: "text-amber-700",
    input: "border-amber-300 focus:border-amber-500 focus:ring-amber-500/30",
    chip: "bg-amber-100 text-amber-800",
  },
  rejected: {
    label: "text-red-700",
    input: "border-red-300 focus:border-red-500 focus:ring-red-500/30",
    chip: "bg-red-100 text-red-800",
  },
} as const;

type Tone = keyof typeof TONE_CLASSES;

function QtyField({
  label,
  tone,
  value,
  onChange,
}: {
  label: string;
  tone: Tone;
  value: string;
  onChange: (v: string) => void;
}) {
  const t = TONE_CLASSES[tone];
  return (
    <div className="space-y-1">
      <label
        className={cn(
          "text-[10px] font-semibold uppercase tracking-wide",
          t.label,
        )}
      >
        {label}
      </label>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        value={value}
        placeholder="0"
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-10 w-full rounded-lg border bg-background px-2 text-center text-sm font-semibold text-foreground focus:outline-none focus:ring-1",
          t.input,
        )}
      />
    </div>
  );
}

function QtyChip({
  label,
  tone,
  value,
  onChange,
}: {
  label: string;
  tone: Tone;
  value: number;
  onChange: (n: number) => void;
}) {
  const t = TONE_CLASSES[tone];
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = () => {
    const n = Number(val);
    if (Number.isFinite(n) && n >= 0) onChange(Math.floor(n));
    else setVal(String(value));
    setEditing(false);
  };

  const cancel = () => {
    setVal(String(value));
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="inline-flex items-center gap-1">
        <span className={cn("text-[10px] font-semibold", t.label)}>{label}</span>
        <input
          ref={inputRef}
          type="number"
          inputMode="numeric"
          min={0}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") cancel();
          }}
          className={cn(
            "w-14 rounded-md border bg-background px-1.5 py-0.5 text-center text-xs font-semibold",
            t.input,
          )}
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setVal(String(value));
        setEditing(true);
      }}
      aria-label={`Edit ${label}`}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
        t.chip,
      )}
    >
      <span className="opacity-70">{label}:</span>
      {value}
      <Pencil className="h-3 w-3 opacity-60" />
    </button>
  );
}

function ReturnRowItem({
  row,
  onChangeQty,
  onRemove,
}: {
  row: ReturnRow;
  onChangeQty: (field: QtyField, value: number) => void;
  onRemove: () => void;
}) {
  const total = row.goodQty + row.repairQty + row.rejectedQty;
  return (
    <li className="px-3 py-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-foreground">
            {row.name}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {row.categoryName && (
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
                {row.categoryName}
              </span>
            )}
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
              {formatPrice(row.price)}
            </span>
            <span className="text-[10px] text-muted-foreground">
              Total: {total}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <QtyChip
              label="Good"
              tone="good"
              value={row.goodQty}
              onChange={(n) => onChangeQty("goodQty", n)}
            />
            <QtyChip
              label="Repair"
              tone="repair"
              value={row.repairQty}
              onChange={(n) => onChangeQty("repairQty", n)}
            />
            <QtyChip
              label="Rejected"
              tone="rejected"
              value={row.rejectedQty}
              onChange={(n) => onChangeQty("rejectedQty", n)}
            />
          </div>
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-5 w-5" />
        </button>
      </div>
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
