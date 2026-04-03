"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { getWeapons, getArmors, getShields, getTrinkets, getRunes, getGems, formatWeaponType } from "@/lib/data";
import { defaultItemConfig } from "@/components/planner/ItemConfigPanel";
import { computeCharacterStats, getWeightClass } from "@/lib/stats";
import { EQUIP_SLOT_LABELS, RARITY_TEXT } from "@/lib/constants";
import { getBuildFromUrl, setBuildInUrl, type BuildState } from "@/lib/codec";
import ItemPickerModal from "@/components/planner/ItemPickerModal";
import ItemConfigPanel from "@/components/planner/ItemConfigPanel";
import ItemIcon from "@/components/items/ItemIcon";
import type { Rarity, EquipSlot } from "@/lib/types";

interface SlotItem {
  id: string;
  name: string;
  icon?: string;
  rarity?: Rarity;
  weaponType?: string;
  weaponClass?: number;
  handling?: string;
  material?: string;
  armorSlot?: string;
  shieldType?: string;
  damageType?: string;
  dropLevel?: number;
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
  "weapon", "offhand", "head", "chest", "hands", "legs", "ring1", "ring2", "ring3",
];

const ATTRIBUTES = [
  { key: "health", label: "Health", color: "text-red-400", icon: "\u2764" },
  { key: "stamina", label: "Stamina", color: "text-green-400", icon: "\u26A1" },
  { key: "strength", label: "Strength", color: "text-orange-400", icon: "\uD83D\uDCAA" },
  { key: "dexterity", label: "Dexterity", color: "text-yellow-400", icon: "\u2734" },
  { key: "intelligence", label: "Intelligence", color: "text-blue-400", icon: "\uD83D\uDD2E" },
  { key: "faith", label: "Faith", color: "text-purple-400", icon: "\u271E" },
  { key: "focus", label: "Focus", color: "text-amber-400", icon: "\u25C7" },
  { key: "equipLoad", label: "Equip Load", color: "text-gray-400", icon: "\uD83C\uDFCB" },
];

const BONUS_ATTRIBUTE_POINTS = 87; // Bonus points to distribute at level 30
const BASE_PER_STAT = 10; // Each stat starts at 10 for free
const MIN_ATTR = 10; // Can't go below base
const MAX_ATTR = 99; // Per-stat cap

export default function PlannerPage() {
  const [buildName, setBuildName] = useState("My Build");
  const [slots, setSlots] = useState<Record<EquipSlot, SlotItem | null>>({
    weapon: null, offhand: null, head: null, chest: null,
    hands: null, legs: null, ring1: null, ring2: null, ring3: null,
  });
  const [attrs, setAttrs] = useState<Record<string, number>>({
    health: 10, stamina: 10, strength: 10, dexterity: 10,
    intelligence: 10, faith: 10, focus: 10, equipLoad: 10,
  });
  const [itemPools, setItemPools] = useState<ItemPool>({});
  const [runePool, setRunePool] = useState<{ id: string; name: string; icon?: string; isUtility?: boolean; compatibleClasses?: number[] }[]>([]);
  const [gemPool, setGemPool] = useState<{ id: string; name: string; icon?: string }[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [facetList, setFacetList] = useState<any[]>([]);
  const [enchantList, setEnchantList] = useState<{ rarity: string; slot: string; group: string; description: string }[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [balanceConfig, setBalanceConfig] = useState<any>(null);
  const [utilityRunes, setUtilityRunes] = useState<(null | { id: string; name: string; icon?: string })[]>([null, null, null, null]);
  const [activeUtilitySlot, setActiveUtilitySlot] = useState<number | null>(null);
  const [utilitySearch, setUtilitySearch] = useState("");
  const [activeSlot, setActiveSlot] = useState<EquipSlot | null>(null);
  const [configSlot, setConfigSlot] = useState<EquipSlot | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [slotConfigs, setSlotConfigs] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const bonusPointsUsed = useMemo(
    () => Object.values(attrs).reduce((sum, val) => sum + (val - BASE_PER_STAT), 0),
    [attrs]
  );
  const remainingPoints = BONUS_ATTRIBUTE_POINTS - bonusPointsUsed;

  // Is main hand a two-handed weapon?
  const isTwoHanded = slots.weapon?.handling === "two-handed";

  // Compute character stats from attributes + balance config
  const charStats = useMemo(() => {
    if (!balanceConfig) return { health: 100, stamina: 50, focus: 100, equipLoad: 100, staminaRegen: 35, critChance: 10, critDamage: 25 };
    return computeCharacterStats(attrs, balanceConfig);
  }, [attrs, balanceConfig]);

  // Compute weight class
  const weightClass = useMemo(() => {
    // TODO: sum up equipped weight from all items
    const equippedWeight = 0;
    return getWeightClass(equippedWeight, charStats.equipLoad || 100, balanceConfig);
  }, [charStats.equipLoad, balanceConfig]);

  // Clear offhand if weapon becomes two-handed
  useEffect(() => {
    if (isTwoHanded && slots.offhand) {
      setSlots((prev) => ({ ...prev, offhand: null }));
    }
  }, [isTwoHanded, slots.offhand]);

  // Load all item data
  useEffect(() => {
    Promise.all([
      getWeapons(), getArmors(), getShields(), getTrinkets(), getRunes(), getGems(),
      fetch('/data/facets-detailed.json').then(r => r.json()),
      fetch('/data/enchantments-list.json').then(r => r.json()),
      fetch('/data/balance-config.json').then(r => r.json()),
    ]).then(
      ([weapons, armors, shields, trinkets, runes, gems, facets, enchants, bc]) => {
        setItemPools({
          weapons: weapons as SlotItem[],
          armors: armors as SlotItem[],
          shields: shields as SlotItem[],
          trinkets: trinkets as SlotItem[],
        });
        setRunePool((runes as { id: string; name: string; icon?: string; isUtility?: boolean; compatibleClasses?: number[] }[]).filter(r => r.name).sort((a, b) => a.name.localeCompare(b.name)));
        setGemPool((gems as { id: string; name: string; icon?: string }[]).filter(g => g.name).sort((a, b) => a.name.localeCompare(b.name)));
        setFacetList(facets);
        setEnchantList(enchants);
        setBalanceConfig(bc);
        setLoading(false);
      }
    );
  }, []);

  // Restore build from URL
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
      if (saved.attrs) {
        setAttrs((prev) => ({ ...prev, ...saved.attrs }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // Save build to URL
  const saveBuild = useCallback(() => {
    const build: BuildState = { name: buildName, attrs };
    for (const slot of SLOT_ORDER) {
      if (slots[slot]) build[slot] = slots[slot]!.id;
    }
    setBuildInUrl(build);
  }, [buildName, slots, attrs]);

  useEffect(() => {
    if (!loading) saveBuild();
  }, [saveBuild, loading]);

  function getItemsForSlot(slot: EquipSlot): SlotItem[] {
    const categories = SLOT_CATEGORIES[slot];
    let items: SlotItem[] = [];
    for (const cat of categories) {
      const pool = itemPools[cat] || [];
      if (cat === "armors") {
        const slotMap: Record<string, string> = { head: "head", chest: "chest", hands: "hands", legs: "legs" };
        const armorSlot = slotMap[slot];
        if (armorSlot) items.push(...pool.filter((i) => i.armorSlot === armorSlot));
      } else if (cat === "weapons" && slot === "offhand") {
        items.push(...pool.filter((i) => i.handling === "one-handed" || i.handling === "dual-wielding"));
      } else {
        items.push(...pool);
      }
    }
    // Prevent duplicate rings - filter out rings already equipped in other ring slots
    if (slot.startsWith("ring")) {
      const otherRingSlots = SLOT_ORDER.filter((s) => s.startsWith("ring") && s !== slot);
      const equippedRingIds = new Set(
        otherRingSlots.map((s) => slots[s]?.id).filter(Boolean)
      );
      items = items.filter((i) => !equippedRingIds.has(i.id));
    }
    return items;
  }

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
      items.forEach((i) => { if (i.material) mats.add(i.material); });
      return Array.from(mats).sort();
    }
    return [];
  }

  function handleSelect(item: SlotItem) {
    if (!activeSlot) return;
    setSlots((prev) => ({ ...prev, [activeSlot]: item.id ? item : null }));
    setActiveSlot(null);
  }

  function handleAttrChange(key: string, delta: number) {
    setAttrs((prev) => {
      const newVal = prev[key] + delta;
      if (newVal < MIN_ATTR || newVal > MAX_ATTR) return prev;
      // Check bonus points budget
      const newBonusUsed = bonusPointsUsed + delta;
      if (newBonusUsed > BONUS_ATTRIBUTE_POINTS) return prev;
      return { ...prev, [key]: newVal };
    });
  }

  function handleShare() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-bg-card rounded w-64" />
          <div className="h-96 bg-bg-card rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-text-gold mb-1">Build Planner</h1>
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
          {copied ? "Link Copied!" : "Share Build"}
        </button>
      </div>

      {/* 3-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_1fr] gap-6">
        {/* Left: Character Attributes */}
        <div className="bg-bg-card border border-border-subtle rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-text-gold uppercase tracking-wide">Character Level</h2>
            <span className="text-lg font-bold text-text-primary border border-border-subtle rounded px-3 py-0.5">30</span>
          </div>

          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-text-gold uppercase tracking-wide">Attributes</h2>
            <span className={`text-sm font-bold ${remainingPoints < 0 ? "text-red-400" : remainingPoints === 0 ? "text-green-400" : "text-text-primary"}`}>
              {remainingPoints} / {BONUS_ATTRIBUTE_POINTS}
            </span>
          </div>

          <div className="space-y-2">
            {ATTRIBUTES.map((attr) => (
              <div key={attr.key} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{attr.icon}</span>
                  <span className={`text-sm font-medium ${attr.color}`}>{attr.label}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleAttrChange(attr.key, -1)}
                    className="w-6 h-6 rounded bg-bg-secondary text-text-secondary hover:text-text-primary hover:bg-bg-card-hover text-xs flex items-center justify-center"
                    disabled={attrs[attr.key] <= MIN_ATTR}
                  >
                    -
                  </button>
                  <span className="w-8 text-center text-sm font-bold text-text-primary">
                    {attrs[attr.key]}
                  </span>
                  <button
                    onClick={() => handleAttrChange(attr.key, 1)}
                    className="w-6 h-6 rounded bg-bg-secondary text-text-secondary hover:text-text-primary hover:bg-bg-card-hover text-xs flex items-center justify-center"
                    disabled={attrs[attr.key] >= MAX_ATTR || remainingPoints <= 0}
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>

          {remainingPoints > 0 && (
            <p className="text-xs text-text-secondary mt-3">
              {remainingPoints} bonus points remaining
            </p>
          )}
          {remainingPoints === 0 && (
            <p className="text-xs text-green-400/70 mt-3">
              All points distributed
            </p>
          )}
        </div>

        {/* Middle: Equipment Slots */}
        <div className="bg-bg-card border border-border-subtle rounded-lg p-5">
          <h2 className="text-sm font-bold text-text-gold uppercase tracking-wide mb-4">Equipment</h2>
          <div className="space-y-2">
            {SLOT_ORDER.map((slot) => {
              const item = slots[slot];
              const isBlocked = slot === "offhand" && isTwoHanded;

              return (
                <button
                  key={slot}
                  onClick={() => {
                    if (isBlocked) return;
                    if (item) {
                      setConfigSlot(slot);
                    } else {
                      setActiveSlot(slot);
                    }
                  }}
                  disabled={isBlocked}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                    isBlocked
                      ? "bg-bg-primary/50 border-border-subtle/30 opacity-40 cursor-not-allowed"
                      : item
                        ? "bg-bg-secondary border-accent-gold/30 hover:border-accent-gold/60"
                        : "bg-bg-secondary/50 border-border-subtle border-dashed hover:border-accent-gold/40"
                  }`}
                >
                  {item ? (
                    <ItemIcon icon={item.icon} size={40} />
                  ) : (
                    <div className="w-10 h-10 rounded bg-bg-primary border border-border-subtle flex items-center justify-center text-text-secondary/30 shrink-0">
                      +
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-text-secondary uppercase tracking-wide">
                      {EQUIP_SLOT_LABELS[slot]}
                      {isBlocked && " (Two-Handed)"}
                    </div>
                    {item ? (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-text-primary truncate">
                          {item.name}
                        </span>
                        <span className={`text-xs font-semibold uppercase shrink-0 ${RARITY_TEXT[item.rarity || "common"]}`}>
                          {item.rarity}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-text-secondary/50">
                        {isBlocked ? "Blocked" : "Click to select"}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Utility Runes */}
          <div className="mt-4 pt-4 border-t border-border-subtle">
            <h2 className="text-sm font-bold text-text-gold uppercase tracking-wide mb-3">Utility Runes (Max: 4)</h2>
            <div className="grid grid-cols-2 gap-2">
              {utilityRunes.map((rune, i) => {
                const isActive = activeUtilitySlot === i;
                const utilityPool = runePool.filter(r => r.isUtility).filter(r =>
                  utilitySearch ? r.name.toLowerCase().includes(utilitySearch.toLowerCase()) : true
                );
                return (
                  <div key={i}>
                    {isActive ? (
                      <div className="bg-bg-card rounded-lg border border-accent-gold/40 p-2 max-h-40 overflow-y-auto">
                        <input type="text" placeholder="Search..." value={utilitySearch}
                          onChange={(e) => setUtilitySearch(e.target.value)} autoFocus
                          className="w-full px-2 py-1 bg-bg-primary border border-border-subtle rounded text-xs text-text-primary mb-1 focus:outline-none" />
                        <button onClick={() => { setUtilityRunes(prev => { const n = [...prev]; n[i] = null; return n; }); setActiveUtilitySlot(null); }}
                          className="w-full text-left px-2 py-1 text-xs text-text-secondary hover:bg-bg-card-hover rounded italic">Clear</button>
                        {utilityPool.map(r => (
                          <button key={r.id} onClick={() => { setUtilityRunes(prev => { const n = [...prev]; n[i] = r; return n; }); setActiveUtilitySlot(null); }}
                            className="w-full text-left px-2 py-1 text-xs text-text-primary hover:bg-bg-card-hover rounded flex items-center gap-2">
                            <ItemIcon icon={r.icon} size={18} /><span className="truncate">{r.name}</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <button onClick={() => { setActiveUtilitySlot(i); setUtilitySearch(""); }}
                        className={`w-full text-left p-2 rounded-lg border text-sm transition-colors ${
                          rune ? "bg-bg-secondary border-border-subtle hover:border-accent-gold/40" : "bg-bg-secondary/50 border-border-subtle border-dashed hover:border-accent-gold/40"
                        }`}>
                        {rune ? (
                          <div className="flex items-center gap-2">
                            <ItemIcon icon={rune.icon} size={20} />
                            <span className="text-xs text-text-primary truncate">{rune.name}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-text-secondary/50">+ Add Rune</span>
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Stat Summary */}
        <div className="space-y-4">
          {/* General */}
          <div className="bg-bg-card border border-border-subtle rounded-lg p-4">
            <h3 className="text-sm font-bold text-text-gold uppercase tracking-wide mb-3">General</h3>
            <StatRow label="Health" value={Math.round(charStats.health)} />
            <StatRow label="Stamina" value={Math.round(charStats.stamina)} />
            <StatRow label="Stamina Regen" value={charStats.staminaRegen} />
            <StatRow label="Focus" value={Math.round(charStats.focus)} />
            <StatRow label="Focus Gain" value="100%" />
          </div>

          {/* Defense */}
          <div className="bg-bg-card border border-border-subtle rounded-lg p-4">
            <h3 className="text-sm font-bold text-text-gold uppercase tracking-wide mb-3">Defense</h3>
            <StatRow label="Physical Resistance" value="0%" />
            <StatRow label="Fire Resistance" value="0%" />
            <StatRow label="Ice Resistance" value="0%" />
            <StatRow label="Lightning Resistance" value="0%" />
            <StatRow label="Plague Resistance" value="0%" />
            <StatRow label="Poise" value="0" />
          </div>

          {/* Weight */}
          <div className="bg-bg-card border border-border-subtle rounded-lg p-4">
            <h3 className="text-sm font-bold text-text-gold uppercase tracking-wide mb-3">Weight</h3>
            <StatRow label="Equipment Load" value={Math.round(charStats.equipLoad)} />
            <StatRow label="Equipped Weight" value="0.0" />
            <StatRow label="Weight Class" value={`${weightClass.name} (${Math.round(weightClass.ratio * 100)}%)`}
              valueColor={weightClass.name === "Light" ? "text-green-400" : weightClass.name === "Medium" ? "text-yellow-400" : "text-red-400"} />
          </div>

          {/* Damage */}
          <div className="bg-bg-card border border-border-subtle rounded-lg p-4">
            <h3 className="text-sm font-bold text-text-gold uppercase tracking-wide mb-3">Damage</h3>
            <StatRow label="Physical Damage" value="0%" />
            <StatRow label="Fire Damage" value="0%" />
            <StatRow label="Ice Damage" value="0%" />
            <StatRow label="Lightning Damage" value="0%" />
            <StatRow label="Plague Damage" value="0%" />
          </div>

          {/* Speed */}
          <div className="bg-bg-card border border-border-subtle rounded-lg p-4">
            <h3 className="text-sm font-bold text-text-gold uppercase tracking-wide mb-3">Speed</h3>
            <StatRow label="Speed" value="0%" />
            <StatRow label="Movement Speed" value="0%" />
            <StatRow label="Attack Speed" value="0%" />
          </div>

          {/* Misc */}
          <div className="bg-bg-card border border-border-subtle rounded-lg p-4">
            <h3 className="text-sm font-bold text-text-gold uppercase tracking-wide mb-3">Miscellaneous</h3>
            <StatRow label="Critical Damage Chance" value={`${Math.round(charStats.critChance)}%`} />
            <StatRow label="Critical Damage" value={`${Math.round(charStats.critDamage)}%`} />
            <StatRow label="Lifesteal" value="0%" />
            <StatRow label="Armor Penetration" value="0%" />
            <StatRow label="Thorns" value="0%" />
            <StatRow label="Regainable Health" value="0%" />
            <StatRow label="Barrier Gain" value="0%" />
          </div>
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

      {/* Item Config Panel */}
      {configSlot && slots[configSlot] && (
        <ConfigErrorBoundary onClose={() => setConfigSlot(null)}>
          <ItemConfigPanel
            item={slots[configSlot]!}
            slotKey={configSlot}
            slotLabel={EQUIP_SLOT_LABELS[configSlot]}
            config={slotConfigs[configSlot] || defaultItemConfig()}
            allRunes={runePool as { id: string; name: string; icon?: string; isUtility: boolean; compatibleClasses: number[] }[]}
            allGems={gemPool}
            allFacets={facetList}
            allEnchantments={enchantList}
            onConfigChange={(cfg) => setSlotConfigs((prev) => ({ ...prev, [configSlot]: cfg }))}
            onChangeItem={() => {
              setConfigSlot(null);
              setActiveSlot(configSlot);
            }}
            onRemoveItem={() => {
              setSlots((prev) => ({ ...prev, [configSlot]: null }));
              setSlotConfigs((prev) => { const n = { ...prev }; delete n[configSlot]; return n; });
              setConfigSlot(null);
            }}
            onClose={() => setConfigSlot(null)}
          />
        </ConfigErrorBoundary>
      )}
    </div>
  );
}

function StatRow({
  label,
  value,
  valueColor = "text-text-primary",
}: {
  label: string;
  value: string | number;
  valueColor?: string;
}) {
  return (
    <div className="flex justify-between py-1 text-sm">
      <span className="text-text-secondary">{label}</span>
      <span className={`font-medium ${valueColor}`}>{value}</span>
    </div>
  );
}

// Error boundary to catch render errors in ItemConfigPanel
import React from "react";
class ConfigErrorBoundary extends React.Component<
  { children: React.ReactNode; onClose: () => void },
  { error: string | null }
> {
  constructor(props: { children: React.ReactNode; onClose: () => void }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  componentDidCatch(error: Error) {
    console.error("ItemConfigPanel crash:", error);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={this.props.onClose} />
          <div className="relative bg-bg-secondary border border-red-500 rounded-lg p-6 max-w-md">
            <h2 className="text-red-400 font-bold mb-2">Config Panel Error</h2>
            <p className="text-text-secondary text-sm mb-4">{this.state.error}</p>
            <button onClick={this.props.onClose} className="px-4 py-2 bg-accent-gold/20 text-text-gold rounded">Close</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
