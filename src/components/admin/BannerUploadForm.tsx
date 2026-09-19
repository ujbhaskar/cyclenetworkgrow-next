"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function BannerUploadForm({
  currentUrl,
  uploadEndpoint,
  submitLabel = "Upload & Use as Banner",
}: {
  currentUrl: string;
  uploadEndpoint: string;
  submitLabel?: string;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState(currentUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setPreviewUrl(URL.createObjectURL(file));
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError("Choose an image first.");
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(uploadEndpoint, { method: "POST", body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Upload failed");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <div
        className="rounded mb-3"
        style={{
          height: 220,
          backgroundImage: previewUrl ? `url('${previewUrl}')` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          backgroundColor: "#f4f6f8",
        }}
      />
      <div className="d-flex align-items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="form-control"
          style={{ maxWidth: 500 }}
          onChange={onFileChange}
        />
        <button type="submit" className="btn btn-success" disabled={uploading}>
          {uploading ? "Uploading…" : submitLabel}
        </button>
      </div>
      <p className="text-muted small mt-2 mb-0">JPEG, PNG, or WebP — up to 5MB.</p>
      {error && <p className="text-danger small mt-2 mb-0">{error}</p>}
    </form>
  );
}
