"use client";

import Link from "next/link";
import { useState } from "react";
import { CATEGORIES } from "@/lib/constants";
import { usePathname } from "next/navigation";

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="bg-bg-secondary border-b border-border-subtle sticky top-0 z-50">
      <div className="flex items-center justify-between px-4 h-14">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-bold text-text-gold font-[Cinzel]">
            NRFTW Builder
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-4">
          <Link
            href="/planner"
            className="px-4 py-1.5 rounded border border-accent-gold/40 text-text-gold text-sm hover:bg-accent-gold/10 transition-colors"
          >
            Build Planner
          </Link>
          <Link
            href="/db?cat=weapons"
            className="text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            Database
          </Link>
        </nav>

        {/* Mobile menu button */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="md:hidden p-2 text-text-secondary hover:text-text-primary"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            {menuOpen ? (
              <path d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path d="M3 12h18M3 6h18M3 18h18" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <nav className="md:hidden border-t border-border-subtle bg-bg-secondary p-4 space-y-1">
          <Link
            href="/planner"
            onClick={() => setMenuOpen(false)}
            className="block px-3 py-2 rounded text-sm text-text-gold hover:bg-bg-card"
          >
            Build Planner
          </Link>
          <div className="pt-2 pb-1">
            <span className="px-3 text-xs uppercase tracking-wider text-text-secondary/60">
              Database
            </span>
          </div>
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.slug}
              href={`/db/${cat.slug}`}
              onClick={() => setMenuOpen(false)}
              className={`block px-3 py-2 rounded text-sm transition-colors ${
                pathname === `/db/${cat.slug}`
                  ? "bg-accent-gold/20 text-text-gold"
                  : "text-text-secondary hover:text-text-primary hover:bg-bg-card"
              }`}
            >
              <span className="mr-2">{cat.icon}</span>
              {cat.name}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
