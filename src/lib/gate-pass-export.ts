import ExcelJS from "exceljs";

export interface GatePassRow {
  rowId: string;
  itemId: number;
  name: string;
  quantity: number;
  price: number | null;
  categoryName?: string;
}

export interface GatePassMeta {
  passType: "Inward" | "Return";
  projectName: string;
  projectLocation: string;
  vehicleType: string;
  vehicleNumber: string;
  driverName: string;
  phoneNumber: string;
}

export interface GatePassPhoto {
  id: string;
  dataUrl: string; // "data:image/png;base64,...."
  name: string;
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

function extFromDataUrl(dataUrl: string): "png" | "jpeg" | "gif" {
  const m = /^data:image\/(png|jpeg|jpg|gif)/i.exec(dataUrl);
  if (!m) return "png";
  const e = m[1].toLowerCase();
  return e === "jpg" ? "jpeg" : (e as "png" | "jpeg" | "gif");
}

function dataUrlToBase64(dataUrl: string): string {
  const idx = dataUrl.indexOf(",");
  return idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl;
}

export async function exportGatePassToXlsx(
  rows: GatePassRow[],
  meta: GatePassMeta,
  photos: GatePassPhoto[] = [],
) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Gate Pass");

  ws.columns = [
    { width: 24 },
    { width: 38 },
    { width: 12 },
    { width: 14 },
  ];

  ws.addRow(["Gate Pass"]);
  ws.getRow(1).font = { bold: true, size: 14 };
  ws.addRow([]);
  ws.addRow(["Pass Type", meta.passType === "Inward" ? "Inward" : "Return"]);
  ws.addRow(["Project Name", meta.projectName]);
  ws.addRow(["Project Location", meta.projectLocation]);
  ws.addRow(["Vehicle Type", meta.vehicleType]);
  ws.addRow(["Vehicle Number", meta.vehicleNumber]);
  ws.addRow(["Driver Name", meta.driverName]);
  ws.addRow(["Phone Number", meta.phoneNumber]);
  ws.addRow(["Date", new Date().toLocaleString()]);
  ws.addRow([]);
  const header = ws.addRow(["Category Name", "Item Name", "Quantity", "Item Price"]);
  header.font = { bold: true };

  const consolidated = consolidate(rows);
  for (const r of consolidated) {
    ws.addRow([
      r.categoryName ?? "",
      r.name,
      r.quantity,
      r.price === null ? "N/A" : r.price,
    ]);
  }

  if (photos.length > 0) {
    const ps = wb.addWorksheet("Photos");
    ps.columns = [{ width: 60 }];
    ps.addRow(["Attached Photos"]).font = { bold: true, size: 14 };
    ps.addRow([]);

    let currentRow = 3;
    for (let i = 0; i < photos.length; i++) {
      const p = photos[i];
      ps.getCell(`A${currentRow}`).value = `${i + 1}. ${p.name}`;
      ps.getRow(currentRow).font = { bold: true };
      currentRow += 1;

      const imgId = wb.addImage({
        base64: dataUrlToBase64(p.dataUrl),
        extension: extFromDataUrl(p.dataUrl),
      });

      // Reserve ~20 rows for the image (each ~20px tall = 400px)
      const imgTopRow = currentRow - 1; // 0-indexed row for anchor
      const imgRows = 20;
      for (let r = currentRow; r < currentRow + imgRows; r++) {
        ps.getRow(r).height = 20;
      }
      ps.addImage(imgId, {
        tl: { col: 0, row: imgTopRow },
        ext: { width: 480, height: 360 },
        editAs: "oneCell",
      });
      currentRow += imgRows + 1;
    }
  }

  const safeName = (meta.projectName || "GatePass")
    .replace(/[^a-z0-9-_]+/gi, "_")
    .slice(0, 40);
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `GatePass_${safeName}_${ts}.xlsx`;

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
