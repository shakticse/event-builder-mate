import ExcelJS from "exceljs";

import { STATUS_LABEL, type ChangeRequest } from "./change-request";

export async function exportChangeRequestsToXlsx(items: ChangeRequest[]) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Change Requests");

  ws.columns = [
    { width: 12 },
    { width: 18 },
    { width: 24 },
    { width: 22 },
    { width: 20 },
    { width: 34 },
    { width: 40 },
    { width: 18 },
    { width: 10 },
    { width: 16 },
    { width: 14 },
    { width: 18 },
    { width: 16 },
    { width: 30 },
  ];

  ws.addRow(["Site Change Control"]);
  ws.getRow(1).font = { bold: true, size: 14 };
  ws.addRow(["Generated", new Date().toLocaleString()]);
  ws.addRow([]);

  const header = ws.addRow([
    "Ref",
    "Raised On",
    "Project",
    "Client",
    "Site Location",
    "Headline",
    "Description",
    "Change Type",
    "Urgency",
    "Cost Impact",
    "Time (hrs)",
    "Routed To",
    "Status",
    "Client Communication",
  ]);
  header.font = { bold: true };
  const firstDataRow = header.number + 1;

  items.forEach((r) => {
    ws.addRow([
      r.refCode,
      new Date(r.createdAt).toLocaleDateString(),
      r.projectName,
      r.clientName,
      r.siteLocation,
      r.title,
      r.description,
      r.changeType,
      r.urgency,
      r.costImpact,
      r.timeImpactHours,
      r.routeTo === "project_manager" ? "Project Manager" : "Account Manager",
      STATUS_LABEL[r.status],
      r.clientCommunication,
    ]);
  });

  const lastDataRow = firstDataRow + items.length - 1;
  ws.addRow([]);
  const tRow = ws.addRow([
    "",
    "",
    "",
    "",
    "",
    `Total (${items.length} requests)`,
    "",
    "",
    "",
    items.length ? { formula: `SUM(J${firstDataRow}:J${lastDataRow})` } : 0,
    items.length ? { formula: `SUM(K${firstDataRow}:K${lastDataRow})` } : 0,
    "",
    "",
    "",
  ]);
  tRow.font = { bold: true };

  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `ChangeRequests_${ts}.xlsx`;

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
