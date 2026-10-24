import { BeadChart } from "@/lib/beadChart";

/** How many beads of each color the chart needs, most first, and the total. */
export function BeadCountList({ chart }: { chart: BeadChart }) {
  const rows = chart.palette
    .map((bead, i) => ({ bead, count: chart.counts[i] }))
    .sort((a, b) => b.count - a.count || a.bead.name.localeCompare(b.bead.name));
  const total = chart.counts.reduce((sum, n) => sum + n, 0);

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-neutral-900">Beads needed</h2>
      <ul className="flex flex-col gap-2">
        {rows.map(({ bead, count }) => (
          <li key={bead.name} className="flex items-center gap-3 text-sm">
            <span
              className="h-5 w-5 shrink-0 rounded-full border border-black/20"
              style={{ backgroundColor: bead.hex }}
            />
            <span className="text-neutral-800">{bead.name}</span>
            <span className="ml-auto tabular-nums text-neutral-900">{count}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex border-t border-neutral-200 pt-3 text-sm font-medium text-neutral-900">
        Total
        <span className="ml-auto tabular-nums">{total}</span>
      </div>
    </div>
  );
}
