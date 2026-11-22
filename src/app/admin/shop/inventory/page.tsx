import Table from "react-bootstrap/Table";
import Badge from "react-bootstrap/Badge";
import { requireRole } from "@/lib/auth/dal";
import { getInventoryBreakdown } from "@/lib/shop-inventory";

export default async function AdminShopInventoryPage() {
  await requireRole("admin");
  const products = await getInventoryBreakdown();

  return (
    <div>
      <h1 className="h3 mb-1">Shop inventory</h1>
      <p className="text-muted mb-4">
        For every color / size / sleeve: how many paid orders it appears in, units sold, units waiting on payment, and
        whether it&apos;s available. Mark combinations out of stock on each product&apos;s Edit form. Variants that are
        available and have no orders yet aren&apos;t listed.
      </p>

      {products.length === 0 && <p className="text-muted">No products yet.</p>}

      {products.map((product) => (
        <div key={product.productId} className="bg-white border rounded p-3 mb-4">
          <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
            <h2 className="h6 fw-bold mb-0">{product.title}</h2>
            {!product.exists && <Badge bg="secondary">Deleted</Badge>}
            {product.exists && !product.published && <Badge bg="secondary">Draft</Badge>}
            <span className="text-muted small ms-auto">
              {product.totals.paidOrders} paid order{product.totals.paidOrders === 1 ? "" : "s"} · {product.totals.unitsSold} unit
              {product.totals.unitsSold === 1 ? "" : "s"} sold
              {product.totals.unitsPending > 0 && ` · ${product.totals.unitsPending} pending`}
            </span>
          </div>

          {product.rows.length === 0 ? (
            <p className="text-muted small mb-0">No orders yet, and nothing marked out of stock.</p>
          ) : (
            <Table responsive size="sm" className="mb-0 align-middle">
              <thead>
                <tr>
                  <th>Color</th>
                  <th>Size</th>
                  <th>Sleeve</th>
                  <th className="text-end">Paid orders</th>
                  <th className="text-end">Units sold</th>
                  <th className="text-end">Pending</th>
                  <th className="text-end">Status</th>
                </tr>
              </thead>
              <tbody>
                {product.rows.map((row) => (
                  <tr key={[row.color, row.size, row.sleeve].join("|")}>
                    <td>{row.color ?? "—"}</td>
                    <td>{row.size ?? "—"}</td>
                    <td>{row.sleeve ?? "—"}</td>
                    <td className="text-end">{row.paidOrders}</td>
                    <td className="text-end">{row.unitsSold}</td>
                    <td className="text-end">{row.unitsPending || "—"}</td>
                    <td className="text-end">
                      {row.soldOut ? <Badge bg="danger">Out of stock</Badge> : <Badge bg="success">Available</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      ))}
    </div>
  );
}
