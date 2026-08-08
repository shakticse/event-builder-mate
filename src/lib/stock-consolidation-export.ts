import ExcelJS from "exceljs";

export interface StockConsolidationRow {
  rowId: string;
  itemId: number;
  name: string;
  quantity: number;
  damagedQty: number;
  price: number | null;
  categoryName?: string;
}

export interface StockConsolidationMeta {
  storeName: string;
  portfolioNo: string;
}

function consolidate(rows: StockConsolidationRow[]) {
  const map = new Map<
    string,
    {
      name: string;
      quantity: number;
      damagedQty: number;
      price: number | null;
      categoryName?: string;
    }
  >();
  for (const r of rows) {
    const key = r.name.trim().toLowerCase();
    const existing = map.get(key);
    if (existing) {
      existing.quantity += r.quantity;
      existing.damagedQty += r.damagedQty ?? 0;
      if (existing.price === null && r.price !== null) existing.price = r.price;
    } else {
      map.set(key, {
        name: r.name,
        quantity: r.quantity,
        damagedQty: r.damagedQty ?? 0,
        price: r.price,
        categoryName: r.categoryName,
      });
    }
  }
  return Array.from(map.values());
}

export async function exportStockConsolidationToXlsx(
  rows: StockConsolidationRow[],
  meta?: StockConsolidationMeta,
) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Stock Consolidation");

  ws.columns = [
    { width: 24 },
    { width: 38 },
    { width: 12 },
    { width: 14 },
    { width: 14 },
  ];

  ws.addRow(["Stock Consolidation"]);
  ws.getRow(1).font = { bold: true, size: 14 };
  ws.addRow(["Date", new Date().toLocaleString()]);
  ws.addRow(["Store Name", meta?.storeName || "N/A"]);
  ws.addRow(["Portfolio No", meta?.portfolioNo || "N/A"]);
  ws.addRow([]);

  const header = ws.addRow([
    "Category Name",
    "Item Name",
    "Quantity",
    "Damaged Qty",
    "Item Price",
  ]);
  header.font = { bold: true };

  const consolidated = consolidate(rows);
  for (const r of consolidated) {
    ws.addRow([
      r.categoryName ?? "",
      r.name,
      r.quantity,
      r.damagedQty,
      r.price === null ? "N/A" : r.price,
    ]);
  }

  const totalQty = consolidated.reduce((a, r) => a + r.quantity, 0);
  const totalDamaged = consolidated.reduce((a, r) => a + r.damagedQty, 0);
  ws.addRow([]);
  const tRow = ws.addRow(["", "Total", totalQty, totalDamaged, ""]);
  tRow.font = { bold: true };

  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `StockConsolidation_${ts}.xlsx`;

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
