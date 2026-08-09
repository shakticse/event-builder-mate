import ExcelJS from "exceljs";

export interface MrnRow {
  rowId: string;
  itemId: number;
  name: string;
  receivedQty: number;
  price: number | null;
  categoryName?: string;
}

export interface MrnMeta {
  poNumber: string;
  mrnNumber: string;
  vendorName: string;
  vendorContact: string;
  vendorGstin: string;
  vendorAddress: string;
  invoiceNo: string;
  receivedDate: string;
  remarks: string;
}

function consolidate(rows: MrnRow[]) {
  const map = new Map<
    string,
    {
      name: string;
      receivedQty: number;
      price: number | null;
      categoryName?: string;
    }
  >();
  for (const r of rows) {
    const key = r.name.trim().toLowerCase();
    const existing = map.get(key);
    if (existing) {
      existing.receivedQty += r.receivedQty;
      if (existing.price === null && r.price !== null) existing.price = r.price;
    } else {
      map.set(key, {
        name: r.name,
        receivedQty: r.receivedQty,
        price: r.price,
        categoryName: r.categoryName,
      });
    }
  }
  return Array.from(map.values());
}

export async function exportMrnToXlsx(rows: MrnRow[], meta: MrnMeta) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Material Receipt Note");

  ws.columns = [
    { width: 24 },
    { width: 38 },
    { width: 16 },
    { width: 14 },
    { width: 16 },
  ];

  ws.addRow(["Material Receipt Note"]);
  ws.getRow(1).font = { bold: true, size: 14 };
  ws.addRow([]);
  ws.addRow(["PO No", meta.poNumber]);
  ws.addRow(["MRN No", meta.mrnNumber]);
  ws.addRow(["Invoice No", meta.invoiceNo]);
  ws.addRow(["Received Date", meta.receivedDate]);
  ws.addRow([]);
  const vh = ws.addRow(["Vendor Details"]);
  vh.font = { bold: true };
  ws.addRow(["Vendor Name", meta.vendorName]);
  ws.addRow(["Contact", meta.vendorContact]);
  ws.addRow(["GSTIN", meta.vendorGstin]);
  ws.addRow(["Address", meta.vendorAddress]);
  ws.addRow(["Remarks", meta.remarks]);
  ws.addRow(["Generated", new Date().toLocaleString()]);
  ws.addRow([]);

  const header = ws.addRow([
    "Category Name",
    "Item Name",
    "Received Qty",
    "Item Price",
    "Line Value",
  ]);
  header.font = { bold: true };
  const firstDataRow = header.number + 1;

  const consolidated = consolidate(rows);
  consolidated.forEach((r, i) => {
    const rowNum = firstDataRow + i;
    ws.addRow([
      r.categoryName ?? "",
      r.name,
      r.receivedQty,
      r.price === null ? "N/A" : r.price,
      r.price === null ? "N/A" : { formula: `C${rowNum}*D${rowNum}` },
    ]);
  });

  const lastDataRow = firstDataRow + consolidated.length - 1;
  ws.addRow([]);
  const tRow = ws.addRow([
    "",
    `Total (${consolidated.length} items)`,
    consolidated.length
      ? { formula: `SUM(C${firstDataRow}:C${lastDataRow})` }
      : 0,
    "",
    "",
  ]);
  tRow.font = { bold: true };

  const safeName = (meta.poNumber || meta.mrnNumber || "MRN")
    .replace(/[^a-z0-9-_]+/gi, "_")
    .slice(0, 40);
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `MRN_${safeName}_${ts}.xlsx`;

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
