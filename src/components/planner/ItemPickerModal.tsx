"use client";

import { useState, useMemo } from "react";
import { formatWeaponType } from "@/lib/data";
import type { Rarity } from "@/lib/types";
import RarityBadge from "@/components/items/RarityBadge";
import ItemIcon from "@/components/items/ItemIcon";

interface PickerItem {
  id: string;
  name: string;
  icon?: string;
  rarity?: Rarity;
  weaponType?: string;
  handling?: string;
  material?: string;
  armorSlot?: string;
  shieldType?: string;
  description?: string;
}

interface ItemPickerModalProps {
  items: PickerItem[];
  title: string;
  typeOptions?: string[];
  onSelect: (item: PickerItem) => void;
  onClose: () => void;
}

export default function ItemPickerModal({
  items,
  title,
  typeOptions = [],
  onSelect,
  onClose,
}: ItemPickerModalProps) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const filtered = useMemo(() => {
    return items.filter((i) => {
      // Search filter
      if (search) {
        const q = search.toLowerCase();
        if (
          !i.name?.toLowerCase().includes(q) &&
          !i.description?.toLowerCase().includes(q)
        )
          return false;
      }
      // Type filter
      if (typeFilter !== "all") {
        if (typeFilter.endsWith("_shield")) {
          if (i.shieldType !== typeFilter.replace("_shield", "")) return false;
        } else {
          const itemType = i.weaponType || i.material || "";
          if (itemType !== typeFilter) return false;
        }
      }
      return true;
    });
  }, [items, search, typeFilter]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-bg-secondary border border-border-subtle rounded-lg w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="p-4 border-b border-border-subtle">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-text-gold">{title}</h2>
            <button
              onClick={onClose}
              className="text-text-secondary hover:text-text-primary p-1"
            >
              &#x2715;
            </button>
          </div>
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
            className="w-full px-3 py-2 bg-bg-card border border-border-subtle rounded text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent-gold/60"
          />
          {typeOptions.length > 1 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              <button
                onClick={() => setTypeFilter("all")}
                className={`px-2.5 py-1 rounded text-xs transition-colors ${
                  typeFilter === "all"
                    ? "bg-accent-gold/20 text-text-gold border border-accent-gold/40"
                    : "bg-bg-card text-text-secondary border border-border-subtle hover:text-text-primary"
                }`}
              >
                All
              </button>
              {typeOptions.map((t) => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={`px-2.5 py-1 rounded text-xs transition-colors ${
                    typeFilter === t
                      ? "bg-accent-gold/20 text-text-gold border border-accent-gold/40"
                      : "bg-bg-card text-text-secondary border border-border-subtle hover:text-text-primary"
                  }`}
                >
                  {t.endsWith("_shield")
                    ? formatWeaponType(t.replace("_shield", "")) + " Shield"
                    : formatWeaponType(t)}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          <button
            onClick={() => onSelect({ id: "", name: "" })}
            className="w-full text-left px-3 py-2 rounded text-sm text-text-secondary hover:bg-bg-card mb-1"
          >
            Clear slot
          </button>
          {filtered.map((item) => (
            <button
              key={item.id}
              onClick={() => onSelect(item)}
              className="w-full text-left px-3 py-2.5 rounded hover:bg-bg-card-hover transition-colors mb-0.5 flex items-center gap-3"
            >
              <ItemIcon icon={item.icon} size={36} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-text-primary truncate">
                    {item.name}
                  </span>
                  <RarityBadge rarity={item.rarity || "common"} />
                </div>
                <div className="text-xs text-text-secondary mt-0.5">
                  {item.weaponType && formatWeaponType(item.weaponType)}
                  {item.handling && ` \u2022 ${item.handling}`}
                  {item.material && item.material}
                  {item.armorSlot && ` \u2022 ${item.armorSlot}`}
                  {item.shieldType && `${item.shieldType} shield`}
                </div>
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="text-center text-text-secondary py-8 text-sm">
              No items found
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
