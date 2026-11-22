// Post-login "send me back where I was" targets. Only same-site paths are
// accepted — anything else (a full URL, protocol-relative "//evil.com", a
// backslash trick) falls back to the home page, so /login?next=... can't be
// turned into an open redirect.
export function safeNextPath(value: string | string[] | undefined | null): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) {
    return "/";
  }
  return raw;
}

export function loginUrlWithNext(next: string): string {
  return `/login?next=${encodeURIComponent(next)}`;
}
