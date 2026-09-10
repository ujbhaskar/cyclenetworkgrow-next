// Home page hero stat tiles — a fully admin-authored list (label + value
// text, freely added/removed/reordered), not a fixed set of computed
// metrics. See /admin/content/home-sections. No server-only import, so
// both the admin form (client component) and server code can import it.

export type HeroStat = {
  id: string;
  label: string;
  value: string;
  order: number;
};

// What a client submits when saving the whole list — id/order are assigned
// server-side from array position, since the admin form just reorders by
// dragging/editing a plain array.
export type HeroStatInput = {
  label: string;
  value: string;
};
