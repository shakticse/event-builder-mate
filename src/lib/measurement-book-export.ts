import ExcelJS from "exceljs";

import type { MbEntry } from "./measurement-book";

export interface MbExportMeta {
  projectName: string;
}

export async function exportMeasurementBookToXlsx(
  entries: MbEntry[],
  meta: MbExportMeta,
) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Measurement Book");

  ws.columns = [
    { width: 22 },
    { width: 30 },
    { width: 18 },
    { width: 22 },
    { width: 30 },
    { width: 10 },
    { width: 10 },
    { width: 10 },
    { width: 10 },
    { width: 8 },
    { width: 12 },
    { width: 12 },
    { width: 14 },
    { width: 12 },
  ];

  ws.addRow(["Measurement Book"]);
  ws.getRow(1).font = { bold: true, size: 14 };
  ws.addRow(["Project", meta.projectName || "N/A"]);
  ws.addRow(["Generated", new Date().toLocaleString()]);
  ws.addRow([]);

  const header = ws.addRow([
    "Vendor",
    "Service",
    "Category",
    "Event",
    "Location",
    "Work Description",
    "UOM",
    "Width",
    "Height",
    "Weight",
    "Nos",
    "Quantity",
    "Unit Rate",
    "Amount",
    "Status",
  ]);
  header.font = { bold: true };
  const firstDataRow = header.number + 1;

  entries.forEach((e, i) => {
    const rowNum = firstDataRow + i;
    ws.addRow([
      e.vendorName,
      e.serviceName,
      e.category ?? "",
      e.eventName ?? "",
      e.location ?? "",
      e.workDescription ?? "",
      e.uom,
      e.width ?? "",
      e.height ?? "",
      e.weight ?? "",
      e.nos,
      e.quantity,
      e.unitRate,
      { formula: `L${rowNum}*M${rowNum}` },
      e.status,
    ]);
  });

  const lastDataRow = firstDataRow + entries.length - 1;
  ws.addRow([]);
  const tRow = ws.addRow([
    "",
    `Total (${entries.length} entries)`,
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    entries.length ? { formula: `SUM(N${firstDataRow}:N${lastDataRow})` } : 0,
    "",
  ]);
  tRow.font = { bold: true };

  const safeName = (meta.projectName || "MeasurementBook")
    .replace(/[^a-z0-9-_]+/gi, "_")
    .slice(0, 40);
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `MeasurementBook_${safeName}_${ts}.xlsx`;

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
