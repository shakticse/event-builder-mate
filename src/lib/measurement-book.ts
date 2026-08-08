export interface ProjectServiceApi {
  id: number;
  name: string;
  category: string;
  uom: string;
}

export interface ProjectApi {
  id: number;
  projectName: string;
  address?: string | null;
}

export type MbStatus = "Pending" | "Approved" | "Disputed";

export interface MbEntry {
  rowId: string;
  serviceId: number;
  serviceName: string;
  category: string;
  uom: string;
  vendorName: string;
  eventName: string;
  location: string;
  workDescription: string;
  width: number | null;
  height: number | null;
  weight: number | null;
  nos: number;
  unitRate: number;
  quantity: number;
  amount: number;
  status: MbStatus;
}

export type MeasureField = "width" | "height" | "weight" | "nos";

/** Which measurement inputs apply to a given unit of measurement. */
export function fieldsForUom(uom: string): MeasureField[] {
  const u = (uom || "").toUpperCase();
  if (u === "SQFT" || u === "SQM") return ["width", "height", "nos"];
  if (u === "METER") return ["width", "nos"];
  if (u === "KG") return ["weight", "nos"];
  return ["nos"];
}

export function labelForField(field: MeasureField, uom: string): string {
  const u = (uom || "").toUpperCase();
  if (field === "width")
    return u === "METER" ? "Length (m)" : u === "SQM" ? "Width (m)" : "Width (ft)";
  if (field === "height") return u === "SQM" ? "Height (m)" : "Height (ft)";
  if (field === "weight") return "Weight (kg)";
  return "Nos";
}

export function computeQuantity(
  uom: string,
  m: { width?: number | null; height?: number | null; weight?: number | null; nos?: number | null },
): number {
  const nos = Number(m.nos) || 0;
  const fields = fieldsForUom(uom);
  let base = 1;
  if (fields.includes("width")) base *= Number(m.width) || 0;
  if (fields.includes("height")) base *= Number(m.height) || 0;
  if (fields.includes("weight")) base *= Number(m.weight) || 0;
  const qty = base * nos;
  return Math.round(qty * 1000) / 1000;
}

export function formatMoney(n: number): string {
  return `₹${(Math.round(n * 100) / 100).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}
