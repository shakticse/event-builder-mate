import ExcelJS from "exceljs";

export interface ReturnRow {
  rowId: string;
  itemId: number;
  name: string;
  goodQty: number;
  damagedQty: number;
  price: number | null;
  categoryName?: string;
  /** Data URLs of damaged-item photos (max 3) */
  images?: string[];
}

export interface ReturnMeta {
  projectName: string;
  siteLocation: string;
  description: string;
  vehicleNo: string;
  vehicleType: string;
  chalanNo: string;
  receivedDate: string;
}

export const MAX_ROW_IMAGES = 3;

function consolidate(rows: ReturnRow[]) {
  const map = new Map<
    string,
    {
      name: string;
      goodQty: number;
      damagedQty: number;
      price: number | null;
      categoryName?: string;
      images: string[];
    }
  >();
  for (const r of rows) {
    const key = r.name.trim().toLowerCase();
    const existing = map.get(key);
    if (existing) {
      existing.goodQty += r.goodQty;
      existing.damagedQty += r.damagedQty;
      if (existing.price === null && r.price !== null) existing.price = r.price;
      existing.images = [...existing.images, ...(r.images ?? [])].slice(
        0,
        MAX_ROW_IMAGES,
      );
    } else {
      map.set(key, {
        name: r.name,
        goodQty: r.goodQty,
        damagedQty: r.damagedQty,
        price: r.price,
        categoryName: r.categoryName,
        images: (r.images ?? []).slice(0, MAX_ROW_IMAGES),
      });
    }
  }
  return Array.from(map.values());
}

function parseDataUrl(dataUrl: string) {
  const match = /^data:image\/(png|jpeg|jpg|gif);base64,(.*)$/i.exec(dataUrl);
  if (!match) return null;
  const ext = match[1].toLowerCase() === "jpg" ? "jpeg" : match[1].toLowerCase();
  return { extension: ext as "png" | "jpeg" | "gif", base64: match[2] };
}

export async function exportReturnsToXlsx(rows: ReturnRow[], meta: ReturnMeta) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Returns");

  ws.columns = [
    { width: 24 },
    { width: 38 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 16 },
    { width: 16 },
    { width: 16 },
  ];

  ws.addRow(["Return Note"]);
  ws.getRow(1).font = { bold: true, size: 14 };
  ws.addRow([]);
  ws.addRow(["Project / BOM No", meta.projectName]);
  ws.addRow(["Returned Site Location", meta.siteLocation]);
  ws.addRow(["Description", meta.description]);
  ws.addRow([]);
  const vh = ws.addRow(["Vehicle Details"]);
  vh.font = { bold: true };
  ws.addRow(["Vehicle No", meta.vehicleNo]);
  ws.addRow(["Vehicle Type", meta.vehicleType]);
  ws.addRow(["Chalan No", meta.chalanNo]);
  ws.addRow(["Received Date", meta.receivedDate]);
  ws.addRow(["Date", new Date().toLocaleString()]);
  ws.addRow([]);

  const header = ws.addRow([
    "Category Name",
    "Item Name",
    "Good Condition",
    "Damaged",
    "Item Price",
    "Image 1",
    "Image 2",
    "Image 3",
  ]);
  header.font = { bold: true };

  const consolidated = consolidate(rows);
  for (const r of consolidated) {
    const row = ws.addRow([
      r.categoryName ?? "",
      r.name,
      r.goodQty,
      r.damagedQty,
      r.price === null ? "N/A" : r.price,
    ]);

    const images = r.images.slice(0, MAX_ROW_IMAGES);
    if (images.length > 0) {
      row.height = 62;
      images.forEach((dataUrl, idx) => {
        const parsed = parseDataUrl(dataUrl);
        if (!parsed) return;
        const imageId = wb.addImage({
          base64: parsed.base64,
          extension: parsed.extension,
        });
        ws.addImage(imageId, {
          tl: { col: 5 + idx + 0.1, row: row.number - 1 + 0.1 },
          ext: { width: 90, height: 72 },
        });
      });
    }
  }

  // Totals
  const totals = consolidated.reduce(
    (acc, r) => {
      acc.good += r.goodQty;
      acc.damaged += r.damagedQty;
      return acc;
    },
    { good: 0, damaged: 0 },
  );
  ws.addRow([]);
  const tRow = ws.addRow(["", "Totals", totals.good, totals.damaged, ""]);
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
