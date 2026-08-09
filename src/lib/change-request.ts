import { useCallback, useEffect, useState } from "react";

export type ChangeStatus =
  | "pending"
  | "approved_client"
  | "approved_absorbed"
  | "rejected";

export type ChangeUrgency = "low" | "medium" | "high";

export type RouteTo = "project_manager" | "account_manager";

export interface ChangeRequest {
  id: string;
  refCode: string;
  createdAt: string;
  projectName: string;
  clientName: string;
  siteLocation: string;
  requestedBy: string;
  eventDate: string;
  title: string;
  description: string;
  changeType: string;
  urgency: ChangeUrgency;
  costImpact: number;
  timeImpactHours: number;
  routeTo: RouteTo;
  status: ChangeStatus;
  clientCommunication: string;
}

export const STATUS_LABEL: Record<ChangeStatus, string> = {
  pending: "Pending",
  approved_client: "Billed to client",
  approved_absorbed: "Absorbed",
  rejected: "Rejected",
};

export const CHANGE_TYPES = [
  "Additional items",
  "Item swap",
  "Layout change",
  "Scope reduction",
  "Timeline change",
  "Other",
] as const;

const KEY = "eventrentals.changeRequests";

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function nextRefCode(existing: ChangeRequest[]) {
  const max = existing.reduce((m, r) => {
    const n = Number(r.refCode.replace(/\D/g, ""));
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  return `CR-${String(max + 1).padStart(4, "0")}`;
}

function read(): ChangeRequest[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ChangeRequest[]) : [];
  } catch {
    return [];
  }
}

export function useChangeStore() {
  const [items, setItems] = useState<ChangeRequest[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setItems(read());
    setHydrated(true);
  }, []);

  const persist = useCallback((next: ChangeRequest[]) => {
    setItems(next);
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const create = useCallback(
    (data: Omit<ChangeRequest, "id" | "refCode" | "createdAt" | "status">) => {
      const current = read();
      const rec: ChangeRequest = {
        ...data,
        id: uid(),
        refCode: nextRefCode(current),
        createdAt: new Date().toISOString(),
        status: "pending",
      };
      persist([rec, ...current]);
      return rec;
    },
    [persist],
  );

  const decide = useCallback(
    (id: string, status: ChangeStatus) => {
      persist(read().map((r) => (r.id === id ? { ...r, status } : r)));
    },
    [persist],
  );

  const remove = useCallback(
    (id: string) => {
      persist(read().filter((r) => r.id !== id));
    },
    [persist],
  );

  const reset = useCallback(() => persist([]), [persist]);

  return { items, hydrated, create, decide, remove, reset };
}

export function inr(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}
