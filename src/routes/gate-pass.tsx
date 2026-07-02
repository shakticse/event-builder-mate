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
  ClipboardList,
} from "lucide-react";
import { type BomApiItem } from "@/lib/bom-types";
import {
  exportGatePassToXlsx,
  type GatePassRow,
  type GatePassMeta,
} from "@/lib/gate-pass-export";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-client";

export const Route = createFileRoute("/gate-pass")({
  head: () => ({
    meta: [
      { title: "Gate Pass — Event Rentals" },
      {
        name: "description",
        content: "Create and manage gate passes for event rental equipment.",
      },
      { property: "og:title", content: "Gate Pass — Event Rentals" },
      {
        property: "og:description",
        content: "Create and manage gate passes for event rental equipment.",
      },
    ],
  }),
  component: GatePassPage,
});

const API_URL = "/api/items/bomitems";

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function formatPrice(p: number | null) {
  if (p === null || p === undefined) return "N/A";
  return `₹${p.toLocaleString()}`;
}

const VEHICLE_TYPES = [
  "Tempo",
  "Pickup",
  "Mini Truck",
  "Truck",
  "Container",
  "Trailer",
  "Van",
  "Other",
];

function GatePassPage() {
  const [items, setItems] = useState<BomApiItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [meta, setMeta] = useState<GatePassMeta>({
    projectName: "",
    projectLocation: "",
    vehicleType: "",
    vehicleNumber: "",
    driverName: "",
    phoneNumber: "",
  });

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<BomApiItem | null>(null);
  const [qtyInput, setQtyInput] = useState<string>("1");
  const [showPicker, setShowPicker] = useState(false);
  const [adding, setAdding] = useState(false);

  const [rows, setRows] = useState<GatePassRow[]>([]);

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

  // Only standalone items — exclude grouped items entirely.
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

    setAdding(true);
    try {
      const existingIdx = rows.findIndex((r) => r.itemId === selected.id);
      if (existingIdx >= 0) {
        setRows((prev) => {
          const existing = prev[existingIdx];
          const updated = { ...existing, quantity: existing.quantity + qty };
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

  const removeRow = (rowId: string) => {
    setRows((prev) => prev.filter((r) => r.rowId !== rowId));
  };

  const handleExport = () => {
    if (rows.length === 0) return;
    if (!meta.projectName.trim()) {
      toast.error("Please enter a project name");
      return;
    }
    try {
      const file = exportGatePassToXlsx(rows, meta);
      toast.success(`Exported ${file}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    }
  };

  const setField = (k: keyof GatePassMeta, v: string) =>
    setMeta((m) => ({ ...m, [k]: v }));

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="sticky top-0 z-20 border-b border-border bg-primary text-primary-foreground shadow-sm">
        <div className="mx-auto max-w-2xl px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h1 className="text-base font-bold leading-tight">Gate Pass</h1>
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
        {/* Project details */}
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            Project details
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              label="Project name"
              value={meta.projectName}
              onChange={(v) => setField("projectName", v)}
              placeholder="e.g. ACME Wedding"
              required
            />
            <Field
              label="Project location"
              value={meta.projectLocation}
              onChange={(v) => setField("projectLocation", v)}
              placeholder="City / venue"
            />
          </div>
        </section>

        {/* Vehicle & driver */}
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            Vehicle & driver
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Vehicle type
              </label>
              <select
                value={meta.vehicleType}
                onChange={(e) => setField("vehicleType", e.target.value)}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Select…</option>
                {VEHICLE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <Field
              label="Vehicle number"
              value={meta.vehicleNumber}
              onChange={(v) => setField("vehicleNumber", v.toUpperCase())}
              placeholder="e.g. MH12 AB 1234"
            />
            <Field
              label="Driver name"
              value={meta.driverName}
              onChange={(v) => setField("driverName", v)}
              placeholder="Full name"
            />
            <Field
              label="Phone number"
              value={meta.phoneNumber}
              onChange={(v) =>
                setField("phoneNumber", v.replace(/[^0-9+\-\s]/g, "").slice(0, 15))
              }
              placeholder="10-digit mobile"
              type="tel"
              inputMode="tel"
            />
          </div>
        </section>

        {/* Add-item card */}
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
              Add to Gate Pass
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

        {/* Items list */}
        <section>
          <div className="mb-2 flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold text-foreground">
              Gate Pass Items
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
                Search above to add items to the gate pass.
              </p>
            </div>
          )}

          <div className="space-y-3">
            {rows.length > 0 && (
              <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
                <ul className="divide-y divide-border">
                  {rows.map((row) => (
                    <GatePassRowItem
                      key={row.rowId}
                      row={row}
                      onChangeQty={(n) => updateRowQty(row.rowId, n)}
                      onRemove={() => removeRow(row.rowId)}
                    />
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      </main>

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
  inputMode,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
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
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
      />
    </div>
  );
}

function GatePassRowItem({
  row,
  onChangeQty,
  onRemove,
}: {
  row: GatePassRow;
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
              aria-label="Edit quantity"
              className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-2.5 py-1 text-xs font-semibold text-foreground shadow-sm hover:border-primary/40 hover:bg-accent/10 active:bg-accent/20"
            >
              <span className="text-muted-foreground">Qty:</span>
              {row.quantity}
              <Pencil className="h-3 w-3 text-muted-foreground" />
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
