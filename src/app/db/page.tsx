"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, useMemo, Suspense } from "react";
import Link from "next/link";
import {
  categoryLoaders,
  formatWeaponType,
  type CategoryKey,
} from "@/lib/data";
import { CATEGORIES, RARITY_TEXT } from "@/lib/constants";
import RarityBadge from "@/components/items/RarityBadge";
import ItemIcon from "@/components/items/ItemIcon";
import type { Rarity } from "@/lib/types";

interface AnyItem {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  rarity?: Rarity;
  weaponType?: string;
  handling?: string;
  armorSlot?: string;
  material?: string;
  shieldType?: string;
  damageType?: string;
  dropLevel?: number;
  sellValue?: number;
  baseAttributes?: number;
  isUnique?: boolean;
  enchantmentIds?: string[];
  stats?: Record<string, number[]>;
}

const STAT_NAMES: Record<string, string> = {
  "0": "Physical Damage",
  "1": "Fire Damage",
  "2": "Ice Damage",
  "3": "Lightning Damage",
  "4": "Holy Damage",
  "5": "Plague Damage",
  "6": "Physical Defense",
  "7": "Fire Defense",
  "8": "Ice Defense",
  "9": "Lightning Defense",
  "10": "Holy Defense",
  "11": "Plague Defense",
  "12": "Poise",
  "13": "Balance",
  "18": "Strength Scaling",
  "19": "Dexterity Scaling",
  "20": "Intelligence Scaling",
  "21": "Faith Scaling",
  "22": "Weight",
  "23": "Stamina Cost",
};

function getSubtitle(item: AnyItem): string {
  const parts: string[] = [];
  if (item.weaponType) parts.push(formatWeaponType(item.weaponType));
  if (item.handling) parts.push(item.handling);
  if (item.material)
    parts.push(item.material.charAt(0).toUpperCase() + item.material.slice(1));
  if (item.armorSlot)
    parts.push(
      item.armorSlot.charAt(0).toUpperCase() + item.armorSlot.slice(1)
    );
  if (item.shieldType)
    parts.push(
      item.shieldType.charAt(0).toUpperCase() +
        item.shieldType.slice(1) +
        " Shield"
    );
  if (item.dropLevel) parts.push(`Lvl ${item.dropLevel}`);
  return parts.join(" \u2022 ");
}

function DatabaseContent() {
  const searchParams = useSearchParams();
  const category = (searchParams.get("cat") || "weapons") as CategoryKey;
  const itemId = searchParams.get("item");

  const [items, setItems] = useState<AnyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [rarityFilter, setRarityFilter] = useState("all");

  const catInfo = CATEGORIES.find((c) => c.slug === category);

  useEffect(() => {
    setLoading(true);
    setSearch("");
    setTypeFilter("all");
    setRarityFilter("all");
    const loader = categoryLoaders[category];
    if (loader) {
      loader().then((data) => {
        setItems(data as AnyItem[]);
        setLoading(false);
      });
    } else {
      setItems([]);
      setLoading(false);
    }
  }, [category]);

  const typeOptions = useMemo(() => {
    const types = new Set<string>();
    items.forEach((item) => {
      if (item.weaponType) types.add(item.weaponType);
      else if (item.material) types.add(item.material);
      else if (item.shieldType) types.add(item.shieldType);
    });
    return Array.from(types).sort();
  }, [items]);

  const rarityOptions = useMemo(() => {
    const rarities = new Set<string>();
    items.forEach((item) => {
      if (item.rarity) rarities.add(item.rarity);
    });
    return Array.from(rarities);
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (search) {
        const q = search.toLowerCase();
        if (
          !item.name?.toLowerCase().includes(q) &&
          !item.description?.toLowerCase().includes(q)
        )
          return false;
      }
      if (typeFilter !== "all") {
        const t = item.weaponType || item.material || item.shieldType || "";
        if (t !== typeFilter) return false;
      }
      if (rarityFilter !== "all" && item.rarity !== rarityFilter) return false;
      return true;
    });
  }, [items, search, typeFilter, rarityFilter]);

  // If viewing a specific item
  const selectedItem = itemId
    ? items.find((i) => i.id === itemId)
    : null;

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-bg-card rounded w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-24 bg-bg-card rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  // Item Detail View
  if (selectedItem) {
    const item = selectedItem;
    const infoRows: [string, string][] = [];
    if (item.weaponType)
      infoRows.push(["Type", formatWeaponType(item.weaponType)]);
    if (item.handling) infoRows.push(["Handling", item.handling]);
    if (item.material)
      infoRows.push([
        "Material",
        item.material.charAt(0).toUpperCase() + item.material.slice(1),
      ]);
    if (item.armorSlot)
      infoRows.push([
        "Slot",
        item.armorSlot.charAt(0).toUpperCase() + item.armorSlot.slice(1),
      ]);
    if (item.shieldType)
      infoRows.push([
        "Shield Type",
        item.shieldType.charAt(0).toUpperCase() + item.shieldType.slice(1),
      ]);
    if (item.damageType)
      infoRows.push([
        "Damage Type",
        item.damageType.charAt(0).toUpperCase() + item.damageType.slice(1),
      ]);
    if (item.dropLevel) infoRows.push(["Level", String(item.dropLevel)]);
    if (item.sellValue) infoRows.push(["Sell Value", String(item.sellValue)]);
    if (item.baseAttributes)
      infoRows.push(["Base Attributes", String(item.baseAttributes)]);

    const statRows: [string, string][] = [];
    if (item.stats) {
      Object.entries(item.stats).forEach(([key, values]) => {
        if (Array.isArray(values) && values.length >= 4) {
          // values format: [unknown, unknown, hasScaling, scalingValue, unknown]
          // Show scaling value if present, or just indicate presence
          const scalingVal = values[3];
          const hasIt = values[2];
          if (hasIt === 0 && scalingVal === 0) return; // skip zero stats
          const name = STAT_NAMES[key] || `Stat ${key}`;
          if (scalingVal > 0) {
            statRows.push([name, String(scalingVal)]);
          } else if (hasIt > 0) {
            statRows.push([name, "Yes"]);
          }
        }
      });
    }

    return (
      <div className="max-w-3xl">
        <Link
          href={`/db?cat=${category}`}
          className="text-sm text-text-secondary hover:text-text-gold mb-4 inline-block"
        >
          &larr; Back to {catInfo?.name || category}
        </Link>

        <div className="bg-bg-card border border-border-subtle rounded-lg p-6">
          <div className="flex items-start gap-4 mb-4">
            <ItemIcon icon={item.icon} size={80} className="rounded" />
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold text-text-gold">{item.name}</h1>
                {item.isUnique && (
                  <span className="text-xs bg-accent-gold/20 text-text-gold px-2 py-0.5 rounded">
                    Unique
                  </span>
                )}
              </div>
              <RarityBadge rarity={item.rarity || "common"} />
            </div>
          </div>

          {item.description && (
            <p className="text-sm text-text-secondary italic mb-6 border-l-2 border-accent-gold/30 pl-4">
              {item.description}
            </p>
          )}

          {infoRows.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-text-primary mb-3 uppercase tracking-wide">
                Details
              </h2>
              <div className="grid grid-cols-2 gap-2">
                {infoRows.map(([label, value]) => (
                  <div
                    key={label}
                    className="flex justify-between py-1.5 px-3 bg-bg-secondary rounded text-sm"
                  >
                    <span className="text-text-secondary">{label}</span>
                    <span className="text-text-primary font-medium">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {statRows.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-text-primary mb-3 uppercase tracking-wide">
                Stats
              </h2>
              <div className="space-y-1">
                {statRows.map(([label, value]) => (
                  <div
                    key={label}
                    className="flex justify-between py-1.5 px-3 bg-bg-secondary rounded text-sm"
                  >
                    <span className="text-text-secondary">{label}</span>
                    <span className="text-text-primary font-medium">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {item.enchantmentIds && item.enchantmentIds.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-text-primary mb-3 uppercase tracking-wide">
                Built-in Enchantments
              </h2>
              <div className="space-y-1">
                {item.enchantmentIds.map((eid) => (
                  <div
                    key={eid}
                    className="py-1.5 px-3 bg-bg-secondary rounded text-sm text-rarity-epic"
                  >
                    Enchantment {eid.slice(-6)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Category List View
  return (
    <>
      <h1 className="text-3xl font-bold text-text-gold mb-2">
        {catInfo?.icon} {catInfo?.name || category}
      </h1>
      <p className="text-sm text-text-secondary mb-6">
        {filtered.length} of {items.length} items
      </p>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {CATEGORIES.map((cat) => (
          <Link
            key={cat.slug}
            href={`/db?cat=${cat.slug}`}
            className={`px-3 py-1.5 rounded text-sm transition-colors ${
              category === cat.slug
                ? "bg-accent-gold/20 text-text-gold border border-accent-gold/40"
                : "bg-bg-card text-text-secondary hover:text-text-primary border border-border-subtle"
            }`}
          >
            {cat.icon} {cat.name}
          </Link>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          placeholder="Search items..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-2 bg-bg-card border border-border-subtle rounded text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent-gold/60 w-full sm:w-64"
        />
        {typeOptions.length > 1 && (
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 bg-bg-card border border-border-subtle rounded text-sm text-text-primary focus:outline-none focus:border-accent-gold/60"
          >
            <option value="all">All Types</option>
            {typeOptions.map((t) => (
              <option key={t} value={t}>
                {formatWeaponType(t)}
              </option>
            ))}
          </select>
        )}
        {rarityOptions.length > 1 && (
          <select
            value={rarityFilter}
            onChange={(e) => setRarityFilter(e.target.value)}
            className="px-3 py-2 bg-bg-card border border-border-subtle rounded text-sm text-text-primary focus:outline-none focus:border-accent-gold/60"
          >
            <option value="all">All Rarities</option>
            {rarityOptions.map((r) => (
              <option key={r} value={r}>
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Item Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((item) => (
          <Link
            key={item.id}
            href={`/db?cat=${category}&item=${item.id}`}
            className="group flex items-center gap-3 p-3 bg-bg-card border border-border-subtle rounded-lg hover:border-accent-gold/40 hover:bg-bg-card-hover transition-all"
          >
            <ItemIcon icon={item.icon} size={48} />
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-text-primary group-hover:text-text-gold transition-colors leading-tight truncate">
                {item.name}
              </h3>
              <RarityBadge rarity={item.rarity || "common"} />
              <p className="text-xs text-text-secondary mt-0.5 truncate">
                {getSubtitle(item)}
              </p>
            </div>
          </Link>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-text-secondary py-12">
          No items match your filters.
        </p>
      )}
    </>
  );
}

export default function DatabasePage() {
  return (
    <div className="p-6 md:p-10">
      <Suspense
        fallback={
          <div className="animate-pulse">
            <div className="h-8 bg-bg-card rounded w-48 mb-4" />
          </div>
        }
      >
        <DatabaseContent />
      </Suspense>
    </div>
  );
}
