const WIDTH = 1440;
const VIEWBOX_HEIGHT = 80;
const PEAK_MIN = 2;
const PEAK_MAX = 40;
const GAP_MIN = 28;
const GAP_MAX = 85;
const SHARP_SEGMENT_CHANCE = 0.18;

function between(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

// A fresh irregular "torn paper" silhouette each render — same rough
// character every time (spacing/height bounds, occasional sharp nicks
// mixed with asymmetric rounded curves) but never the identical shape
// twice, so the several places this renders on a page don't all look
// like copies of one template.
function generateTornPath(): string {
  const points: [number, number][] = [];
  let x = 0;
  while (x < WIDTH) {
    points.push([Math.round(x), Math.round(between(PEAK_MIN, PEAK_MAX))]);
    x += between(GAP_MIN, GAP_MAX);
  }
  points.push([WIDTH, Math.round(between(10, 28))]);

  let d = `M${points[0][0]},${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    const dx = x1 - x0;
    if (Math.random() < SHARP_SEGMENT_CHANCE) {
      d += ` L${x1},${y1}`;
    } else {
      const r1 = between(0.15, 0.55);
      const r2 = between(0.45, 0.85);
      d += ` C${Math.round(x0 + dx * r1)},${y0} ${Math.round(x0 + dx * r2)},${y1} ${x1},${y1}`;
    }
  }
  d += ` L${WIDTH},${VIEWBOX_HEIGHT} L0,${VIEWBOX_HEIGHT} Z`;
  return d;
}

// Decorative "torn paper" transition between a full-bleed banner image and
// the plain section below it — see docs/design/screenshots/Home-1.png.
// `fill` must match the background color of whatever comes right after this
// element in the DOM, or the seam will be visible.
export default function TornPaperEdge({ fill }: { fill: string }) {
  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${VIEWBOX_HEIGHT}`}
      preserveAspectRatio="none"
      aria-hidden
      style={{
        // A couple extra px of overlap beyond the section's own bottom
        // border avoids a sub-pixel rendering seam between this shape's
        // fill and the section's true background at certain zoom levels.
        position: "absolute",
        bottom: -4,
        left: 0,
        width: "100%",
        height: 74,
      }}
    >
      <path fill={fill} d={generateTornPath()} />
    </svg>
  );
}
