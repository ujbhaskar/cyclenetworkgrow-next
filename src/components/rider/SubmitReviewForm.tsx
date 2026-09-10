"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SubmitReviewForm() {
  const router = useRouter();
  const [quote, setQuote] = useState("");
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quote, title }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not submit your review");
      }
      setSubmitted(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit your review");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="alert alert-success">
        <i className="bi bi-check-circle-fill me-2" aria-hidden />
        Thanks! Your review is in — it&apos;ll appear on the home page once an admin approves it.
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="mb-3">
        <label htmlFor="review-title" className="form-label">
          Your role (optional)
        </label>
        <input
          id="review-title"
          type="text"
          className="form-control"
          placeholder="e.g. Weekend Rider"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={60}
        />
      </div>
      <div className="mb-3">
        <label htmlFor="review-quote" className="form-label">
          Your review
        </label>
        <textarea
          id="review-quote"
          className="form-control"
          rows={4}
          placeholder="Tell other riders about your experience..."
          value={quote}
          onChange={(e) => setQuote(e.target.value)}
          maxLength={600}
          required
        />
        <div className="form-text">{quote.length}/600</div>
      </div>
      {error && <p className="text-danger small">{error}</p>}
      <button type="submit" className="btn btn-success" disabled={submitting || !quote.trim()}>
        {submitting ? "Submitting…" : "Submit Review"}
      </button>
    </form>
  );
}
