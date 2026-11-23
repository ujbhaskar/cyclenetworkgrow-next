import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import { canAccessPath } from "@/lib/nav-links";
import { listPublishedProducts } from "@/lib/products";
import ProductCard from "@/components/shop/ProductCard";

const SHOWN = 4;

// A few of the newest products on the home page. Shows nothing at all while the
// shop is locked to admins (see the Admin-only toggle in Navigation Menu) or
// has no published products, so the home page never advertises an empty or
// private shop.
export default async function ShopSection() {
  if (!(await canAccessPath("/shop"))) return null;
  const products = (await listPublishedProducts()).slice(0, SHOWN);
  if (products.length === 0) return null;

  return (
    <section className="py-3">
      <Container className="pb-5">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div className="d-flex align-items-center gap-3 flex-grow-1">
            <h1 className="mb-0 text-nowrap">Shop</h1>
            <hr className="flex-grow-1 my-0 opacity-50" style={{ borderTop: "2px solid currentColor" }} />
          </div>
        </div>

        <Row className="g-4">
          {products.map((product) => (
            <Col xs={12} sm={6} md={3} key={product.id}>
              <ProductCard product={product} />
            </Col>
          ))}
        </Row>
      </Container>
    </section>
  );
}
