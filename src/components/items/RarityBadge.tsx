import { RARITY_TEXT } from "@/lib/constants";
import type { Rarity } from "@/lib/types";
import { formatRarity } from "@/lib/data";

export default function RarityBadge({ rarity }: { rarity: Rarity }) {
  return (
    <span
      className={`text-xs font-semibold uppercase tracking-wide ${RARITY_TEXT[rarity] || "text-text-secondary"}`}
    >
      {formatRarity(rarity)}
    </span>
  );
}
