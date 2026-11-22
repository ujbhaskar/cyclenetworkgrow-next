"use client";

import Link from "next/link";
import { formatPrice } from "@/lib/models/product";
import type { ResolvedCartLine } from "@/lib/models/cart";
import { orderItemOptions } from "@/lib/models/order";
import QtyStepper from "./QtyStepper";

// The list of cart items — the same for a signed-in rider's cart and a guest's.
export default function CartLines({
  lines,
  busyKey,
  dimmed,
  onQty,
  onRemove,
}: {
  lines: ResolvedCartLine[];
  busyKey: string | null;
  dimmed?: boolean;
  onQty: (key: string, qty: number) => void;
  onRemove: (key: string) => void;
}) {
  return (
    <div className="d-flex flex-column gap-3" style={{ opacity: dimmed ? 0.6 : 1 }}>
      {lines.map((line) => (
        <div key={line.key} className={`bg-white border rounded p-3 ${line.available ? "" : "border-danger"}`}>
          <div className="d-flex gap-3">
            {line.image ? (
              // eslint-disable-next-line @next/next/no-img-element -- external Firebase Storage URL
              <img src={line.image} alt="" style={{ width: 88, height: 88, objectFit: "cover", borderRadius: 8 }} />
            ) : (
              <div className="bg-light rounded" style={{ width: 88, height: 88 }} />
            )}
            <div className="flex-grow-1">
              <div className="d-flex justify-content-between gap-2">
                <Link href={`/shop/${line.productId}`} className="fw-semibold text-decoration-none text-reset">
                  {line.title}
                </Link>
                <span className="fw-bold text-nowrap">{formatPrice(line.lineTotal)}</span>
              </div>
              <div className="text-muted small">{orderItemOptions(line)}</div>
              <div className="text-muted small">{formatPrice(line.unitPrice)} each</div>
              {line.issue && <div className="text-danger small fw-semibold mt-1">{line.issue}</div>}
              <div className="d-flex align-items-center gap-3 mt-2">
                <QtyStepper
                  value={Math.min(line.qty, line.maxQty)}
                  max={line.maxQty}
                  disabled={busyKey === line.key}
                  onChange={(qty) => onQty(line.key, qty)}
                />
                <button
                  type="button"
                  className="btn btn-link btn-sm text-danger p-0"
                  disabled={busyKey === line.key}
                  onClick={() => onRemove(line.key)}
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
