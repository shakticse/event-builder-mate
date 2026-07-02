import * as XLSX from "xlsx";

export interface GatePassRow {
  rowId: string;
  itemId: number;
  name: string;
  quantity: number;
  price: number | null;
  categoryName?: string;
}

export interface GatePassMeta {
  projectName: string;
  projectLocation: string;
  vehicleType: string;
  vehicleNumber: string;
  driverName: string;
  phoneNumber: string;
}

function consolidate(rows: GatePassRow[]) {
  const map = new Map<
    string,
    { name: string; quantity: number; price: number | null; categoryName?: string }
  >();
  for (const r of rows) {
    const key = r.name.trim().toLowerCase();
    const existing = map.get(key);
    if (existing) {
      existing.quantity += r.quantity;
      if (existing.price === null && r.price !== null) existing.price = r.price;
    } else {
      map.set(key, {
        name: r.name,
        quantity: r.quantity,
        price: r.price,
        categoryName: r.categoryName,
      });
    }
  }
  return Array.from(map.values());
}

export function exportGatePassToXlsx(rows: GatePassRow[], meta: GatePassMeta) {
  const consolidated = consolidate(rows);
  const aoa: (string | number)[][] = [
    ["Gate Pass"],
    [],
    ["Project Name", meta.projectName],
    ["Project Location", meta.projectLocation],
    ["Vehicle Type", meta.vehicleType],
    ["Vehicle Number", meta.vehicleNumber],
    ["Driver Name", meta.driverName],
    ["Phone Number", meta.phoneNumber],
    ["Date", new Date().toLocaleString()],
    [],
    ["Category Name", "Item Name", "Quantity", "Item Price"],
  ];
  for (const r of consolidated) {
    aoa.push([
      r.categoryName ?? "",
      r.name,
      r.quantity,
      r.price === null ? "N/A" : r.price,
    ]);
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [{ wch: 24 }, { wch: 38 }, { wch: 12 }, { wch: 14 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Gate Pass");

  const safeName = (meta.projectName || "GatePass")
    .replace(/[^a-z0-9-_]+/gi, "_")
    .slice(0, 40);
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `GatePass_${safeName}_${ts}.xlsx`;
  XLSX.writeFile(wb, filename);
  return filename;
}
