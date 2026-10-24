"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/mix", label: "Mixer" },
  { href: "/palette", label: "Palette" },
  { href: "/beads", label: "Beads" },
  { href: "/library", label: "Library" },
  { href: "/recipes", label: "Recipes" },
];

export function NavBar() {
  const pathname = usePathname();

  return (
    <header className="border-b border-neutral-200 bg-white print:hidden">
      <div className="mx-auto flex max-w-4xl items-center gap-6 px-4 py-4">
        <span className="font-semibold text-neutral-900">Clay Mixer</span>
        <nav className="flex gap-4">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-medium ${
                pathname === link.href ||
                (link.href !== "/" && pathname.startsWith(`${link.href}/`))
                  ? "text-neutral-900"
                  : "text-neutral-500 hover:text-neutral-800"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
