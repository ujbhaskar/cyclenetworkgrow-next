"use client";

import { useState } from "react";

// Amazon-style: a column of thumbnails beside one large image (a row under
// it on narrow screens). Hovering or tapping a thumbnail swaps the main
// image, and the arrows step through the array in order.
export default function ProductGallery({ images, title }: { images: string[]; title: string }) {
  const [active, setActive] = useState(0);

  if (images.length === 0) {
    return (
      <div
        className="d-flex align-items-center justify-content-center rounded"
        style={{ aspectRatio: "1 / 1", backgroundColor: "rgba(var(--bs-success-rgb), 0.12)" }}
      >
        <i className="bi bi-bag text-success" style={{ fontSize: 64 }} aria-hidden />
      </div>
    );
  }

  const step = (delta: number) => setActive((current) => (current + delta + images.length) % images.length);

  return (
    <div className="d-flex flex-column-reverse flex-md-row gap-3">
      {images.length > 1 && (
        <div className="d-flex flex-row flex-md-column gap-2" style={{ overflowX: "auto", maxHeight: 520 }}>
          {images.map((url, index) => (
            <button
              key={url}
              type="button"
              onMouseEnter={() => setActive(index)}
              onClick={() => setActive(index)}
              aria-label={`Show image ${index + 1}`}
              aria-current={index === active}
              className="p-0 bg-white flex-shrink-0"
              style={{
                width: 64,
                height: 64,
                borderRadius: 6,
                overflow: "hidden",
                border: index === active ? "2px solid var(--bs-success)" : "1px solid #ddd",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- external Firebase Storage URL */}
              <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </button>
          ))}
        </div>
      )}

      <div className="position-relative flex-grow-1 border rounded bg-white" style={{ aspectRatio: "1 / 1", overflow: "hidden" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- external Firebase Storage URL */}
        <img
          src={images[active]}
          alt={`${title} — image ${active + 1} of ${images.length}`}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
        {images.length > 1 && (
          <>
            <button
              type="button"
              className="btn btn-light position-absolute top-50 start-0 translate-middle-y ms-2 shadow-sm"
              onClick={() => step(-1)}
              aria-label="Previous image"
            >
              <i className="bi bi-chevron-left" aria-hidden />
            </button>
            <button
              type="button"
              className="btn btn-light position-absolute top-50 end-0 translate-middle-y me-2 shadow-sm"
              onClick={() => step(1)}
              aria-label="Next image"
            >
              <i className="bi bi-chevron-right" aria-hidden />
            </button>
            <span className="position-absolute bottom-0 end-0 m-2 badge text-bg-dark opacity-75">
              {active + 1} / {images.length}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
