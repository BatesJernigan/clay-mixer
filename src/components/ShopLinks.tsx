import { ClayColor } from "@/lib/types";
import { shopLinksFor } from "@/lib/shopLinks";

export function ShopLinks({ clay }: { clay: Pick<ClayColor, "brand" | "name"> }) {
  return (
    <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
      {shopLinksFor(clay).map((link) => (
        <a
          key={link.label}
          href={link.url}
          target="_blank"
          // "sponsored" tells search engines these may be affiliate links.
          rel={link.kind === "shop" ? "noopener sponsored" : "noopener"}
          className={
            link.kind === "shop"
              ? "font-medium text-neutral-700 underline decoration-neutral-300 underline-offset-2 hover:text-neutral-950 hover:decoration-neutral-700"
              : "text-neutral-500 hover:text-neutral-800"
          }
        >
          {link.kind === "shop" ? `Buy · ${link.label}` : link.label}
        </a>
      ))}
    </p>
  );
}
