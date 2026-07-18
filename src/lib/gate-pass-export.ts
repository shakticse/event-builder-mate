import ExcelJS from "exceljs";

export interface GatePassRow {
  rowId: string;
  itemId: number;
  name: string;
  quantity: number;
  price: number | null;
  categoryName?: string;
}

export interface GatePassAddress {
  address: string;
  city: string;
  state: string;
  zip: string;
}

export interface GatePassMeta {
  passType: "Outward" | "Return";
  projectName: string;
  projectLocation: string;
  ewayBillNo: string;
  dcNo: string;
  dcDate: string;
  remarks: string;
  totalGoodsValue: string;
  fromAddress: GatePassAddress;
  toAddress: GatePassAddress;
  vehicleType: string;
  vehicleNumber: string;
  driverName: string;
  phoneNumber: string;
}

export interface GatePassPhoto {
  id: string;
  dataUrl: string;
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
    { width: 30 },
    { width: 24 },
    { width: 30 },
  ];

  const centerBold = {
    alignment: { horizontal: "center" as const, vertical: "middle" as const },
    font: { bold: true },
  };

  // Row 1: Company heading
  ws.mergeCells("A1:D1");
  const c1 = ws.getCell("A1");
  c1.value = "PAVILIIONS  AND INTERIORS INDIA PVT. LTD";
  c1.alignment = { horizontal: "center", vertical: "middle" };
  c1.font = { bold: true, size: 16 };
  ws.getRow(1).height = 26;

  // Row 2: CHALLAN
  ws.mergeCells("A2:D2");
  const c2 = ws.getCell("A2");
  c2.value = "CHALLAN";
  c2.alignment = { horizontal: "center", vertical: "middle" };
  c2.font = { bold: true, size: 13 };
  ws.getRow(2).height = 20;

  // Row 3: spacer
  let row = 4;

  // From Address / To Address side by side
  ws.mergeCells(`A${row}:B${row}`);
  ws.mergeCells(`C${row}:D${row}`);
  const fromHead = ws.getCell(`A${row}`);
  fromHead.value = "From Address";
  Object.assign(fromHead, centerBold);
  fromHead.alignment = { horizontal: "center", vertical: "middle" };
  fromHead.font = { bold: true };
  const toHead = ws.getCell(`C${row}`);
  toHead.value = "To Address";
  toHead.alignment = { horizontal: "center", vertical: "middle" };
  toHead.font = { bold: true };
  row++;

  const addrPairs: Array<[string, string, string]> = [
    ["Address", meta.fromAddress.address, meta.toAddress.address],
    ["City", meta.fromAddress.city, meta.toAddress.city],
    ["State", meta.fromAddress.state, meta.toAddress.state],
    ["Zip Code", meta.fromAddress.zip, meta.toAddress.zip],
  ];
  for (const [label, fromV, toV] of addrPairs) {
    const r = ws.getRow(row);
    r.getCell(1).value = label;
    r.getCell(1).font = { bold: true };
    r.getCell(2).value = fromV;
    r.getCell(3).value = label;
    r.getCell(3).font = { bold: true };
    r.getCell(4).value = toV;
    row++;
  }

  row++; // spacer

  // Project details
  ws.mergeCells(`A${row}:D${row}`);
  const pdHead = ws.getCell(`A${row}`);
  pdHead.value = "Project Details";
  pdHead.alignment = { horizontal: "center", vertical: "middle" };
  pdHead.font = { bold: true };
  row++;

  const details: Array<[string, string]> = [
    ["Pass Type", meta.passType],
    ["Project Name", meta.projectName],
    ["Project Location", meta.projectLocation],
    ["EWay Bill No", meta.ewayBillNo],
    ["DC No.", meta.dcNo],
    ["DC Date", meta.dcDate],
    ["Total Goods Value", meta.totalGoodsValue],
    ["Remarks", meta.remarks],
    ["Vehicle Type", meta.vehicleType],
    ["Vehicle Number", meta.vehicleNumber],
    ["Driver/Transporter Name", meta.driverName],
    ["Phone Number", meta.phoneNumber],
    ["Date", new Date().toLocaleString()],
  ];
  for (const [k, v] of details) {
    const r = ws.getRow(row);
    r.getCell(1).value = k;
    r.getCell(1).font = { bold: true };
    ws.mergeCells(`B${row}:D${row}`);
    r.getCell(2).value = v;
    row++;
  }

  row++; // spacer

  // Items header
  const headerRow = ws.getRow(row);
  headerRow.getCell(1).value = "Category Name";
  headerRow.getCell(2).value = "Item Name";
  headerRow.getCell(3).value = "Quantity";
  headerRow.getCell(4).value = "Item Price";
  headerRow.font = { bold: true };
  headerRow.alignment = { horizontal: "center", vertical: "middle" };
  row++;

  const consolidated = consolidate(rows);
  for (const r of consolidated) {
    const rr = ws.getRow(row);
    rr.getCell(1).value = r.categoryName ?? "";
    rr.getCell(2).value = r.name;
    rr.getCell(3).value = r.quantity;
    rr.getCell(4).value = r.price === null ? "N/A" : r.price;
    row++;
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

      const imgTopRow = currentRow - 1;
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
