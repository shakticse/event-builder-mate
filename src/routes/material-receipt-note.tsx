import { APP_NAME } from "@/lib/app-config";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
  ClipboardCheck,
} from "lucide-react";
import { type BomApiItem } from "@/lib/bom-types";
import { exportMrnToXlsx, type MrnRow, type MrnMeta } from "@/lib/mrn-export";
import { cn } from "@/lib/utils";
import { apiFetch, isSessionExpired, SESSION_TIMED_OUT } from "@/lib/api-client";

const DESCRIPTION =
  "Record goods received against a purchase order with vendor details, item quantities and Excel export.";

export const Route = createFileRoute("/material-receipt-note")({
  head: () => ({
    meta: [
      { title: `Material Receipt Note — ${APP_NAME}` },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: `Material Receipt Note — ${APP_NAME}` },
      { property: "og:description", content: DESCRIPTION },
    ],
  }),
  component: MaterialReceiptNotePage,
});

const API_URL = "/api/items/bomitems";

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function formatPrice(p: number | null) {
  if (p === null || p === undefined) return "N/A";
  return `₹${p.toLocaleString()}`;
}

function MaterialReceiptNotePage() {
  const [items, setItems] = useState<BomApiItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [meta, setMeta] = useState<MrnMeta>({
    poNumber: "",
    mrnNumber: "",
    vendorName: "",
    vendorContact: "",
    vendorGstin: "",
    vendorAddress: "",
    invoiceNo: "",
    receivedDate: "",
    remarks: "",
  });

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<BomApiItem | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [adding, setAdding] = useState(false);
  const [qtyInput, setQtyInput] = useState("");

  const [rows, setRows] = useState<MrnRow[]>([]);
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

  const setField = (k: keyof MrnMeta, v: string) =>
    setMeta((m) => ({ ...m, [k]: v }));

  const handleAdd = () => {
    if (!selected) {
      toast.error("Pick an item first");
      return;
    }
    const n = Number(qtyInput);
    const qty = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
    if (qty <= 0) {
      toast.error("Enter a received quantity");
      return;
    }
    setAdding(true);
    try {
      const existingIdx = rows.findIndex((r) => r.itemId === selected.id);
      if (existingIdx >= 0) {
        setRows((prev) => {
          const ex = prev[existingIdx];
          const updated: MrnRow = { ...ex, receivedQty: ex.receivedQty + qty };
          return [updated, ...prev.filter((_, i) => i !== existingIdx)];
        });
        toast.message(`Updated "${selected.name}"`);
      } else {
        setRows((prev) => [
          {
            rowId: uid(),
            itemId: selected.id,
            name: selected.name,
            receivedQty: qty,
            price: selected.itemPrice,
            categoryName: selected.categoryName,
          },
          ...prev,
        ]);
        toast.success(`Added "${selected.name}"`);
      }
      setSelected(null);
      setSearch("");
      setQtyInput("");
    } finally {
      setAdding(false);
    }
  };

  const removeRow = (rowId: string) =>
    setRows((prev) => prev.filter((r) => r.rowId !== rowId));

  const handleExport = async () => {
    if (rows.length === 0) return;
    if (!meta.poNumber.trim()) {
      toast.error("Please enter a PO number");
      return;
    }
    if (!meta.vendorName.trim()) {
      toast.error("Please enter a vendor name");
      return;
    }
    setExporting(true);
    try {
      const file = await exportMrnToXlsx(rows, meta);
      toast.success(`Exported ${file}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const totalQty = rows.reduce((a, r) => a + r.receivedQty, 0);

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="sticky top-0 z-20 border-b border-border bg-primary text-primary-foreground shadow-sm">
        <div className="mx-auto max-w-2xl px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <ClipboardCheck className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h1 className="text-base font-bold leading-tight">
                Material Receipt Note
              </h1>
              <p className="text-xs leading-tight text-primary-foreground/70">
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

      <main className="mx-auto max-w-2xl space-y-4 px-4 py-4">
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            Purchase order
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              label="PO No"
              value={meta.poNumber}
              onChange={(v) => setField("poNumber", v)}
              placeholder="e.g. PO-2026-0091"
              required
            />
            <Field
              label="MRN No"
              value={meta.mrnNumber}
              onChange={(v) => setField("mrnNumber", v)}
              placeholder="e.g. MRN-0042"
            />
            <Field
              label="Invoice No"
              value={meta.invoiceNo}
              onChange={(v) => setField("invoiceNo", v)}
              placeholder="e.g. INV-8891"
            />
            <Field
              label="Received Date"
              type="date"
              value={meta.receivedDate}
              onChange={(v) => setField("receivedDate", v)}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            Vendor details
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              label="Vendor Name"
              value={meta.vendorName}
              onChange={(v) => setField("vendorName", v)}
              placeholder="Supplier name"
              required
            />
            <Field
              label="Contact"
              value={meta.vendorContact}
              onChange={(v) => setField("vendorContact", v)}
              placeholder="Phone / email"
            />
            <Field
              label="GSTIN"
              value={meta.vendorGstin}
              onChange={(v) => setField("vendorGstin", v)}
              placeholder="e.g. 27AAAAA0000A1Z5"
            />
            <Field
              label="Address"
              value={meta.vendorAddress}
              onChange={(v) => setField("vendorAddress", v)}
              placeholder="City / full address"
            />
          </div>
          <div className="mt-3 space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Remarks
            </label>
            <textarea
              value={meta.remarks}
              onChange={(e) => setField("remarks", e.target.value)}
              placeholder="Condition on arrival, shortages, notes…"
              rows={3}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
            />
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

          <div className="mt-3 space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Received Qty
            </label>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={qtyInput}
              placeholder="0"
              onChange={(e) => setQtyInput(e.target.value)}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-center text-sm font-semibold text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
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
            Add to Receipt
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
              Received Items
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
                Search above to add received items.
              </p>
            </div>
          )}

          {rows.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <ul className="divide-y divide-border">
                {rows.map((row) => (
                  <li key={row.rowId} className="flex items-start gap-3 px-3 py-3">
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
                        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                          Received: {row.receivedQty}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeRow(row.rowId)}
                      aria-label={`Remove ${row.name}`}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </li>
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
              Total items {rows.length}
            </div>
            <div>Total quantity {totalQty}</div>
          </div>

          <button
            type="button"
            onClick={handleExport}
            disabled={rows.length === 0 || exporting}
            title={rows.length === 0 ? "Add items first" : "Submit & export"}
            className="flex h-12 items-center gap-2 rounded-xl bg-accent px-5 text-sm font-semibold text-accent-foreground shadow-md transition active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
          >
            {exporting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-5 w-5" />
            )}
            Submit & Export
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
