"use client";

import { useState } from "react";
import Link from "next/link";
import Table from "react-bootstrap/Table";
import Button from "react-bootstrap/Button";
import Badge from "react-bootstrap/Badge";
import Alert from "react-bootstrap/Alert";
import { formatPrice, type Product } from "@/lib/models/product";
import ProductFormModal from "./ProductFormModal";

export default function ProductsTable({ initialProducts }: { initialProducts: Product[] }) {
  const [products, setProducts] = useState(initialProducts);
  const [error, setError] = useState<string | null>(null);
  // null = closed, "new" = creating, otherwise the product being edited.
  const [editing, setEditing] = useState<Product | "new" | null>(null);

  async function refetch() {
    const res = await fetch("/api/admin/products");
    if (res.ok) {
      setProducts((await res.json()).products);
    }
  }

  async function handleDelete(product: Product) {
    if (!confirm(`Delete "${product.title}" permanently?`)) {
      return;
    }
    setError(null);
    const res = await fetch(`/api/admin/products/${product.id}`, { method: "DELETE" });
    if (res.ok) {
      setProducts((list) => list.filter((p) => p.id !== product.id));
    } else {
      setError("Couldn't delete that product.");
    }
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1 className="h3 mb-0">Shop</h1>
        <div className="d-flex gap-2">
          <Link href="/admin/shop/orders" className="btn btn-outline-secondary">
            Orders
          </Link>
          <Link href="/admin/shop/inventory" className="btn btn-outline-secondary">
            Inventory
          </Link>
          <Link href="/shop" className="btn btn-outline-secondary" target="_blank">
            View shop
          </Link>
          <Button onClick={() => setEditing("new")}>Add product</Button>
        </div>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <Table responsive hover className="table table-striped align-middle">
        <thead>
          <tr>
            <th style={{ width: 72 }} />
            <th>Title</th>
            <th>Price</th>
            <th>Colors</th>
            <th>Sizes</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {products.length === 0 && (
            <tr>
              <td colSpan={7} className="text-muted text-center py-4">
                No products yet — add the first one.
              </td>
            </tr>
          )}
          {products.map((product) => (
            <tr key={product.id}>
              <td>
                {product.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element -- external Firebase Storage URL
                  <img
                    src={product.images[0]}
                    alt=""
                    style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 6 }}
                  />
                ) : (
                  <div className="bg-light rounded" style={{ width: 56, height: 56 }} />
                )}
              </td>
              <td>{product.title}</td>
              <td className="text-nowrap">{formatPrice(product.price)}</td>
              <td>{product.colors.join(", ") || "—"}</td>
              <td>{product.sizes.join(", ") || "—"}</td>
              <td>
                <Badge bg={product.published ? "success" : "secondary"}>
                  {product.published ? "Published" : "Draft"}
                </Badge>
              </td>
              <td className="text-nowrap">
                <Button size="sm" variant="outline-secondary" className="me-2" onClick={() => setEditing(product)}>
                  Edit
                </Button>
                <Button size="sm" variant="outline-danger" onClick={() => handleDelete(product)}>
                  Delete
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

      {/* key remounts the form per product, so its useState seeding from
          `product` never goes stale when a different one is opened. */}
      <ProductFormModal
        key={editing === "new" ? "new" : (editing?.id ?? "closed")}
        show={editing !== null}
        product={editing === "new" ? null : editing}
        onClose={() => setEditing(null)}
        onSaved={refetch}
      />
    </div>
  );
}
