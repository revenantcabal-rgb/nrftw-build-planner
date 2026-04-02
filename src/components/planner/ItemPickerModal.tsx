"use client";

import { useState, useMemo } from "react";
import { formatWeaponType } from "@/lib/data";
import type { Rarity } from "@/lib/types";
import { RARITY_TEXT } from "@/lib/constants";
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
  const [selectedType, setSelectedType] = useState<string | null>(null);

  // Build category tree from typeOptions
  const categories = useMemo(() => {
    if (typeOptions.length === 0) return [];
    // Group: shields vs weapons vs armor materials
    const hasShields = typeOptions.some((t) => t.endsWith("_shield"));
    const hasWeapons = typeOptions.some((t) => !t.endsWith("_shield"));
    const isArmor = typeOptions.every((t) =>
      ["cloth", "leather", "mesh", "plate"].includes(t)
    );

    if (isArmor) {
      return [
        {
          group: "Armor",
          types: typeOptions.map((t) => ({
            key: t,
            label: t.charAt(0).toUpperCase() + t.slice(1),
          })),
        },
      ];
    }

    const result: { group: string; types: { key: string; label: string }[] }[] =
      [];
    if (hasShields) {
      result.push({
        group: "Shields",
        types: typeOptions
          .filter((t) => t.endsWith("_shield"))
          .map((t) => ({
            key: t,
            label:
              formatWeaponType(t.replace("_shield", "")) + " Shield",
          })),
      });
    }
    if (hasWeapons) {
      result.push({
        group: "Weapons",
        types: typeOptions
          .filter((t) => !t.endsWith("_shield"))
          .map((t) => ({ key: t, label: formatWeaponType(t) })),
      });
    }
    return result;
  }, [typeOptions]);

  const filtered = useMemo(() => {
    let result = items;

    // Type filter
    if (selectedType) {
      result = result.filter((i) => {
        if (selectedType.endsWith("_shield")) {
          return i.shieldType === selectedType.replace("_shield", "");
        }
        return (i.weaponType || i.material || "") === selectedType;
      });
    }

    // Search filter
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (i) =>
          i.name?.toLowerCase().includes(q) ||
          i.description?.toLowerCase().includes(q)
      );
    }

    // Sort alphabetically
    return result.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [items, search, selectedType]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-bg-secondary border border-border-subtle rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border-subtle">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-text-gold">{title}</h2>
            <button
              onClick={onClose}
              className="text-text-secondary hover:text-text-primary p-1 text-xl"
            >
              &#x2715;
            </button>
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary/50">
              &#x1F50D;
            </span>
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              className="w-full pl-9 pr-3 py-2 bg-bg-card border border-border-subtle rounded text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent-gold/60"
            />
          </div>
        </div>

        {/* Two-panel body */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Left: Category sidebar */}
          {categories.length > 0 && (
            <div className="w-44 shrink-0 border-r border-border-subtle overflow-y-auto p-2">
              <button
                onClick={() => setSelectedType(null)}
                className={`w-full text-left px-3 py-1.5 rounded text-sm mb-1 transition-colors ${
                  !selectedType
                    ? "bg-accent-gold/20 text-text-gold"
                    : "text-text-secondary hover:text-text-primary hover:bg-bg-card"
                }`}
              >
                All
              </button>
              {categories.map((cat) => (
                <div key={cat.group} className="mb-2">
                  <div className="px-3 py-1 text-xs font-bold text-text-gold uppercase tracking-wide">
                    {cat.group}
                  </div>
                  {cat.types.map((t) => (
                    <button
                      key={t.key}
                      onClick={() =>
                        setSelectedType(selectedType === t.key ? null : t.key)
                      }
                      className={`w-full text-left px-5 py-1.5 rounded text-sm transition-colors ${
                        selectedType === t.key
                          ? "bg-accent-gold/20 text-text-gold"
                          : "text-text-secondary hover:text-text-primary hover:bg-bg-card"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Right: Item list */}
          <div className="flex-1 overflow-y-auto p-2">
            <button
              onClick={() => onSelect({ id: "", name: "" })}
              className="w-full text-left px-3 py-2 rounded text-sm text-text-secondary hover:bg-bg-card mb-1 italic"
            >
              None (clear slot)
            </button>
            {filtered.map((item) => (
              <button
                key={item.id}
                onClick={() => onSelect(item)}
                className="w-full text-left px-3 py-2 rounded hover:bg-bg-card-hover transition-colors mb-0.5 flex items-center gap-3"
              >
                <ItemIcon icon={item.icon} size={32} />
                <span
                  className={`text-sm font-medium truncate ${RARITY_TEXT[item.rarity || "common"]}`}
                >
                  {item.name}
                </span>
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
    </div>
  );
}
