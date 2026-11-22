import Container from "react-bootstrap/Container";
import { verifySession } from "@/lib/auth/dal";
import { requireNavAccess } from "@/lib/nav-links";
import { resolveCart } from "@/lib/shop-cart";
import { getUserProfile } from "@/lib/user-profile";
import { isSyntheticEmail } from "@/lib/auth/phone";
import CartView from "@/components/shop/CartView";

export const metadata = { title: "My cart" };

export default async function CartPage() {
  const session = await verifySession();
  await requireNavAccess("/shop"); // a locked shop has no cart for non-admins either

  const [cart, profile] = await Promise.all([resolveCart(session.uid), getUserProfile(session.uid)]);

  return (
    <Container className="py-3" style={{ maxWidth: 1000 }}>
      <h1 className="fw-bold mb-4">My cart</h1>
      <CartView
        cart={cart}
        delivery={{
          name: profile?.displayName ?? "",
          phone: profile?.phone ?? "",
          // Phone-only accounts carry an internal placeholder — treat it as no email.
          email: profile?.email && !isSyntheticEmail(profile.email) ? profile.email : "",
          address: profile?.address ?? "",
          city: profile?.city ?? "",
          state: profile?.state ?? "",
          pincode: profile?.pincode ?? "",
        }}
      />
    </Container>
  );
}
