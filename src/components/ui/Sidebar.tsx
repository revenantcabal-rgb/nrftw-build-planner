"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CATEGORIES } from "@/lib/constants";

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 bg-bg-secondary border-r border-border-subtle hidden md:block overflow-y-auto">
      <nav className="p-4 space-y-1">
        <Link
          href="/"
          className={`block px-3 py-2 rounded text-sm transition-colors ${
            pathname === "/"
              ? "bg-accent-gold/20 text-text-gold"
              : "text-text-secondary hover:text-text-primary hover:bg-bg-card"
          }`}
        >
          Home
        </Link>
        <Link
          href="/planner"
          className={`block px-3 py-2 rounded text-sm font-semibold transition-colors ${
            pathname === "/planner"
              ? "bg-accent-gold/20 text-text-gold"
              : "text-text-gold/80 hover:text-text-gold hover:bg-bg-card"
          }`}
        >
          Build Planner
        </Link>

        <div className="pt-4 pb-2">
          <span className="px-3 text-xs uppercase tracking-wider text-text-secondary/60">
            Database
          </span>
        </div>

        {CATEGORIES.map((cat) => (
          <Link
            key={cat.slug}
            href={`/db?cat=${cat.slug}`}
            className={`block px-3 py-2 rounded text-sm transition-colors ${
              pathname === "/db"
                ? "text-text-secondary hover:text-text-primary hover:bg-bg-card"
                : "text-text-secondary hover:text-text-primary hover:bg-bg-card"
            }`}
          >
            <span className="mr-2">{cat.icon}</span>
            {cat.name}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
