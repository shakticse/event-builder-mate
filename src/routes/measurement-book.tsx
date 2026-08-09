import { APP_NAME } from "@/lib/app-config";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  ClipboardCheck,
  FileSpreadsheet,
  Loader2,
  Plus,
  RefreshCw,
  Ruler,
  Search,
  Trash2,
  X,
} from "lucide-react";

import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import {
  computeQuantity,
  fieldsForUom,
  formatMoney,
  labelForField,
  type MbEntry,
  type MbStatus,
  type ProjectApi,
  type ProjectServiceApi,
} from "@/lib/measurement-book";
import { exportMeasurementBookToXlsx } from "@/lib/measurement-book-export";


export const Route = createFileRoute("/measurement-book")({
  head: () => ({
    meta: [
      { title: `Measurement Book — ${APP_NAME}` },
      {
        name: "description",
        content:
          "Capture vendor work done on a project site with measurements, rates and approval status.",
      },
    ],
  }),
  component: MeasurementBookPage,
});

const STATUSES: MbStatus[] = ["Pending", "Approved", "Disputed"];

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const inputCls =
  "h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:border-primary/40 focus:outline-none";

function MeasurementBookPage() {
  const [projects, setProjects] = useState<ProjectApi[]>([]);
  const [services, setServices] = useState<ProjectServiceApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [projectId, setProjectId] = useState("");
  const [entries, setEntries] = useState<MbEntry[]>([]);
  const [exporting, setExporting] = useState(false);

  const [showPicker, setShowPicker] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ProjectServiceApi | null>(null);

  const [vendorName, setVendorName] = useState("");
  const [eventName, setEventName] = useState("");
  const [location, setLocation] = useState("");
  const [workDescription, setWorkDescription] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [nos, setNos] = useState("1");
  const [unitRate, setUnitRate] = useState("");
  const [status, setStatus] = useState<MbStatus>("Pending");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [pRes, sRes] = await Promise.all([
        apiFetch("/api/project"),
        apiFetch("/api/ProjectServices"),
      ]);
      if (!pRes.ok || !sRes.ok) {
        throw new Error(
          pRes.status === 401 || sRes.status === 401
            ? "Authentication required (401)."
            : `Failed to load data (${!pRes.ok ? pRes.status : sRes.status})`,
        );
      }
      const p = (await pRes.json()) as ProjectApi[];
      const s = (await sRes.json()) as ProjectServiceApi[];
      setProjects(Array.isArray(p) ? p : []);
      setServices(Array.isArray(s) ? s : []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load data";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return services.slice(0, 50);
    return services
      .filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.category || "").toLowerCase().includes(q),
      )
      .slice(0, 50);
  }, [services, search]);

  const activeFields = selected ? fieldsForUom(selected.uom) : [];

  const previewQty = selected
    ? computeQuantity(selected.uom, {
        width: Number(width),
        height: Number(height),
        weight: Number(weight),
        nos: Number(nos),
      })
    : 0;
  const previewAmount = previewQty * (Number(unitRate) || 0);

  const summary = useMemo(() => {
    const total = entries.reduce((a, e) => a + e.amount, 0);
    const by = (s: MbStatus) =>
      entries.filter((e) => e.status === s).reduce((a, e) => a + e.amount, 0);
    return {
      count: entries.length,
      total,
      pending: by("Pending"),
      approved: by("Approved"),
      disputed: by("Disputed"),
    };
  }, [entries]);

  const resetForm = () => {
    setSelected(null);
    setSearch("");
    setVendorName("");
    setEventName("");
    setLocation("");
    setWorkDescription("");
    setWidth("");
    setHeight("");
    setWeight("");
    setNos("1");
    setUnitRate("");
    setStatus("Pending");
  };

  const handleAdd = () => {
    if (!selected) {
      toast.error("Pick a service first");
      return;
    }
    if (!vendorName.trim()) {
      toast.error("Vendor name is required");
      return;
    }
    const rate = Number(unitRate);
    if (!Number.isFinite(rate) || rate <= 0) {
      toast.error("Unit rate must be greater than 0");
      return;
    }
    if (previewQty <= 0) {
      toast.error("Enter valid measurement details");
      return;
    }

    const entry: MbEntry = {
      rowId: uid(),
      serviceId: selected.id,
      serviceName: selected.name,
      category: selected.category,
      uom: selected.uom,
      vendorName: vendorName.trim(),
      eventName: eventName.trim(),
      location: location.trim(),
      workDescription: workDescription.trim(),
      width: activeFields.includes("width") ? Number(width) || 0 : null,
      height: activeFields.includes("height") ? Number(height) || 0 : null,
      weight: activeFields.includes("weight") ? Number(weight) || 0 : null,
      nos: Number(nos) || 0,
      unitRate: rate,
      quantity: previewQty,
      amount: Math.round(previewQty * rate * 100) / 100,
      status,
    };
    setEntries((prev) => [entry, ...prev]);
    toast.success(`Added "${selected.name}"`);
    resetForm();
  };

  const removeEntry = (rowId: string) =>
    setEntries((prev) => prev.filter((e) => e.rowId !== rowId));

  const setEntryStatus = (rowId: string, s: MbStatus) =>
    setEntries((prev) =>
      prev.map((e) => (e.rowId === rowId ? { ...e, status: s } : e)),
    );

  const handleExport = async () => {
    if (entries.length === 0) return;
    const projectName =
      projects.find((p) => String(p.id) === projectId)?.projectName ?? "";
    if (!projectName) {
      toast.error("Please select a project");
      return;
    }
    setExporting(true);
    try {
      const file = await exportMeasurementBookToXlsx(entries, { projectName });
      toast.success(`Exported ${file}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">

      <header className="sticky top-0 z-20 border-b border-border bg-primary text-primary-foreground shadow-sm">
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <Ruler className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h1 className="text-base font-bold leading-tight">
              Measurement Book
            </h1>
            <p className="text-xs leading-tight text-primary-foreground/70">
              Vendor work done on site
            </p>
          </div>
          <button
            onClick={() => void load()}
            className="rounded-md p-2 text-primary-foreground/80 hover:bg-white/10"
            aria-label="Refresh"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-4 py-4">
        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <div className="flex-1">{error}</div>
            <button onClick={() => void load()} className="font-semibold underline">
              Retry
            </button>
          </div>
        )}

        {/* Project + summary */}
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Project</h2>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className={inputCls}
            aria-label="Project"
          >
            <option value="">
              {loading ? "Loading projects…" : "Select project"}
            </option>
            {projects.map((p) => (
              <option key={p.id} value={String(p.id)}>
                {p.projectName}
              </option>
            ))}
          </select>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <SummaryTile label="Services added" value={String(summary.count)} />
            <SummaryTile label="Total amount" value={formatMoney(summary.total)} />
            <SummaryTile
              label="Pending amount"
              value={formatMoney(summary.pending)}
              tone="pending"
            />
            <SummaryTile
              label="Disputed amount"
              value={formatMoney(summary.disputed)}
              tone="disputed"
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Approved: {formatMoney(summary.approved)}
          </p>
        </section>

        {/* Add service */}
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            Add a service
          </h2>

          <button
            type="button"
            onClick={() => setShowPicker(true)}
            disabled={loading && services.length === 0}
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
                  {loading ? "Loading services…" : "Search & select a service"}
                </span>
              )}
            </span>
            {selected && (
              <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                {selected.uom}
              </span>
            )}
          </button>

          {selected && (
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Vendor name *">
                  <input
                    value={vendorName}
                    onChange={(e) => setVendorName(e.target.value)}
                    placeholder="e.g. Sharma Fabricators"
                    className={inputCls}
                  />
                </Field>
                <Field label="Event name">
                  <input
                    value={eventName}
                    onChange={(e) => setEventName(e.target.value)}
                    placeholder="e.g. UPITS 2026"
                    className={inputCls}
                  />
                </Field>
                <Field label="Location">
                  <input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Hall 3, Stall A-12"
                    className={inputCls}
                  />
                </Field>
                <Field label="Unit rate (₹) *">
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    value={unitRate}
                    onChange={(e) => setUnitRate(e.target.value)}
                    placeholder="0"
                    className={inputCls}
                  />
                </Field>
              </div>

              <Field label="Work description">
                <textarea
                  value={workDescription}
                  onChange={(e) => setWorkDescription(e.target.value)}
                  rows={2}
                  placeholder="Describe the work executed"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary/40 focus:outline-none"
                />
              </Field>

              <div>
                <div className="mb-1 text-xs font-medium text-muted-foreground">
                  Measurement ({selected.uom})
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {activeFields.map((f) => (
                    <Field key={f} label={labelForField(f, selected.uom)}>
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        value={
                          f === "width"
                            ? width
                            : f === "height"
                              ? height
                              : f === "weight"
                                ? weight
                                : nos
                        }
                        onChange={(e) => {
                          const v = e.target.value;
                          if (f === "width") setWidth(v);
                          else if (f === "height") setHeight(v);
                          else if (f === "weight") setWeight(v);
                          else setNos(v);
                        }}
                        className={inputCls}
                      />
                    </Field>
                  ))}
                </div>
              </div>

              <Field label="Status">
                <div className="flex gap-2">
                  {STATUSES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatus(s)}
                      className={cn(
                        "h-10 flex-1 rounded-lg border text-xs font-semibold transition",
                        status === s
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input bg-background text-muted-foreground",
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </Field>

              <div className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-sm">
                <span className="text-muted-foreground">
                  Qty {previewQty} {selected.uom}
                </span>
                <span className="font-bold text-foreground">
                  {formatMoney(previewAmount)}
                </span>
              </div>

              <button
                type="button"
                onClick={handleAdd}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground shadow-sm transition active:scale-[0.98]"
              >
                <Plus className="h-4 w-4" />
                Add to Measurement Book
              </button>
            </div>
          )}
        </section>

        {/* List */}
        <section>
          <div className="mb-2 flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold text-foreground">
              Added services
            </h2>
            <span className="text-xs text-muted-foreground">
              {entries.length} {entries.length === 1 ? "entry" : "entries"}
            </span>
          </div>

          {entries.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
              <ClipboardCheck className="mx-auto h-10 w-10 text-muted-foreground/50" />
              <p className="mt-3 text-sm font-medium text-foreground">
                No services recorded yet
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Select a service above to capture measurements.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {entries.map((e) => (
                <li
                  key={e.rowId}
                  className="rounded-2xl border border-border bg-card p-4 shadow-sm"
                >
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {e.serviceName}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {e.vendorName}
                        {e.eventName ? ` · ${e.eventName}` : ""}
                        {e.location ? ` · ${e.location}` : ""}
                      </p>
                    </div>
                    <button
                      onClick={() => removeEntry(e.rowId)}
                      className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label={`Delete ${e.serviceName}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {e.workDescription && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {e.workDescription}
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Chip>{e.uom}</Chip>
                    {e.width !== null && <Chip>W {e.width}</Chip>}
                    {e.height !== null && <Chip>H {e.height}</Chip>}
                    {e.weight !== null && <Chip>Wt {e.weight}</Chip>}
                    <Chip>Nos {e.nos}</Chip>
                    <Chip>
                      Qty {e.quantity} {e.uom}
                    </Chip>
                    <Chip>Rate {formatMoney(e.unitRate)}</Chip>
                    <Chip tone="amount">{formatMoney(e.amount)}</Chip>
                  </div>

                  <div className="mt-3 flex gap-2">
                    {STATUSES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setEntryStatus(e.rowId, s)}
                        className={cn(
                          "h-8 flex-1 rounded-md border text-[11px] font-semibold transition",
                          e.status === s
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-input bg-background text-muted-foreground",
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <footer className="sticky bottom-0 z-20 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <div className="flex-1 text-xs text-muted-foreground">
            <div className="font-semibold text-foreground">
              {summary.count} {summary.count === 1 ? "entry" : "entries"}
            </div>
            <div>Total {formatMoney(summary.total)}</div>
          </div>
          <button
            type="button"
            onClick={() => void handleExport()}
            disabled={entries.length === 0 || exporting}
            title={entries.length === 0 ? "Add entries first" : "Submit & export"}
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
        <ServicePickerSheet
          services={filtered}
          loading={loading}
          search={search}
          onSearch={setSearch}
          onPick={(s) => {
            setSelected(s);
            setWidth("");
            setHeight("");
            setWeight("");
            setNos("1");
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
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium text-muted-foreground">
        {label}
      </div>
      {children}
    </div>
  );
}

function Chip({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: "amount";
}) {
  return (
    <span
      className={cn(
        "rounded-full border px-2.5 py-1 text-[11px] font-medium",
        tone === "amount"
          ? "border-accent bg-accent/15 font-bold text-foreground"
          : "border-border bg-muted/60 text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

function SummaryTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "pending" | "disputed";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-muted/40 p-3",
        tone === "pending" && "border-accent/40 bg-accent/10",
        tone === "disputed" && "border-destructive/30 bg-destructive/5",
      )}
    >
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate text-sm font-bold text-foreground">
        {value}
      </div>
    </div>
  );
}

function ServicePickerSheet({
  services,
  loading,
  search,
  onSearch,
  onPick,
  onClose,
}: {
  services: ProjectServiceApi[];
  loading: boolean;
  search: string;
  onSearch: (v: string) => void;
  onPick: (s: ProjectServiceApi) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          autoFocus
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search services…"
          className="h-10 flex-1 border-0 bg-transparent text-sm text-foreground focus:outline-none"
        />
        <button
          onClick={onClose}
          className="rounded-md p-2 text-muted-foreground hover:bg-muted"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : services.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            No services found.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {services.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => onPick(s)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-accent/10"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {s.name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {s.category}
                    </p>
                  </div>
                  <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                    {s.uom}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
