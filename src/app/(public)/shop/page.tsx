import Link from "next/link";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import { getOptionalSession } from "@/lib/auth/dal";
import { listPublishedProducts } from "@/lib/products";
import ProductCard from "@/components/shop/ProductCard";
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
            <Col xs={12} sm={6} md={4} lg={3} key={product.id}>
              <ProductCard product={product} />
            </Col>
          ))}
        </Row>
      )}
    </Container>
  );
}
