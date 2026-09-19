export interface ChildItem {
  id: number;
  name: string;
  perunit: number;
  expression: string;
  price: number | null;
  categoryName?: string;
  availableStock?: number;
}

export interface BomApiItem {
  id: number;
  name: string;
  categoryName?: string;
  isGroupedItem: boolean;
  itemPrice: number | null;
  availableStock?: number;
  childItems?: ChildItem[];
}

export interface BomListItem {
  id: number;
  projectId: number;
  projectName: string;
  dueDate: string | null;
  createdDate: string;
  updatedDate: string | null;
  description: string;
  createdByEmail: string | null;
  createdByUser: string | null;
  updatedByUser: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  items?: BomDetailItem[];
}

export interface BomDetailItem {
  id: number;
  parentId: number | null;
  isGroupedItem: boolean;
  itemType: string;
  bomId: number;
  itemId: number;
  itemName: string;
  unit: string | null;
  qty: number;
  totalQuantity?: number;
  allottedQty: number | null;
  purchasedQty: number | null;
  fabricationQty: number | null;
}



export interface BomRow {
  /** stable row id (uuid) */
  rowId: string;
  /** original item id from API */
  itemId: number;
  name: string;
  quantity: number;
  price: number | null;
  /** if part of a group, the group instance id */
  groupInstanceId?: string;
  /** the API item id of the parent grouped item */
  groupItemId?: number;
  /** available stock reported by the API */
  availableStock?: number;
  /** parent group name, for UI label */
  groupName?: string;
  /** parent group's base quantity (the qty variable in expression) */
  groupQty?: number;
  /** expression string from API for recomputation */
  expression?: string;
  /** perunit_qty for the child */
  perunit?: number;
  /** category name from the API, used only in export */
  categoryName?: string;
  /** true if this row is itself a standalone (non-grouped) item */
  standalone: boolean;
}


/**
 * Safely evaluate the small arithmetic expression strings returned by the API,
 * e.g. "(qty*perunit_qty)" or "perunit_qty".
 * Only allows digits, the two known variables, and basic math operators.
 */
export function evalExpression(
  expression: string,
  qty: number,
  perunit: number,
): number {
  const expr = expression.trim();
  // Substitute variables
  const substituted = expr
    .replace(/perunit_qty/g, `(${perunit})`)
    .replace(/\bqty\b/g, `(${qty})`);
  // Whitelist: digits, dot, parens, math operators, whitespace
  if (!/^[\d+\-*/().\s]+$/.test(substituted)) {
    throw new Error(`Unsafe expression: ${expression}`);
  }
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  const fn = new Function(`return (${substituted});`);
  const result = Number(fn());
  if (!Number.isFinite(result)) throw new Error(`Bad eval: ${expression}`);
  return result;
}
