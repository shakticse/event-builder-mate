import ExcelJS from "exceljs";

export interface ReturnRow {
  rowId: string;
  itemId: number;
  name: string;
  goodQty: number;
  repairQty: number;
  rejectedQty: number;
  price: number | null;
  categoryName?: string;
}

export interface ReturnMeta {
  projectName: string;
  siteLocation: string;
  description: string;
}

function consolidate(rows: ReturnRow[]) {
  const map = new Map<
    string,
    {
      name: string;
      goodQty: number;
      repairQty: number;
      rejectedQty: number;
      price: number | null;
      categoryName?: string;
    }
  >();
  for (const r of rows) {
    const key = r.name.trim().toLowerCase();
    const existing = map.get(key);
    if (existing) {
      existing.goodQty += r.goodQty;
      existing.repairQty += r.repairQty;
      existing.rejectedQty += r.rejectedQty;
      if (existing.price === null && r.price !== null) existing.price = r.price;
    } else {
      map.set(key, {
        name: r.name,
        goodQty: r.goodQty,
        repairQty: r.repairQty,
        rejectedQty: r.rejectedQty,
        price: r.price,
        categoryName: r.categoryName,
      });
    }
  }
  return Array.from(map.values());
}

export async function exportReturnsToXlsx(rows: ReturnRow[], meta: ReturnMeta) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Returns");

  ws.columns = [
    { width: 24 },
    { width: 38 },
    { width: 14 },
    { width: 14 },
    { width: 12 },
    { width: 14 },
  ];

  ws.addRow(["Return Note"]);
  ws.getRow(1).font = { bold: true, size: 14 };
  ws.addRow([]);
  ws.addRow(["Project / BOM No", meta.projectName]);
  ws.addRow(["Returned Site Location", meta.siteLocation]);
  ws.addRow(["Description", meta.description]);
  ws.addRow(["Date", new Date().toLocaleString()]);
  ws.addRow([]);

  const header = ws.addRow([
    "Category Name",
    "Item Name",
    "Good Condition",
    "Needs Repair",
    "Rejected",
    "Item Price",
  ]);
  header.font = { bold: true };

  const consolidated = consolidate(rows);
  for (const r of consolidated) {
    ws.addRow([
      r.categoryName ?? "",
      r.name,
      r.goodQty,
      r.repairQty,
      r.rejectedQty,
      r.price === null ? "N/A" : r.price,
    ]);
  }

  // Totals
  const totals = consolidated.reduce(
    (acc, r) => {
      acc.good += r.goodQty;
      acc.repair += r.repairQty;
      acc.rejected += r.rejectedQty;
      return acc;
    },
    { good: 0, repair: 0, rejected: 0 },
  );
  ws.addRow([]);
  const tRow = ws.addRow(["", "Totals", totals.good, totals.repair, totals.rejected, ""]);
  tRow.font = { bold: true };

  const safeName = (meta.projectName || "Returns")
    .replace(/[^a-z0-9-_]+/gi, "_")
    .slice(0, 40);
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `Returns_${safeName}_${ts}.xlsx`;

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  return filename;
}
