// Shop cart shapes, shared by client components and server code — no server-only imports.

import { MAX_QTY_PER_LINE } from "@/lib/models/product";

export type CartLine = {
  productId: string;
  color: string | null;
  size: string | null;
  sleeve: string | null;
  qty: number;
};

/** Identity of a cart line (product + chosen options). Same key = same line, quantities merge. */
export function cartLineKey(line: Pick<CartLine, "productId" | "color" | "size" | "sleeve">): string {
  return [line.productId, line.color ?? "", line.size ?? "", line.sleeve ?? ""].map(encodeURIComponent).join("|");
}

export function clampQty(value: unknown): number {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) ? Math.min(MAX_QTY_PER_LINE, Math.max(1, n)) : 1;
}

/** A cart line joined with its current product data, ready to display. */
export type ResolvedCartLine = CartLine & {
  key: string;
  title: string;
  image: string | null;
  unitPrice: number;
  lineTotal: number;
  /** Most the rider can set for this line. */
  maxQty: number;
  /** False when the product was unpublished/removed or an option no longer exists. */
  available: boolean;
  issue: string | null;
};

export type ResolvedCart = {
  lines: ResolvedCartLine[];
  /** Sum of the available lines. */
  subtotal: number;
  itemCount: number;
  hasProblems: boolean;
};
