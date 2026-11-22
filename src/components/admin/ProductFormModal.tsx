"use client";

import { useRef, useState, type FormEvent } from "react";
import Modal from "react-bootstrap/Modal";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import { MAX_PRODUCT_IMAGES, variantCombos, variantKey, type Product } from "@/lib/models/product";

function splitList(text: string): string[] {
  return text
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function ProductFormModal({
  show,
  product,
  onClose,
  onSaved,
}: {
  show: boolean;
  /** null = creating a new product. */
  product: Product | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(product?.title ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [price, setPrice] = useState(product ? String(product.price) : "");
  const [colors, setColors] = useState(product?.colors.join(", ") ?? "");
  const [sizes, setSizes] = useState(product?.sizes.join(", ") ?? "");
  // New products default to the two usual choices; remove both for items with no sleeves.
  // `price` is text so it can be blank = "same as the base price".
  const [sleeveRows, setSleeveRows] = useState<{ name: string; price: string }[]>(
    product
      ? product.sleeves.map((s) => ({ name: s.name, price: s.price === null ? "" : String(s.price) }))
      : [
          { name: "Half sleeve", price: "" },
          { name: "Full sleeve", price: "" },
        ],
  );
  // variantKeys the admin has marked out of stock; everything else is available.
  const [soldOut, setSoldOut] = useState<Set<string>>(() => new Set((product?.soldOut ?? []).map(variantKey)));
  const [published, setPublished] = useState(product?.published ?? true);
  const [images, setImages] = useState<string[]>(product?.images ?? []);
  const [uploading, setUploading] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);

    const room = MAX_PRODUCT_IMAGES - images.length;
    if (room <= 0) {
      setError(`At most ${MAX_PRODUCT_IMAGES} images per product.`);
      return;
    }

    setUploading(true);
    try {
      // One at a time (not Promise.all) so the images land in the order the
      // admin picked them, and a failure partway leaves the earlier ones in.
      for (const file of Array.from(files).slice(0, room)) {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/admin/products/images", { method: "POST", body: formData });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(`${file.name}: ${body.error ?? "upload failed"}`);
        }
        setImages((current) => [...current, body.url]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function move(index: number, delta: -1 | 1) {
    setImages((current) => {
      const target = index + delta;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  // Rows of the stock grid: every color × size × sleeve the form currently offers.
  const combos = variantCombos(
    splitList(colors),
    splitList(sizes),
    sleeveRows.map((r) => r.name.trim()).filter(Boolean),
  );
  const MAX_GRID_ROWS = 300;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch(product ? `/api/admin/products/${product.id}` : "/api/admin/products", {
        method: product ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          price: Number(price),
          images,
          colors: splitList(colors),
          sizes: splitList(sizes),
          sleeves: sleeveRows.filter((r) => r.name.trim()).map((r) => ({ name: r.name.trim(), price: r.price })),
          soldOut: combos.filter((c) => soldOut.has(variantKey(c))),
          published,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Couldn't save product");
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save product");
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal show={show} onHide={onClose} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>{product ? "Edit product" : "Add product"}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-3">
            <Form.Label>Title</Form.Label>
            <Form.Control value={title} onChange={(e) => setTitle(e.target.value)} required />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Description</Form.Label>
            <Form.Control as="textarea" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Form.Group>

          <Row>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>Price (₹)</Form.Label>
                <Form.Control
                  type="number"
                  min={0}
                  step={1}
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  required
                />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>Colors</Form.Label>
                <Form.Control value={colors} onChange={(e) => setColors(e.target.value)} placeholder="Black, Navy, Red" />
                <Form.Text className="text-muted">Comma-separated.</Form.Text>
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>Sizes</Form.Label>
                <Form.Control value={sizes} onChange={(e) => setSizes(e.target.value)} placeholder="S, M, L, XL" />
                <Form.Text className="text-muted">Comma-separated.</Form.Text>
              </Form.Group>
            </Col>
          </Row>

          <Form.Group className="mb-3">
            <Form.Label>Sleeves &amp; price</Form.Label>
            {sleeveRows.map((row, index) => (
              <div key={index} className="d-flex gap-2 mb-2">
                <Form.Control
                  value={row.name}
                  onChange={(e) => setSleeveRows((rows) => rows.map((r, i) => (i === index ? { ...r, name: e.target.value } : r)))}
                  placeholder="e.g. Full sleeve"
                />
                <Form.Control
                  type="number"
                  min={0}
                  step={1}
                  style={{ maxWidth: 170 }}
                  value={row.price}
                  onChange={(e) => setSleeveRows((rows) => rows.map((r, i) => (i === index ? { ...r, price: e.target.value } : r)))}
                  placeholder={price ? `₹${price} (base)` : "Base price"}
                />
                <Button variant="outline-danger" onClick={() => setSleeveRows((rows) => rows.filter((_, i) => i !== index))} title="Remove">
                  ✕
                </Button>
              </div>
            ))}
            <Button variant="outline-secondary" size="sm" onClick={() => setSleeveRows((rows) => [...rows, { name: "", price: "" }])}>
              + Add sleeve option
            </Button>
            <Form.Text className="d-block text-muted">
              Leave a sleeve&apos;s price blank to use the base price above. Riders see the price of the sleeve they pick.
              Remove all rows if this product has no sleeve choice.
            </Form.Text>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Availability</Form.Label>
            <Form.Text className="d-block text-muted mb-2">
              Every color / size / sleeve combination is available unless you mark it out of stock. Riders can&apos;t add
              an out-of-stock combination to their cart.
            </Form.Text>
            {combos.length > MAX_GRID_ROWS ? (
              <p className="text-danger small">Too many combinations to list ({combos.length}). Trim colors, sizes or sleeves.</p>
            ) : (
              <div style={{ maxHeight: 260, overflowY: "auto" }} className="border rounded">
                <table className="table table-sm mb-0 align-middle">
                  <thead className="table-light" style={{ position: "sticky", top: 0 }}>
                    <tr>
                      <th>Color</th>
                      <th>Size</th>
                      <th>Sleeve</th>
                      <th style={{ width: 150 }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {combos.map((combo) => {
                      const key = variantKey(combo);
                      const out = soldOut.has(key);
                      return (
                        <tr key={key} className={out ? "table-danger" : ""}>
                          <td>{combo.color ?? "—"}</td>
                          <td>{combo.size ?? "—"}</td>
                          <td>{combo.sleeve ?? "—"}</td>
                          <td>
                            <Form.Select
                              size="sm"
                              value={out ? "out" : "in"}
                              onChange={(e) =>
                                setSoldOut((current) => {
                                  const next = new Set(current);
                                  if (e.target.value === "out") next.add(key);
                                  else next.delete(key);
                                  return next;
                                })
                              }
                            >
                              <option value="in">Available</option>
                              <option value="out">Out of stock</option>
                            </Form.Select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>
              Images ({images.length}/{MAX_PRODUCT_IMAGES})
            </Form.Label>
            {images.length > 0 && (
              <div className="d-flex flex-wrap gap-2 mb-2">
                {images.map((url, index) => (
                  <div key={url} className="border rounded p-1 text-center" style={{ width: 112 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- external Firebase Storage URL */}
                    <img src={url} alt="" style={{ width: "100%", height: 90, objectFit: "cover", borderRadius: 4 }} />
                    <div className="small text-muted">{index === 0 ? "Cover" : `#${index + 1}`}</div>
                    <div className="d-flex justify-content-center gap-1">
                      <Button size="sm" variant="light" disabled={index === 0} onClick={() => move(index, -1)} title="Move earlier">
                        ←
                      </Button>
                      <Button
                        size="sm"
                        variant="light"
                        disabled={index === images.length - 1}
                        onClick={() => move(index, 1)}
                        title="Move later"
                      >
                        →
                      </Button>
                      <Button
                        size="sm"
                        variant="light"
                        className="text-danger"
                        onClick={() => setImages((current) => current.filter((_, i) => i !== index))}
                        title="Remove"
                      >
                        ✕
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Form.Control
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              disabled={uploading || images.length >= MAX_PRODUCT_IMAGES}
              onChange={(e) => handleFiles((e.target as HTMLInputElement).files)}
            />
            <Form.Text className="text-muted">
              {uploading ? "Uploading…" : "JPEG, PNG or WebP, up to 5MB each. The first image is the cover."}
            </Form.Text>
          </Form.Group>

          <Form.Check
            type="switch"
            id="product-published"
            className="mb-3"
            label="Published (visible in the shop)"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
          />

          {error && <p className="text-danger small">{error}</p>}
          <Button type="submit" disabled={pending || uploading}>
            {pending ? "Saving…" : product ? "Save changes" : "Create product"}
          </Button>
        </Form>
      </Modal.Body>
    </Modal>
  );
}
