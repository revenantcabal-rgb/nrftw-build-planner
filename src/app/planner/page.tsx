"use client";

import { useState, useEffect, useCallback } from "react";
import { getWeapons, getArmors, getShields, getTrinkets, formatWeaponType } from "@/lib/data";
import { EQUIP_SLOT_LABELS } from "@/lib/constants";
import { RARITY_TEXT } from "@/lib/constants";
import { getBuildFromUrl, setBuildInUrl, type BuildState } from "@/lib/codec";
import ItemPickerModal from "@/components/planner/ItemPickerModal";
import ItemIcon from "@/components/items/ItemIcon";
import type { Rarity, EquipSlot } from "@/lib/types";

interface SlotItem {
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

type ItemPool = Record<string, SlotItem[]>;

const SLOT_CATEGORIES: Record<EquipSlot, string[]> = {
  weapon: ["weapons"],
  offhand: ["weapons", "shields"],
  head: ["armors"],
  chest: ["armors"],
  hands: ["armors"],
  legs: ["armors"],
  ring1: ["trinkets"],
  ring2: ["trinkets"],
  ring3: ["trinkets"],
};

const SLOT_ORDER: EquipSlot[] = [
  "weapon",
  "offhand",
  "head",
  "chest",
  "hands",
  "legs",
  "ring1",
  "ring2",
  "ring3",
];

export default function PlannerPage() {
  const [buildName, setBuildName] = useState("My Build");
  const [slots, setSlots] = useState<Record<EquipSlot, SlotItem | null>>({
    weapon: null,
    offhand: null,
    head: null,
    chest: null,
    hands: null,
    legs: null,
    ring1: null,
    ring2: null,
    ring3: null,
  });
  const [itemPools, setItemPools] = useState<ItemPool>({});
  const [activeSlot, setActiveSlot] = useState<EquipSlot | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Load all item data
  useEffect(() => {
    Promise.all([getWeapons(), getArmors(), getShields(), getTrinkets()]).then(
      ([weapons, armors, shields, trinkets]) => {
        setItemPools({
          weapons: weapons as SlotItem[],
          armors: armors as SlotItem[],
          shields: shields as SlotItem[],
          trinkets: trinkets as SlotItem[],
        });
        setLoading(false);
      }
    );
  }, []);

  // Restore build from URL on mount
  useEffect(() => {
    if (loading) return;
    const saved = getBuildFromUrl();
    if (saved) {
      setBuildName(saved.name || "My Build");
      const allItems = Object.values(itemPools).flat();
      const newSlots = { ...slots };
      for (const slot of SLOT_ORDER) {
        const itemId = saved[slot];
        if (itemId) {
          const found = allItems.find((i) => i.id === itemId);
          if (found) newSlots[slot] = found;
        }
      }
      setSlots(newSlots);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // Save build to URL whenever it changes
  const saveBuild = useCallback(() => {
    const build: BuildState = { name: buildName };
    for (const slot of SLOT_ORDER) {
      if (slots[slot]) {
        build[slot] = slots[slot]!.id;
      }
    }
    setBuildInUrl(build);
  }, [buildName, slots]);

  useEffect(() => {
    if (!loading) saveBuild();
  }, [saveBuild, loading]);

  // Get items for a slot
  function getItemsForSlot(slot: EquipSlot): SlotItem[] {
    const categories = SLOT_CATEGORIES[slot];
    const items: SlotItem[] = [];
    for (const cat of categories) {
      const pool = itemPools[cat] || [];
      if (cat === "armors") {
        const slotMap: Record<string, string> = {
          head: "head",
          chest: "chest",
          hands: "hands",
          legs: "legs",
        };
        const armorSlot = slotMap[slot];
        if (armorSlot) {
          items.push(...pool.filter((i) => i.armorSlot === armorSlot));
        }
      } else if (cat === "weapons" && slot === "offhand") {
        // Off-hand: only one-handed weapons and dual-wielding
        items.push(
          ...pool.filter(
            (i) => i.handling === "one-handed" || i.handling === "dual-wielding"
          )
        );
      } else {
        items.push(...pool);
      }
    }
    return items;
  }

  // Get unique weapon types for the picker filter
  function getTypesForSlot(slot: EquipSlot): string[] {
    if (slot === "weapon" || slot === "offhand") {
      const items = getItemsForSlot(slot);
      const types = new Set<string>();
      items.forEach((i) => {
        if (i.weaponType) types.add(i.weaponType);
        if (i.shieldType) types.add(i.shieldType + "_shield");
      });
      return Array.from(types).sort();
    }
    if (["head", "chest", "hands", "legs"].includes(slot)) {
      const items = getItemsForSlot(slot);
      const mats = new Set<string>();
      items.forEach((i) => {
        if (i.material) mats.add(i.material);
      });
      return Array.from(mats).sort();
    }
    return [];
  }

  function handleSelect(item: SlotItem) {
    if (!activeSlot) return;
    setSlots((prev) => ({
      ...prev,
      [activeSlot]: item.id ? item : null,
    }));
    setActiveSlot(null);
  }

  function handleShare() {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (loading) {
    return (
      <div className="p-6 md:p-10">
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-bg-card rounded w-64" />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="h-32 bg-bg-card rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-text-gold mb-2">
            Build Planner
          </h1>
          <input
            type="text"
            value={buildName}
            onChange={(e) => setBuildName(e.target.value)}
            className="bg-transparent border-b border-border-subtle text-text-primary text-lg focus:outline-none focus:border-accent-gold/60 w-64"
            placeholder="Build name..."
          />
        </div>
        <button
          onClick={handleShare}
          className="px-4 py-2 bg-accent-gold/20 border border-accent-gold/50 rounded text-text-gold text-sm hover:bg-accent-gold/30 transition-colors"
        >
          {copied ? "Copied!" : "Share Build"}
        </button>
      </div>

      {/* Equipment Slots Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        {SLOT_ORDER.map((slot) => {
          const item = slots[slot];
          return (
            <button
              key={slot}
              onClick={() => setActiveSlot(slot)}
              className={`p-4 rounded-lg border text-left transition-all ${
                item
                  ? "bg-bg-card border-accent-gold/30 hover:border-accent-gold/60"
                  : "bg-bg-card/50 border-border-subtle border-dashed hover:border-accent-gold/40 hover:bg-bg-card"
              }`}
            >
              <div className="text-xs text-text-secondary uppercase tracking-wide mb-2">
                {EQUIP_SLOT_LABELS[slot]}
              </div>
              {item ? (
                <div className="flex items-center gap-2">
                  <ItemIcon icon={item.icon} size={40} />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-text-primary leading-tight mb-0.5 truncate">
                      {item.name}
                    </div>
                    <span
                      className={`text-xs font-semibold uppercase ${RARITY_TEXT[item.rarity || "common"]}`}
                    >
                      {item.rarity}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-text-secondary/50">
                  Click to select
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Build Summary */}
      <div className="bg-bg-card border border-border-subtle rounded-lg p-6">
        <h2 className="text-lg font-bold text-text-primary mb-4">
          Build Summary
        </h2>
        <div className="space-y-2">
          {SLOT_ORDER.map((slot) => {
            const item = slots[slot];
            return (
              <div
                key={slot}
                className="flex justify-between py-1.5 text-sm"
              >
                <span className="text-text-secondary">
                  {EQUIP_SLOT_LABELS[slot]}
                </span>
                <span
                  className={
                    item
                      ? `font-medium ${RARITY_TEXT[item.rarity || "common"]}`
                      : "text-text-secondary/40"
                  }
                >
                  {item ? item.name : "Empty"}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-4 pt-4 border-t border-border-subtle text-xs text-text-secondary">
          Items equipped: {SLOT_ORDER.filter((s) => slots[s]).length} / {SLOT_ORDER.length}
        </div>
      </div>

      {/* Item Picker Modal */}
      {activeSlot && (
        <ItemPickerModal
          items={getItemsForSlot(activeSlot)}
          title={`Select ${EQUIP_SLOT_LABELS[activeSlot]}`}
          typeOptions={getTypesForSlot(activeSlot)}
          onSelect={handleSelect}
          onClose={() => setActiveSlot(null)}
        />
      )}
    </div>
  );
}
