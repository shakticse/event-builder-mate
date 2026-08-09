import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  FileSpreadsheet,
  GitPullRequestArrow,
  Loader2,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";

import { APP_NAME } from "@/lib/app-config";
import {
  CHANGE_TYPES,
  STATUS_LABEL,
  inr,
  useChangeStore,
  type ChangeRequest,
  type ChangeStatus,
  type ChangeUrgency,
  type RouteTo,
} from "@/lib/change-request";
import { exportChangeRequestsToXlsx } from "@/lib/change-request-export";
import { cn } from "@/lib/utils";

const DESCRIPTION =
  "Capture on-site requirement changes, route them to the Project Manager or Account Manager, and communicate the decision back to the client.";

export const Route = createFileRoute("/change-request")({
  head: () => ({
    meta: [
      { title: `Change Request — ${APP_NAME}` },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: `Change Request — ${APP_NAME}` },
      { property: "og:description", content: DESCRIPTION },
    ],
  }),
  component: ChangeRequestPage,
});

const TABS: { value: "all" | ChangeStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "approved_client", label: "Billed to client" },
  { value: "approved_absorbed", label: "Absorbed" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
];

const STATUS_CLASS: Record<ChangeStatus, string> = {
  pending: "bg-amber-100 text-amber-800",
  approved_client: "bg-emerald-100 text-emerald-800",
  approved_absorbed: "bg-sky-100 text-sky-800",
  rejected: "bg-destructive/10 text-destructive",
};

const emptyForm = {
  projectName: "",
  clientName: "",
  siteLocation: "",
  requestedBy: "",
  eventDate: "",
  title: "",
  description: "",
  changeType: CHANGE_TYPES[0] as string,
  urgency: "medium" as ChangeUrgency,
  costImpact: "",
  timeImpactHours: "",
  routeTo: "project_manager" as RouteTo,
  clientCommunication: "",
};

function ChangeRequestPage() {
  const { items, hydrated, create, decide, remove, reset } = useChangeStore();
  const [form, setForm] = useState(emptyForm);
  const [tab, setTab] = useState<"all" | ChangeStatus>("pending");
  const [q, setQ] = useState("");
  const [exporting, setExporting] = useState(false);

  const setField = <K extends keyof typeof emptyForm>(
    k: K,
    v: (typeof emptyForm)[K],
  ) => setForm((f) => ({ ...f, [k]: v }));

  const stats = useMemo(() => {
    const pending = items.filter((i) => i.status === "pending");
    return {
      pending: pending.length,
      exposure: pending.reduce((s, i) => s + Math.max(0, i.costImpact), 0),
      billed: items
        .filter((i) => i.status === "approved_client")
        .reduce((s, i) => s + i.costImpact, 0),
      absorbed: items
        .filter((i) => i.status === "approved_absorbed")
        .reduce((s, i) => s + i.costImpact, 0),
    };
  }, [items]);

  const filtered: ChangeRequest[] = useMemo(() => {
    const s = q.trim().toLowerCase();
    return items
      .filter((i) => (tab === "all" ? true : i.status === tab))
      .filter((i) =>
        !s
          ? true
          : [i.title, i.projectName, i.clientName, i.refCode]
              .join(" ")
              .toLowerCase()
              .includes(s),
      );
  }, [items, tab, q]);

  const handleSubmit = () => {
    if (!form.projectName.trim()) return toast.error("Enter a project name");
    if (!form.clientName.trim()) return toast.error("Enter a client name");
    if (!form.title.trim()) return toast.error("Enter a change headline");

    const rec = create({
      projectName: form.projectName.trim(),
      clientName: form.clientName.trim(),
      siteLocation: form.siteLocation.trim(),
      requestedBy: form.requestedBy.trim(),
      eventDate: form.eventDate,
      title: form.title.trim(),
      description: form.description.trim(),
      changeType: form.changeType,
      urgency: form.urgency,
      costImpact: Number(form.costImpact) || 0,
      timeImpactHours: Number(form.timeImpactHours) || 0,
      routeTo: form.routeTo,
      clientCommunication: form.clientCommunication.trim(),
    });
    setForm(emptyForm);
    setTab("pending");
    toast.success(`${rec.refCode} raised`);
  };

  const handleExport = async () => {
    if (!items.length) return;
    setExporting(true);
    try {
      const file = await exportChangeRequestsToXlsx(items);
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
              <GitPullRequestArrow className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h1 className="text-base font-bold leading-tight">
                Site Change Control
              </h1>
              <p className="text-xs leading-tight text-primary-foreground/70">
                Requirement change management
              </p>
            </div>
            <button
              onClick={() => {
                if (items.length) {
                  reset();
                  toast.message("All change requests cleared");
                }
              }}
              disabled={!items.length}
              aria-label="Reset all change requests"
              className="rounded-md p-2 text-primary-foreground/80 hover:bg-white/10 disabled:opacity-40"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-4 py-4">
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Pending" value={String(stats.pending)} accent />
          <Stat label="Exposure" value={inr(stats.exposure)} />
          <Stat label="Billed" value={inr(stats.billed)} />
          <Stat label="Absorbed" value={inr(stats.absorbed)} />
        </section>

        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            Project &amp; client
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              label="Project Name"
              required
              value={form.projectName}
              onChange={(v) => setField("projectName", v)}
              placeholder="e.g. Tech Summit 2026"
            />
            <Field
              label="Client Name"
              required
              value={form.clientName}
              onChange={(v) => setField("clientName", v)}
              placeholder="Client / brand"
            />
            <Field
              label="Site Location"
              value={form.siteLocation}
              onChange={(v) => setField("siteLocation", v)}
              placeholder="Venue / hall"
            />
            <Field
              label="Requested By"
              value={form.requestedBy}
              onChange={(v) => setField("requestedBy", v)}
              placeholder="Person on site"
            />
            <Field
              label="Event Date"
              type="date"
              value={form.eventDate}
              onChange={(v) => setField("eventDate", v)}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            Change details
          </h2>
          <div className="space-y-3">
            <Field
              label="Headline"
              required
              value={form.title}
              onChange={(v) => setField("title", v)}
              placeholder="Short summary of the change"
            />
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Description
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setField("description", e.target.value)}
                rows={3}
                placeholder="What changed on site and why…"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <SelectField
                label="Change Type"
                value={form.changeType}
                onChange={(v) => setField("changeType", v)}
                options={CHANGE_TYPES.map((c) => ({ value: c, label: c }))}
              />
              <SelectField
                label="Urgency"
                value={form.urgency}
                onChange={(v) => setField("urgency", v as ChangeUrgency)}
                options={[
                  { value: "low", label: "Low" },
                  { value: "medium", label: "Medium" },
                  { value: "high", label: "High" },
                ]}
              />
              <Field
                label="Cost Impact (₹)"
                type="number"
                value={form.costImpact}
                onChange={(v) => setField("costImpact", v)}
                placeholder="0"
              />
              <Field
                label="Time Impact (hrs)"
                type="number"
                value={form.timeImpactHours}
                onChange={(v) => setField("timeImpactHours", v)}
                placeholder="0"
              />
              <SelectField
                label="Route To"
                value={form.routeTo}
                onChange={(v) => setField("routeTo", v as RouteTo)}
                options={[
                  { value: "project_manager", label: "Project Manager" },
                  { value: "account_manager", label: "Account Manager" },
                ]}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Client Communication
              </label>
              <textarea
                value={form.clientCommunication}
                onChange={(e) =>
                  setField("clientCommunication", e.target.value)
                }
                rows={2}
                placeholder="What will be communicated back to the client…"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <button
              type="button"
              onClick={handleSubmit}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground shadow-sm transition active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" />
              Raise Change Request
            </button>
          </div>
        </section>

        <section className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by project, client, headline or CR-####"
              className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {TABS.map((t) => {
              const count =
                t.value === "all"
                  ? items.length
                  : items.filter((i) => i.status === t.value).length;
              return (
                <button
                  key={t.value}
                  onClick={() => setTab(t.value)}
                  className={cn(
                    "rounded-full border border-border px-3 py-1.5 text-xs font-medium transition",
                    tab === t.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-muted-foreground hover:bg-accent/10",
                  )}
                >
                  {t.label} ({count})
                </button>
              );
            })}
          </div>

          {!hydrated ? null : filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
              <GitPullRequestArrow className="mx-auto h-10 w-10 text-muted-foreground/50" />
              <p className="mt-3 text-sm font-medium text-foreground">
                No change requests here
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Raise one using the form above.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {filtered.map((r) => (
                <li
                  key={r.id}
                  className="rounded-2xl border border-border bg-card p-4 shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                          {r.refCode}
                        </span>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                            STATUS_CLASS[r.status],
                          )}
                        >
                          {STATUS_LABEL[r.status]}
                        </span>
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
                          {r.urgency}
                        </span>
                      </div>
                      <div className="mt-1.5 truncate text-sm font-semibold text-foreground">
                        {r.title}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {r.projectName} · {r.clientName}
                        {r.siteLocation ? ` · ${r.siteLocation}` : ""}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {r.changeType} · {inr(r.costImpact)} ·{" "}
                        {r.timeImpactHours} hrs ·{" "}
                        {r.routeTo === "project_manager"
                          ? "Project Manager"
                          : "Account Manager"}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(r.id)}
                      aria-label={`Delete ${r.refCode}`}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>

                  {r.status === "pending" && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <DecideBtn
                        onClick={() => decide(r.id, "approved_client")}
                        label="Bill to client"
                      />
                      <DecideBtn
                        onClick={() => decide(r.id, "approved_absorbed")}
                        label="Absorb cost"
                      />
                      <DecideBtn
                        onClick={() => decide(r.id, "rejected")}
                        label="Reject"
                        destructive
                      />
                    </div>
                  )}
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
              Total requests {items.length}
            </div>
            <div>Pending exposure {inr(stats.exposure)}</div>
          </div>
          <button
            type="button"
            onClick={handleExport}
            disabled={!items.length || exporting}
            className="flex h-12 items-center gap-2 rounded-xl bg-accent px-5 text-sm font-semibold text-accent-foreground shadow-md transition active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
          >
            {exporting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-5 w-5" />
            )}
            Export to Excel
          </button>
        </div>
      </footer>
    </div>
  );
}

function DecideBtn({
  label,
  onClick,
  destructive,
}: {
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg border px-3 py-1.5 text-xs font-semibold transition active:scale-[0.98]",
        destructive
          ? "border-destructive/30 text-destructive hover:bg-destructive/10"
          : "border-border text-foreground hover:bg-accent/10",
      )}
    >
      {label}
    </button>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card p-3 shadow-sm",
        accent && "border-accent/40",
      )}
    >
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 truncate text-base font-bold text-foreground">
        {value}
      </div>
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

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
