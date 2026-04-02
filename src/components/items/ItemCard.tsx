import Link from "next/link";
import RarityBadge from "./RarityBadge";
import type { Rarity } from "@/lib/types";

interface ItemCardProps {
  id: string;
  name: string;
  rarity: Rarity;
  subtitle?: string;
  category: string;
  href?: string;
}

export default function ItemCard({
  id,
  name,
  rarity,
  subtitle,
  category,
  href,
}: ItemCardProps) {
  const link = href || `/db/${category}/${id}`;

  return (
    <Link
      href={link}
      className="group block p-4 bg-bg-card border border-border-subtle rounded-lg hover:border-accent-gold/40 hover:bg-bg-card-hover transition-all"
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <h3 className="text-sm font-semibold text-text-primary group-hover:text-text-gold transition-colors leading-tight">
          {name}
        </h3>
      </div>
      <RarityBadge rarity={rarity} />
      {subtitle && (
        <p className="text-xs text-text-secondary mt-1">{subtitle}</p>
      )}
    </Link>
  );
}
