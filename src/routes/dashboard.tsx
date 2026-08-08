import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ClipboardList,
  Layers,
  LogOut,
  Package,
  Ruler,
  Undo2,

} from "lucide-react";

import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Event Rentals" },
      {
        name: "description",
        content:
          "Your Event Rentals workspace: BOM builder, gate pass, returns and stock consolidation.",
      },
    ],
  }),
  component: DashboardPage,
});

const tiles = [
  {
    title: "BOM Builder",
    description: "Build bills of materials and export them to Excel.",
    url: "/",
    icon: Package,
  },
  {
    title: "Gate Pass",
    description: "Create outward/return challans with vehicle and driver details.",
    url: "/gate-pass",
    icon: ClipboardList,
  },
  {
    title: "Return Items",
    description: "Log returns as Good, Needs Repair or Rejected.",
    url: "/returns",
    icon: Undo2,
  },
  {
    title: "Stock Consolidation",
    description: "Consolidate stock quantities and export the list.",
    url: "/stock-consolidation",
    icon: Layers,
  },
  {
    title: "Measurement Book",
    description: "Capture vendor work done on site with measurements and rates.",
    url: "/measurement-book",
    icon: Ruler,
  },
] as const;


function DashboardPage() {
  const { user, logout } = useAuth();

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">
          Welcome{user?.name ? `, ${user.name}` : ""}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {[user?.role, user?.department].filter(Boolean).join(" · ") ||
            user?.email}
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {tiles.map((tile) => (
          <Link
            key={tile.url}
            to={tile.url}
            className="group flex items-start gap-3 rounded-xl border bg-card p-4 shadow-sm transition-colors hover:bg-accent"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <tile.icon className="h-5 w-5 text-primary" />
            </span>
            <span>
              <span className="block font-medium text-foreground">
                {tile.title}
              </span>
              <span className="mt-0.5 block text-sm text-muted-foreground">
                {tile.description}
              </span>
            </span>
          </Link>
        ))}
      </div>

      <button
        onClick={logout}
        className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-input bg-background text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent"
      >
        <LogOut className="h-4 w-4" />
        Log out
      </button>
    </main>
  );
}
