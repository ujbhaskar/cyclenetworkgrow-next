import { requireRole } from "@/lib/auth/dal";
import { getAllTestimonials } from "@/lib/testimonials";
import ReviewModerationList from "@/components/admin/ReviewModerationList";

export default async function AdminReviewModerationPage() {
  await requireRole("admin");
  const reviews = await getAllTestimonials();

  return (
    <div>
      <h1 className="h3 mb-1">Review Moderation</h1>
      <p className="text-muted mb-4">
        Every submitted testimonial, newest first. Approve or reject pending ones — approved ones
        appear in the home page carousel — or delete any of them outright.
      </p>
      <ReviewModerationList reviews={reviews} />
    </div>
  );
}
