import Link from "next/link";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import { getOptionalSession } from "@/lib/auth/dal";
import { listPublishedProducts } from "@/lib/products";
import { formatPrice, priceRange } from "@/lib/models/product";
import EventBannerImage from "@/components/events/EventBannerImage";
import { requireNavAccess } from "@/lib/nav-links";

export const metadata = { title: "Shop" };

export default async function ShopPage() {
  await requireNavAccess("/shop");
  const [products, session] = await Promise.all([listPublishedProducts(), getOptionalSession()]);

  return (
    <Container className="py-3">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="fw-bold mb-0">Shop</h1>
        {session && (
          <Link href="/my-orders" className="btn btn-outline-success">
            <i className="bi bi-receipt me-1" aria-hidden />
            My Orders
          </Link>
        )}
      </div>

      {products.length === 0 ? (
        <p className="text-muted">Nothing in the shop yet — check back soon!</p>
      ) : (
        <Row className="g-4">
          {products.map((product) => (
            <Col xs={6} md={4} lg={3} key={product.id}>
              <Link href={`/shop/${product.id}`} className="text-decoration-none text-reset">
                <div className="card h-100 border-0 shadow-sm">
                  <EventBannerImage imageUrl={product.images[0] ?? null} alt={product.title} height={240} iconSize={48} />
                  <div className="card-body">
                    <h2 className="h6 mb-1">{product.title}</h2>
                    <p className="fw-bold text-success mb-0">
                      {priceRange(product).min !== priceRange(product).max ? "From " : ""}
                      {formatPrice(priceRange(product).min)}
                    </p>
                  </div>
                </div>
              </Link>
            </Col>
          ))}
        </Row>
      )}
    </Container>
  );
}
