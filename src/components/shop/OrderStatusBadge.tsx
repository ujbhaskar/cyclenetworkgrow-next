import { STATUS_LABELS, type OrderStatus } from "@/lib/models/order";

const STYLE: Record<OrderStatus, string> = {
  created: "text-bg-warning",
  paid: "text-bg-success",
  expired: "text-bg-secondary",
  cancelled: "text-bg-danger",
};

export default function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`badge ${STYLE[status]}`}>{STATUS_LABELS[status]}</span>;
}
