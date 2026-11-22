import { notFound } from "next/navigation";
import Link from "next/link";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import { getPublishedProduct } from "@/lib/products";
import ProductGallery from "@/components/shop/ProductGallery";
import { MAX_QTY_PER_LINE } from "@/lib/models/product";
import ProductPurchase from "@/components/shop/ProductPurchase";
import { getOptionalSession } from "@/lib/auth/dal";
import { canAccessPath, requireNavAccess } from "@/lib/nav-links";

export async function generateMetadata({ params }: PageProps<"/shop/[id]">) {
  const { id } = await params;
  if (!(await canAccessPath(`/shop/${id}`))) return { title: "Shop" };
  const product = await getPublishedProduct(id);
  return { title: product?.title ?? "Shop" };
}

// Only values the product really offers are accepted, so a hand-edited URL
// can't preselect something invalid.
function pick(offered: string[], value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return v && offered.includes(v) ? v : undefined;
}

export default async function ProductPage({ params, searchParams }: PageProps<"/shop/[id]">) {
  const { id } = await params;
  await requireNavAccess(`/shop/${id}`);
  const query = await searchParams;
  const [product, session] = await Promise.all([getPublishedProduct(id), getOptionalSession()]);

  if (!product) {
    notFound();
  }

  return (
    <Container className="py-3">
      <Link href="/shop" className="text-decoration-none small">
        <i className="bi bi-arrow-left me-1" aria-hidden />
        Back to shop
      </Link>

      <Row className="g-4 mt-1">
        <Col md={7}>
          <ProductGallery images={product.images} title={product.title} />
        </Col>
        <Col md={5}>
          <h1 className="h3 fw-bold">{product.title}</h1>
          <ProductPurchase
            productId={product.id}
            basePrice={product.price}
            colors={product.colors}
            sizes={product.sizes}
            sleeves={product.sleeves}
            soldOut={product.soldOut}
            isLoggedIn={session !== null}
            initial={{
              color: pick(product.colors, query.color),
              size: pick(product.sizes, query.size),
              sleeve: pick(product.sleeves.map((s) => s.name), query.sleeve),
            }}
            initialQty={Math.min(MAX_QTY_PER_LINE, Math.max(1, Math.floor(Number(Array.isArray(query.qty) ? query.qty[0] : query.qty)) || 1))}
          />

          {product.description && (
            <>
              <hr />
              <h2 className="h6 fw-bold">About this item</h2>
              <p style={{ whiteSpace: "pre-line" }}>{product.description}</p>
            </>
          )}
        </Col>
      </Row>
    </Container>
  );
}
