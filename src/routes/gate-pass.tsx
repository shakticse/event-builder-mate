import { createFileRoute } from "@tanstack/react-router";
import { ClipboardList } from "lucide-react";

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

function GatePassPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-primary text-primary-foreground shadow-sm">
        <div className="mx-auto max-w-2xl px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight">Gate Pass</h1>
              <p className="text-xs text-primary-foreground/70 leading-tight">
                Event Rentals
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
          <ClipboardList className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-sm font-medium text-foreground">
            Gate Pass coming soon
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            This section will let you generate and manage gate passes for outgoing and returning equipment.
          </p>
        </div>
      </main>
    </div>
  );
}
