import * as XLSX from "xlsx";
import type { BomRow } from "./bom-types";

/**
 * Consolidate rows: same `name` (case-insensitive) -> sum quantities.
 * Per spec: "If name is same then its a duplicate, regardless of ID."
 */
export function consolidateForExport(rows: BomRow[]) {
  const map = new Map<
    string,
    { name: string; quantity: number; price: number | null }
  >();
  for (const r of rows) {
    const key = r.name.trim().toLowerCase();
    const existing = map.get(key);
    if (existing) {
      existing.quantity += r.quantity;
      // Keep first non-null price encountered
      if (existing.price === null && r.price !== null) existing.price = r.price;
    } else {
      map.set(key, { name: r.name, quantity: r.quantity, price: r.price });
    }
  }
  return Array.from(map.values());
}

export function exportBomToXlsx(rows: BomRow[], eventName: string) {
  const consolidated = consolidateForExport(rows);
  const aoa: (string | number)[][] = [["Item Name", "Quantity", "Item Price"]];
  for (const r of consolidated) {
    aoa.push([r.name, r.quantity, r.price === null ? "N/A" : r.price]);
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [{ wch: 38 }, { wch: 12 }, { wch: 14 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "BOM");

  const safeName = (eventName || "Event")
    .replace(/[^a-z0-9-_]+/gi, "_")
    .slice(0, 40);
  const ts = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .slice(0, 19);
  const filename = `BOM_${safeName}_${ts}.xlsx`;
  XLSX.writeFile(wb, filename);
  return filename;
}
