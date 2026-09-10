import Container from "react-bootstrap/Container";
import { verifySession } from "@/lib/auth/dal";
import SubmitReviewForm from "@/components/rider/SubmitReviewForm";

export default async function SubmitReviewPage() {
  await verifySession();

  return (
    <Container className="py-3" style={{ maxWidth: 600 }}>
      <h1 className="h3 mb-1">Share Your Story</h1>
      <p className="text-muted mb-4">
        Submitted reviews are checked by an admin before they appear on the home page.
      </p>
      <SubmitReviewForm />
    </Container>
  );
}
