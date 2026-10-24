import { memo } from "react";
import { BeadChart } from "@/lib/beadChart";

/** Room, in bead widths, for the row and column numbers. */
const RULER = 1.6;
const BEAD_RADIUS = 0.42;
/** Rows and columns are numbered every this many beads. */
const RULER_STEP = 5;

/**
 * The bead chart: one circle per bead in its color, empty cells as faint
 * dashed circles, numbered every five beads. Scales to its container's width.
 * Memoized: the page defers chart rebuilds, which only helps if the urgent
 * re-render on each keystroke skips this (up to 10,000-circle) tree.
 */
export const BeadChartView = memo(function BeadChartView({ chart }: { chart: BeadChart }) {
  const { width, height, cells, palette } = chart;
  const marks = (n: number) =>
    Array.from({ length: Math.floor(n / RULER_STEP) }, (_, i) => (i + 1) * RULER_STEP);

  return (
    <svg
      viewBox={`${-RULER} ${-RULER} ${width + RULER} ${height + RULER}`}
      width="100%"
      role="img"
      aria-label={`Bead chart, ${width} by ${height}`}
      className="block h-auto"
    >
      <g className="fill-neutral-400" fontSize={0.6} textAnchor="middle">
        {marks(width).map((n) => (
          <text key={`c${n}`} x={n - 0.5} y={-0.5}>
            {n}
          </text>
        ))}
        {marks(height).map((n) => (
          <text key={`r${n}`} x={-0.8} y={n - 0.3}>
            {n}
          </text>
        ))}
      </g>
      {Array.from(cells, (c, i) => {
        const x = (i % width) + 0.5;
        const y = Math.floor(i / width) + 0.5;
        return c < 0 ? (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={BEAD_RADIUS}
            fill="none"
            className="stroke-neutral-300"
            strokeWidth={0.04}
            strokeDasharray="0.12 0.12"
          />
        ) : (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={BEAD_RADIUS}
            fill={palette[c].hex}
            stroke="rgba(0,0,0,0.25)"
            strokeWidth={0.05}
          />
        );
      })}
    </svg>
  );
});
