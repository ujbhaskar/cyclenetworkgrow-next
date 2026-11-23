import Link from "next/link";
import { formatPrice, priceRange, type Product } from "@/lib/models/product";
import EventBannerImage from "@/components/events/EventBannerImage";

// One product tile — shared by the shop page and the home page's Shop section.
export default function ProductCard({ product, imageHeight = 320 }: { product: Product; imageHeight?: number }) {
  const { min, max } = priceRange(product);
  return (
    <Link href={`/shop/${product.id}`} className="text-decoration-none text-reset">
      <div className="card h-100 border-0 shadow-sm">
        <EventBannerImage imageUrl={product.images[0] ?? null} alt={product.title} height={imageHeight} iconSize={48} />
        <div className="card-body">
          <h2 className="h6 mb-1">{product.title}</h2>
          <p className="fw-bold text-success mb-0">
            {min !== max ? "From " : ""}
            {formatPrice(min)}
          </p>
          {/* The whole card is the link; this is just a visible cue (no nested <a>). */}
          <span className="btn btn-outline-success btn-sm mt-3">Know more &rarr;</span>
        </div>
      </div>
    </Link>
  );
}
