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
  RefreshCw,
  AlertCircle,
  Loader2,
  Undo2,
  Pencil,
  ImagePlus,
  X,
} from "lucide-react";
import { type BomApiItem } from "@/lib/bom-types";
import {
  exportReturnsToXlsx,
  MAX_ROW_IMAGES,
  type ReturnRow,
  type ReturnMeta,
} from "@/lib/returns-export";
import { cn } from "@/lib/utils";
import { apiFetch, isSessionExpired, SESSION_TIMED_OUT } from "@/lib/api-client";

export const Route = createFileRoute("/returns")({
  head: () => ({
    meta: [
      { title: `Return Items — ${APP_NAME}` },
      {
        name: "description",
        content:
          "Record returned rental items with vehicle details and split quantities by Good and Damaged.",
      },
      { property: "og:title", content: `Return Items — ${APP_NAME}` },
      {
        property: "og:description",
        content:
          "Record returned rental items with vehicle details and split quantities by Good and Damaged.",
      },
    ],
  }),
  component: ReturnsPage,
});

const API_URL = "/api/items/bomitems";

type QtyField = "goodQty" | "damagedQty";

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function formatPrice(p: number | null) {
  if (p === null || p === undefined) return "N/A";
  return `₹${p.toLocaleString()}`;
}

const MAX_IMAGE_DIM = 900;

function fileToCompressedDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read failed"));
    reader.onload = () => {
      const src = String(reader.result);
      const img = new Image();
      img.onerror = () => reject(new Error("decode failed"));
      img.onload = () => {
        const scale = Math.min(
          1,
          MAX_IMAGE_DIM / Math.max(img.width, img.height),
        );
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(src);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}

function ReturnsPage() {
  const [items, setItems] = useState<BomApiItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [meta, setMeta] = useState<ReturnMeta>({
    projectName: "",
    siteLocation: "",
    description: "",
    vehicleNo: "",
    vehicleType: "",
    chalanNo: "",
    receivedDate: "",
  });

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<BomApiItem | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [adding, setAdding] = useState(false);

  const [goodInput, setGoodInput] = useState("");
  const [damagedInput, setDamagedInput] = useState("");


  const [rows, setRows] = useState<ReturnRow[]>([]);
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

  const resetInputs = () => {
    setSelected(null);
    setSearch("");
    setGoodInput("");
    setDamagedInput("");
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
    const damaged = parseQty(damagedInput);
    if (good + damaged <= 0) {
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
            damagedQty: ex.damagedQty + damaged,
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
            damagedQty: damaged,
            price: selected.itemPrice,
            categoryName: selected.categoryName,
            images: [],
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

  const addImages = async (rowId: string, files: FileList | null) => {
    if (!files || files.length === 0) return;
    const row = rows.find((r) => r.rowId === rowId);
    const current = row?.images ?? [];
    const slots = MAX_ROW_IMAGES - current.length;
    if (slots <= 0) {
      toast.error(`Max ${MAX_ROW_IMAGES} images per item`);
      return;
    }
    const picked = Array.from(files).slice(0, slots);
    try {
      const encoded = await Promise.all(picked.map(fileToCompressedDataUrl));
      setRows((prev) =>
        prev.map((r) =>
          r.rowId === rowId
            ? {
                ...r,
                images: [...(r.images ?? []), ...encoded].slice(
                  0,
                  MAX_ROW_IMAGES,
                ),
              }
            : r,
        ),
      );
    } catch {
      toast.error("Could not read image");
    }
  };

  const removeImage = (rowId: string, index: number) =>
    setRows((prev) =>
      prev.map((r) =>
        r.rowId === rowId
          ? { ...r, images: (r.images ?? []).filter((_, i) => i !== index) }
          : r,
      ),
    );

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
    const hasAnyQty = rows.some((r) => r.goodQty + r.damagedQty > 0);
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
      a.damaged += r.damagedQty;
      return a;
    },
    { good: 0, damaged: 0 },
  );


  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-primary text-primary-foreground shadow-sm">
        <div className="mx-auto max-w-2xl px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <Undo2 className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h1 className="text-base font-bold leading-tight">Return Items</h1>
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

        {/* Vehicle details */}
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            Vehicle details
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              label="Vehicle No"
              value={meta.vehicleNo}
              onChange={(v) => setField("vehicleNo", v)}
              placeholder="e.g. MH 12 AB 1234"
            />
            <Field
              label="Vehicle Type"
              value={meta.vehicleType}
              onChange={(v) => setField("vehicleType", v)}
              placeholder="e.g. Tempo / Truck"
            />
            <Field
              label="Chalan No"
              value={meta.chalanNo}
              onChange={(v) => setField("chalanNo", v)}
              placeholder="e.g. CH-00123"
            />
            <Field
              label="Received Date"
              type="date"
              value={meta.receivedDate}
              onChange={(v) => setField("receivedDate", v)}
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

          <div className="mt-3 grid grid-cols-2 gap-2">
            <QtyField
              label="Good"
              tone="good"
              value={goodInput}
              onChange={setGoodInput}
            />
            <QtyField
              label="Damaged"
              tone="damaged"
              value={damagedInput}
              onChange={setDamagedInput}
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
                    onAddImages={(files) => void addImages(row.rowId, files)}
                    onRemoveImage={(i) => removeImage(row.rowId, i)}
                  />
                ))}

              </ul>
            </div>
          )}
        </section>
      </main>

      <footer className="sticky bottom-0 z-20 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <div className="flex-1 text-xs text-muted-foreground">
            <div className="font-semibold text-foreground">
              Good {totals.good} · Damaged {totals.damaged}
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
  damaged: {
    label: "text-amber-700",
    input: "border-amber-300 focus:border-amber-500 focus:ring-amber-500/30",
    chip: "bg-amber-100 text-amber-800",
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
  onAddImages,
  onRemoveImage,
}: {
  row: ReturnRow;
  onChangeQty: (field: QtyField, value: number) => void;
  onRemove: () => void;
  onAddImages: (files: FileList | null) => void;
  onRemoveImage: (index: number) => void;
}) {
  const total = row.goodQty + row.damagedQty;
  const fileRef = useRef<HTMLInputElement>(null);
  const images = row.images ?? [];
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
              label="Damaged"
              tone="damaged"
              value={row.damagedQty}
              onChange={(n) => onChangeQty("damagedQty", n)}
            />
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {images.map((src, i) => (
              <div
                key={i}
                className="relative h-14 w-14 overflow-hidden rounded-lg border border-border"
              >
                <img
                  src={src}
                  alt={`Damaged ${row.name} photo ${i + 1}`}
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => onRemoveImage(i)}
                  aria-label={`Remove photo ${i + 1}`}
                  className="absolute right-0 top-0 flex h-5 w-5 items-center justify-center rounded-bl-lg bg-destructive text-destructive-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {images.length < MAX_ROW_IMAGES && (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    onAddImages(e.target.files);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex h-14 w-14 flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-border text-[9px] text-muted-foreground hover:border-primary/50"
                >
                  <ImagePlus className="h-4 w-4" />
                  Photo
                </button>
              </>
            )}
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
