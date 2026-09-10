"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Testimonial, TestimonialStatus } from "@/lib/models/testimonial";
import UserAvatar from "@/components/UserAvatar";

const STATUS_BADGE: Record<TestimonialStatus, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-warning bg-opacity-25 text-warning-emphasis" },
  approved: { label: "Approved", className: "bg-success bg-opacity-10 text-success" },
  discarded: { label: "Discarded", className: "bg-danger bg-opacity-10 text-danger" },
};

export default function ReviewModerationList({ reviews }: { reviews: Testimonial[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function decide(id: string, status: "approved" | "discarded") {
    setPendingId(id);
    try {
      const res = await fetch(`/api/admin/reviews/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        throw new Error("Failed to update review");
      }
      router.refresh();
    } finally {
      setPendingId(null);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Permanently delete this review? This can't be undone.")) {
      return;
    }
    setPendingId(id);
    try {
      const res = await fetch(`/api/admin/reviews/${id}`, { method: "DELETE" });
      if (!res.ok) {
        throw new Error("Failed to delete review");
      }
      router.refresh();
    } finally {
      setPendingId(null);
    }
  }

  if (reviews.length === 0) {
    return <p className="text-muted">No reviews have been submitted yet.</p>;
  }

  return (
    <div className="d-flex flex-column gap-3">
      {reviews.map((review) => {
        const badge = STATUS_BADGE[review.status];
        return (
          <div key={review.id} className="card border-0 shadow-sm">
            <div className="card-body">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <div className="d-flex align-items-center gap-3">
                  <UserAvatar photoUrl={review.photoUrl} size={40} />
                  <div>
                    <div className="fw-semibold">{review.submittedByName}</div>
                    {review.title && <div className="text-muted small">{review.title}</div>}
                  </div>
                </div>
                <span className={`badge ${badge.className}`}>{badge.label}</span>
              </div>
              <p className="mb-1">&ldquo;{review.quote}&rdquo;</p>
              <p className="text-muted small mb-3">
                Submitted {new Date(review.submittedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
              </p>
              <div className="d-flex gap-2">
                {review.status !== "approved" && (
                  <button
                    type="button"
                    className="btn btn-success btn-sm"
                    disabled={pendingId === review.id}
                    onClick={() => decide(review.id, "approved")}
                  >
                    <i className="bi bi-check-lg me-1" aria-hidden />
                    Approve
                  </button>
                )}
                {review.status !== "discarded" && (
                  <button
                    type="button"
                    className="btn btn-outline-danger btn-sm"
                    disabled={pendingId === review.id}
                    onClick={() => decide(review.id, "discarded")}
                  >
                    <i className="bi bi-x-lg me-1" aria-hidden />
                    Reject
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  disabled={pendingId === review.id}
                  onClick={() => remove(review.id)}
                >
                  <i className="bi bi-trash3 me-1" aria-hidden />
                  Delete
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
