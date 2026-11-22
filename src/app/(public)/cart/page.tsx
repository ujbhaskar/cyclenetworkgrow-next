import Container from "react-bootstrap/Container";
import { getOptionalSession } from "@/lib/auth/dal";
import { isSyntheticEmail } from "@/lib/auth/phone";
import { requireNavAccess } from "@/lib/nav-links";
import { resolveCart } from "@/lib/shop-cart";
import { getUserProfile } from "@/lib/user-profile";
import CartView from "@/components/shop/CartView";
import GuestCartView from "@/components/shop/GuestCartView";

export const metadata = { title: "My cart" };

// One cart page for everyone. A signed-in rider's cart is on the server and
// their delivery details come from their profile; a visitor without an account
// gets a browser-held cart and a form for their details.
export default async function CartPage() {
  await requireNavAccess("/shop"); // a locked shop has no cart for non-admins either
  const session = await getOptionalSession();

  if (!session) {
    return (
      <Container className="py-3" style={{ maxWidth: 1000 }}>
        <h1 className="fw-bold mb-4">My cart</h1>
        <GuestCartView />
      </Container>
    );
  }

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
