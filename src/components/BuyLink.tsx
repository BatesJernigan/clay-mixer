import { ClayColor } from "@/lib/types";

export function BuyLink({ clay }: { clay: Pick<ClayColor, "url"> }) {
  if (!clay.url) return null;
  return (
    <a
      href={clay.url}
      target="_blank"
      rel="noopener"
      className="mt-0.5 inline-block text-xs font-medium text-neutral-700 underline decoration-neutral-300 underline-offset-2 hover:text-neutral-950 hover:decoration-neutral-700"
    >
      Buy at {new URL(clay.url).hostname.replace(/^www\./, "")}
    </a>
  );
}
