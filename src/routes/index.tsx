import { APP_NAME } from "@/lib/app-config";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Eye,
  Package,
  Plus,
  RefreshCw,
  AlertCircle,
  Pencil,
  Loader2,
  Search,
} from "lucide-react";
import { type BomListItem, type BomDetailItem } from "@/lib/bom-types";
import { cn } from "@/lib/utils";
import { apiFetch, isSessionExpired, SESSION_TIMED_OUT } from "@/lib/api-client";
import { BomCreateView } from "@/components/bom-create-view";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `BOM Builder — ${APP_NAME}` },
      {
        name: "description",
        content:
          "View bills of materials and their items for any event rental job.",
      },
      { property: "og:title", content: `BOM Builder — ${APP_NAME}` },
      {
        property: "og:description",
        content:
          "View bills of materials and their items for any event rental job.",
      },
    ],
  }),
  component: BomBuilderPage,
});

const LIST_API = "/api/bom";

function BomBuilderPage() {
  const [boms, setBoms] = useState<BomListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [view, setView] = useState<"list" | "detail" | "create" | "edit">(
    "list",
  );
  const [selectedBom, setSelectedBom] = useState<BomListItem | null>(null);
  const [editBom, setEditBom] = useState<BomListItem | null>(null);
  const [editLoadingId, setEditLoadingId] = useState<number | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const fetchBoms = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(LIST_API);
      if (!res.ok) {
        throw new Error(`Failed to load BOMs (${res.status})`);
      }
      const data = (await res.json()) as BomListItem[];
      setBoms(Array.isArray(data) ? data : []);
    } catch (e) {
      if (isSessionExpired(e)) {
        setError(SESSION_TIMED_OUT);
        return;
      }
      const msg = e instanceof Error ? e.message : "Failed to load BOMs";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchBoms();
  }, []);

  const openDetail = async (bom: BomListItem) => {
    setSelectedBom(bom);
    setView("detail");
    setDetailLoading(true);
    setDetailError(null);
    try {
      const res = await apiFetch(
        `/api/bom/GetConsolidatedBomItemsById/${bom.id}`,
      );
      if (!res.ok) {
        throw new Error(`Failed to load BOM details (${res.status})`);
      }
      const data = (await res.json()) as { items?: BomDetailItem[] } | BomDetailItem[];
      const items = Array.isArray(data) ? data : data.items ?? [];
      setSelectedBom({ ...bom, items });
    } catch (e) {
      if (isSessionExpired(e)) {
        setDetailError(SESSION_TIMED_OUT);
        return;
      }
      const msg =
        e instanceof Error ? e.message : "Failed to load BOM details";
      setDetailError(msg);
      toast.error(msg);
    } finally {
      setDetailLoading(false);
    }
  };

  const openEdit = async (bom: BomListItem) => {
    setEditLoadingId(bom.id);
    try {
      const res = await apiFetch(`/api/bom/${bom.id}`);
      if (!res.ok) {
        throw new Error(`Failed to load BOM (${res.status})`);
      }
      const data = (await res.json()) as BomListItem;
      setEditBom(data);
      setView("edit");
    } catch (e) {
      if (isSessionExpired(e)) return;
      toast.error(e instanceof Error ? e.message : "Failed to load BOM");
    } finally {
      setEditLoadingId(null);
    }
  };

  const backToList = () => {
    setView("list");
    setSelectedBom(null);
    setEditBom(null);
    setDetailError(null);
  };

  if (view === "create" || view === "edit") {
    return (
      <BomCreateView
        key={view === "edit" ? `edit-${editBom?.id}` : "create"}
        editBom={view === "edit" ? editBom : null}
        onBack={backToList}
        onCreated={() => void fetchBoms()}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-primary text-primary-foreground shadow-sm">
        <div className="mx-auto max-w-3xl px-4 py-3">
          <div className="flex items-center gap-3">
            {view === "detail" ? (
              <button
                type="button"
                onClick={backToList}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground"
                aria-label="Back to BOM list"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <Package className="h-5 w-5" />
              </div>
            )}
            <div className="flex-1">
              <h1 className="text-base font-bold leading-tight">
                {view === "detail" && selectedBom
                  ? selectedBom.projectName || `BOM #${selectedBom.id}`
                  : "BOM Builder"}
              </h1>
              <p className="text-xs text-primary-foreground/70 leading-tight">
                {APP_NAME}
              </p>
            </div>
            {view === "list" && (
              <button
                type="button"
                onClick={() => setView("create")}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-semibold text-accent-foreground shadow-sm"
              >
                <Plus className="h-4 w-4" />
                Create BOM
              </button>
            )}
            {view === "list" && (
              <button
                onClick={() => void fetchBoms()}
                className="rounded-md p-2 text-primary-foreground/80 hover:bg-white/10 active:bg-white/20"
                aria-label="Refresh BOMs"
              >
                <RefreshCw
                  className={cn("h-4 w-4", loading && "animate-spin")}
                />
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-4">
        {view === "list" ? (
          <BomListView
            boms={boms}
            loading={loading}
            error={error}
            onRetry={fetchBoms}
            onView={openDetail}
            onEdit={openEdit}
            editLoadingId={editLoadingId}
          />
        ) : (
          <BomDetailView
            bom={selectedBom}
            loading={detailLoading}
            error={detailError}
            onRetry={() => selectedBom && void openDetail(selectedBom)}
          />
        )}
      </main>
    </div>
  );
}

function BomListView({
  boms,
  loading,
  error,
  onRetry,
  onView,
  onEdit,
  editLoadingId,
}: {
  boms: BomListItem[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onView: (bom: BomListItem) => void;
  onEdit: (bom: BomListItem) => void;
  editLoadingId: number | null;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">
          Bills of Materials
        </h2>
        <span className="text-xs text-muted-foreground">
          {boms.length} {boms.length === 1 ? "BOM" : "BOMs"}
        </span>
      </div>

      {loading && boms.length === 0 && (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      )}

      {error && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <div className="flex-1">{error}</div>
          <button onClick={() => void onRetry()} className="font-semibold underline">
            Retry
          </button>
        </div>
      )}

      {!loading && !error && boms.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <Package className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-sm font-medium text-foreground">No BOMs found</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Add a BOM from the ProjectHub system to see it here.
          </p>
        </div>
      )}

      {boms.length > 0 && (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-xl border border-border sm:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/60 text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Id</th>
                  <th className="px-4 py-2.5 font-medium">Project Name</th>
                  <th className="px-4 py-2.5 font-medium">Created By</th>
                  <th className="px-4 py-2.5 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {boms.map((bom) => (
                  <tr
                    key={bom.id}
                    className="bg-card hover:bg-accent/5 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-foreground">
                      {bom.id}
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {bom.projectName || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {bom.createdByUser?.trim() || "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => onView(bom)}
                          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-xs font-semibold text-foreground shadow-sm hover:bg-accent/10 active:bg-accent/20"
                          aria-label={`View BOM ${bom.id}`}
                        >
                          <Eye className="h-3.5 w-3.5 text-primary" />
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => onEdit(bom)}
                          disabled={editLoadingId === bom.id}
                          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-xs font-semibold text-foreground shadow-sm hover:bg-accent/10 active:bg-accent/20 disabled:opacity-60"
                          aria-label={`Edit BOM ${bom.id}`}
                        >
                          {editLoadingId === bom.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                          ) : (
                            <Pencil className="h-3.5 w-3.5 text-primary" />
                          )}
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-2 sm:hidden">
            {boms.map((bom) => (
              <div
                key={bom.id}
                className="rounded-xl border border-border bg-background p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">
                      {bom.projectName || "—"}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Id: {bom.id} · Created by: {bom.createdByUser?.trim() || "—"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onView(bom)}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-input bg-background text-foreground shadow-sm hover:bg-accent/10 active:bg-accent/20"
                      aria-label={`View BOM ${bom.id}`}
                    >
                      <Eye className="h-4 w-4 text-primary" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onEdit(bom)}
                      disabled={editLoadingId === bom.id}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-input bg-background text-foreground shadow-sm hover:bg-accent/10 active:bg-accent/20 disabled:opacity-60"
                      aria-label={`Edit BOM ${bom.id}`}
                    >
                      {editLoadingId === bom.id ? (
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      ) : (
                        <Pencil className="h-4 w-4 text-primary" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function BomDetailView({
  bom,
  loading,
  error,
  onRetry,
}: {
  bom: BomListItem | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  const [query, setQuery] = useState("");
  const allItems = bom?.items ?? [];
  const items = query.trim()
    ? allItems.filter((item) =>
        item.itemName.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : allItems;

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-sm font-semibold text-foreground">BOM Items</h2>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-56">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search items..."
              className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm text-foreground outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Search BOM items"
            />
          </div>
          {bom && (
            <span className="shrink-0 text-xs text-muted-foreground">
              {items.length} / {allItems.length}
            </span>
          )}
        </div>
      </div>

      {loading && (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      )}

      {error && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <div className="flex-1">{error}</div>
          <button onClick={() => void onRetry()} className="font-semibold underline">
            Retry
          </button>
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <Package className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-sm font-medium text-foreground">
            {query.trim() ? "No matching items" : "No items in this BOM"}
          </p>
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-xl border border-border sm:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/60 text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Item Name</th>
                  <th className="px-4 py-2.5 text-right font-medium">Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((item) => (
                  <BomDetailRow key={item.id} item={item} />
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-2 sm:hidden">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-xl border border-border bg-background p-3"
              >
                <span className="min-w-0 flex-1 pr-3 text-sm font-medium text-foreground">
                  {item.itemName}
                </span>
                <span className="shrink-0 rounded-md bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent-foreground">
                  Qty: {item.totalQuantity ?? item.qty}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function BomDetailRow({ item }: { item: BomDetailItem }) {
  return (
    <tr className="bg-card hover:bg-accent/5 transition-colors">
      <td className="px-4 py-3 text-foreground">{item.itemName}</td>
      <td className="px-4 py-3 text-right font-semibold text-foreground">
        {item.totalQuantity ?? item.qty}
      </td>
    </tr>
  );
}
