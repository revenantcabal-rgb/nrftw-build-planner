"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { getWeapons, getArmors, getShields, getTrinkets, getRunes, getGems, formatWeaponType } from "@/lib/data";
import { defaultItemConfig } from "@/components/planner/ItemConfigPanel";
import { computeCharacterStats, computeWeaponBaseStats, getWeightClass } from "@/lib/stats";
import { collectAllModifiers, type StatModifiers } from "@/lib/modifiers";
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  stats?: Record<string, any>;
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [weaponStatsDb, setWeaponStatsDb] = useState<Record<string, any>>({});
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [weaponDefaultRunes, setWeaponDefaultRunes] = useState<Record<string, any[]>>({});
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

  // Compute equipment modifiers from facets, enchantments, gems
  const equipMods = useMemo(() => {
    return collectAllModifiers(slots, slotConfigs, facetList, weaponStatsDb);
  }, [slots, slotConfigs, facetList, weaponStatsDb]);

  // Compute weight class using real equipped weight
  const weightClass = useMemo(() => {
    const equippedWeight = equipMods.equippedWeight;
    const totalEquipLoad = (charStats.equipLoad || 100) * (1 + equipMods.equipLoad / 100);
    return getWeightClass(equippedWeight, totalEquipLoad, balanceConfig);
  }, [charStats.equipLoad, equipMods.equippedWeight, equipMods.equipLoad, balanceConfig]);

  // Clear offhand if weapon becomes two-handed
  useEffect(() => {
    if (isTwoHanded && slots.offhand) {
      setSlots((prev) => ({ ...prev, offhand: null }));
    }
  }, [isTwoHanded, slots.offhand]);

  // Load all item data
  useEffect(() => {
    // Helper: fetch JSON, return {} on failure (armor/shield/trinket stats may not exist yet)
    const fetchOpt = (url: string) => fetch(url).then(r => r.ok ? r.json() : {}).catch(() => ({}));

    Promise.all([
      getWeapons(), getArmors(), getShields(), getTrinkets(), getRunes(), getGems(),
      fetch('/data/facets-detailed.json').then(r => r.json()),
      fetch('/data/enchantments-list.json').then(r => r.json()),
      fetch('/data/balance-config.json').then(r => r.json()),
      fetch('/data/weapon-computed-stats.json').then(r => r.json()),
      fetchOpt('/data/armor-computed-stats.json'),
      fetchOpt('/data/shield-computed-stats.json'),
      fetchOpt('/data/trinket-computed-stats.json'),
      fetchOpt('/data/weapon-default-runes.json'),
    ]).then(
      ([weapons, armors, shields, trinkets, runes, gems, facets, enchants, bc, weaponStats, armorStats, shieldStats, trinketStats, defaultRuneMap]) => {
        setItemPools({
          weapons: weapons as SlotItem[],
          armors: armors as SlotItem[],
          shields: shields as SlotItem[],
          trinkets: trinkets as SlotItem[],
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setRunePool((runes as any[]).filter(r => r.name).map(r => ({
          id: r.id, name: r.name, icon: r.icon,
          isUtility: r.data?.utility || r.isUtility || false,
          compatibleClasses: r.data?.compatibleClasses || r.compatibleClasses || [],
        })).sort((a, b) => a.name.localeCompare(b.name)));
        setGemPool((gems as { id: string; name: string; icon?: string }[]).filter(g => g.name).sort((a, b) => a.name.localeCompare(b.name)));
        setFacetList(facets);
        setEnchantList(enchants);
        setBalanceConfig(bc);
        // Merge all item stats into one lookup: { [itemId]: { stats: {...} } }
        const mergedStats = { ...(weaponStats || {}), ...(armorStats || {}), ...(shieldStats || {}), ...(trinketStats || {}) };
        setWeaponStatsDb(mergedStats);
        setWeaponDefaultRunes(defaultRuneMap || {});
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
      const newConfigs: Record<string, ReturnType<typeof defaultItemConfig>> = {};
      for (const slot of SLOT_ORDER) {
        const itemId = saved[slot];
        if (itemId) {
          const found = allItems.find((i) => i.id === itemId);
          if (found) {
            newSlots[slot] = found;
            // Auto-populate default runes for weapon slots
            const isWeapon = slot === "weapon" || (slot === "offhand" && found.weaponType && !found.shieldType);
            if (isWeapon && weaponDefaultRunes[itemId]) {
              const defaults = weaponDefaultRunes[itemId] as { runeId: string; runeName: string; runeIcon: string; isUtility?: boolean }[];
              if (defaults.length > 0) {
                const config = defaultItemConfig();
                defaults.slice(0, 4).forEach((def, i) => {
                  config.runes[i] = {
                    id: def.runeId, name: def.runeName, icon: def.runeIcon,
                    isUtility: def.isUtility || false, compatibleClasses: [],
                  };
                });
                newConfigs[slot] = config;
              }
            }
          }
        }
      }
      setSlots(newSlots);
      if (Object.keys(newConfigs).length > 0) {
        setSlotConfigs((prev) => ({ ...prev, ...newConfigs }));
      }
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

    // Auto-populate default rune(s) for weapons
    const isWeaponSlot = activeSlot === "weapon" || (activeSlot === "offhand" && item.weaponType && !item.shieldType);
    if (isWeaponSlot && item.id && weaponDefaultRunes[item.id]) {
      const defaults = weaponDefaultRunes[item.id] as { runeId: string; runeName: string; runeIcon: string; isUtility?: boolean }[];
      if (defaults.length > 0) {
        const config = slotConfigs[activeSlot] || defaultItemConfig();
        const newRunes = [...config.runes];
        // Fill rune slots with default runes (up to 4 max)
        defaults.slice(0, 4).forEach((def, i) => {
          newRunes[i] = {
            id: def.runeId,
            name: def.runeName,
            icon: def.runeIcon,
            isUtility: def.isUtility || false,
            compatibleClasses: [],
          };
        });
        setSlotConfigs((prev) => ({
          ...prev,
          [activeSlot]: { ...config, runes: newRunes },
        }));
      }
    }

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

      {/* Main Layout: Attributes | Equipment | Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-[260px_280px_1fr] gap-4">
        {/* Left: Character Attributes */}
        <div className="bg-bg-card border border-border-subtle rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-text-gold uppercase tracking-wide">Character Level</h2>
            <span className="text-sm font-bold text-text-primary border border-border-subtle rounded px-2 py-0.5">30</span>
          </div>

          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-text-gold uppercase tracking-wide">Attributes</h2>
            <span className={`text-xs font-bold ${remainingPoints < 0 ? "text-red-400" : remainingPoints === 0 ? "text-green-400" : "text-text-primary"}`}>
              {remainingPoints} / {BONUS_ATTRIBUTE_POINTS}
            </span>
          </div>

          <div className="space-y-1.5">
            {ATTRIBUTES.map((attr) => (
              <div key={attr.key} className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs">{attr.icon}</span>
                  <span className={`text-xs font-medium ${attr.color}`}>{attr.label}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleAttrChange(attr.key, -1)}
                    className="w-5 h-5 rounded bg-bg-secondary text-text-secondary hover:text-text-primary hover:bg-bg-card-hover text-xs flex items-center justify-center"
                    disabled={attrs[attr.key] <= MIN_ATTR}
                  >
                    -
                  </button>
                  <span className="w-7 text-center text-xs font-bold text-text-primary">
                    {attrs[attr.key]}
                  </span>
                  <button
                    onClick={() => handleAttrChange(attr.key, 1)}
                    className="w-5 h-5 rounded bg-bg-secondary text-text-secondary hover:text-text-primary hover:bg-bg-card-hover text-xs flex items-center justify-center"
                    disabled={attrs[attr.key] >= MAX_ATTR || remainingPoints <= 0}
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>

          {remainingPoints > 0 && (
            <p className="text-xs text-text-secondary mt-2">
              {remainingPoints} pts remaining
            </p>
          )}
          {remainingPoints === 0 && (
            <p className="text-xs text-green-400/70 mt-2">
              All points distributed
            </p>
          )}
        </div>

        {/* Middle: Equipment Grid */}
        <div className="bg-bg-card border border-border-subtle rounded-lg p-4">
          <h2 className="text-xs font-bold text-text-gold uppercase tracking-wide mb-3">Equipment</h2>
          <div className="space-y-2">
            {/* Weapon Row */}
            <EquipRow
              icon={"\u2694\uFE0F"}
              label="Weapon"
              slots={[
                { slot: "weapon" as EquipSlot, item: slots.weapon, blocked: false },
              ]}
              subSlots={(() => {
                const cfg = slotConfigs.weapon || defaultItemConfig();
                return cfg.runes.slice(0, 3).map((r: { id: string; name: string; icon?: string } | null, i: number) => ({
                  key: `w-rune-${i}`,
                  item: r,
                  onClick: () => slots.weapon && setConfigSlot("weapon"),
                }));
              })()}
              onSlotClick={(slot) => {
                if (slots[slot]) setConfigSlot(slot);
                else setActiveSlot(slot);
              }}
            />
            {/* Offhand Row */}
            <EquipRow
              icon={"\uD83D\uDEE1\uFE0F"}
              label="Offhand"
              slots={[
                { slot: "offhand" as EquipSlot, item: slots.offhand, blocked: isTwoHanded },
              ]}
              subSlots={(() => {
                if (isTwoHanded) return [];
                const cfg = slotConfigs.offhand || defaultItemConfig();
                return cfg.runes.slice(0, 3).map((r: { id: string; name: string; icon?: string } | null, i: number) => ({
                  key: `o-rune-${i}`,
                  item: r,
                  onClick: () => slots.offhand && setConfigSlot("offhand"),
                }));
              })()}
              onSlotClick={(slot) => {
                if (isTwoHanded) return;
                if (slots[slot]) setConfigSlot(slot);
                else setActiveSlot(slot);
              }}
            />
            {/* Head + Chest Row */}
            <EquipRow
              icon={"\uD83E\uDDE5"}
              label="Armor"
              slots={[
                { slot: "head" as EquipSlot, item: slots.head, blocked: false },
                { slot: "chest" as EquipSlot, item: slots.chest, blocked: false },
              ]}
              onSlotClick={(slot) => {
                if (slots[slot]) setConfigSlot(slot);
                else setActiveSlot(slot);
              }}
            />
            {/* Hands + Legs Row */}
            <EquipRow
              icon={"\uD83E\uDDE4"}
              label="Lower"
              slots={[
                { slot: "hands" as EquipSlot, item: slots.hands, blocked: false },
                { slot: "legs" as EquipSlot, item: slots.legs, blocked: false },
              ]}
              onSlotClick={(slot) => {
                if (slots[slot]) setConfigSlot(slot);
                else setActiveSlot(slot);
              }}
            />
            {/* Rings Row */}
            <EquipRow
              icon={"\uD83D\uDC8D"}
              label="Rings"
              slots={[
                { slot: "ring1" as EquipSlot, item: slots.ring1, blocked: false },
                { slot: "ring2" as EquipSlot, item: slots.ring2, blocked: false },
                { slot: "ring3" as EquipSlot, item: slots.ring3, blocked: false },
              ]}
              onSlotClick={(slot) => {
                if (slots[slot]) setConfigSlot(slot);
                else setActiveSlot(slot);
              }}
            />
          </div>

          {/* Utility Runes */}
          <div className="mt-3 pt-3 border-t border-border-subtle">
            <h2 className="text-xs font-bold text-text-gold uppercase tracking-wide mb-2">Utility Runes</h2>
            <div className="flex items-center gap-1.5">
              <span className="text-lg w-7 text-center shrink-0">{"\u2726"}</span>
              {utilityRunes.map((rune, i) => {
                const isActive = activeUtilitySlot === i;
                const utilityPool = runePool.filter(r => r.isUtility).filter(r =>
                  utilitySearch ? r.name.toLowerCase().includes(utilitySearch.toLowerCase()) : true
                );
                return (
                  <div key={i} className="relative">
                    {isActive ? (
                      <div className="absolute top-0 left-0 z-20 bg-bg-card rounded-lg border border-accent-gold/40 p-2 w-48 max-h-48 overflow-y-auto shadow-lg">
                        <input type="text" placeholder="Search..." value={utilitySearch}
                          onChange={(e) => setUtilitySearch(e.target.value)} autoFocus
                          className="w-full px-2 py-1 bg-bg-primary border border-border-subtle rounded text-xs text-text-primary mb-1 focus:outline-none" />
                        <button onClick={() => { setUtilityRunes(prev => { const n = [...prev]; n[i] = null; return n; }); setActiveUtilitySlot(null); }}
                          className="w-full text-left px-2 py-1 text-xs text-text-secondary hover:bg-bg-card-hover rounded italic">Clear</button>
                        {utilityPool.map(r => (
                          <button key={r.id} onClick={() => { setUtilityRunes(prev => { const n = [...prev]; n[i] = r; return n; }); setActiveUtilitySlot(null); }}
                            className="w-full text-left px-2 py-1 text-xs text-text-primary hover:bg-bg-card-hover rounded flex items-center gap-2">
                            <ItemIcon icon={r.icon} size={16} /><span className="truncate">{r.name}</span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                    <button
                      onClick={() => { setActiveUtilitySlot(isActive ? null : i); setUtilitySearch(""); }}
                      className={`w-11 h-11 rounded border flex items-center justify-center transition-colors ${
                        rune
                          ? "bg-bg-secondary border-border-subtle hover:border-accent-gold/40"
                          : "bg-bg-primary/60 border-border-subtle/50 border-dashed hover:border-accent-gold/40"
                      }`}
                      title={rune ? rune.name : "Add utility rune"}
                    >
                      {rune ? (
                        <ItemIcon icon={rune.icon} size={32} />
                      ) : (
                        <span className="text-text-secondary/30 text-sm">+</span>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Stat Summary - Compact two-column grid */}
        <div className="bg-bg-card border border-border-subtle rounded-lg p-4 self-start">
          <h2 className="text-xs font-bold text-text-gold uppercase tracking-wide mb-3">Character Stats</h2>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            {/* General */}
            <div>
              <h3 className="text-[10px] font-bold text-text-gold uppercase tracking-wider mb-1 border-b border-border-subtle pb-1">General</h3>
              <StatRowCompact label="Health" value={Math.round(charStats.health)} bonus={equipMods.maxHealth} bonusSuffix="%" />
              <StatRowCompact label="Stamina" value={Math.round(charStats.stamina)} bonus={equipMods.maxStamina} bonusSuffix="%" />
              <StatRowCompact label="Stam Regen" value={charStats.staminaRegen} bonus={equipMods.staminaRecovery} bonusSuffix="%" />
              <StatRowCompact label="Focus" value={Math.round(charStats.focus)} bonus={equipMods.maxFocus} bonusSuffix="%" />
              <StatRowCompact label="Focus Gain" value="100%" bonus={equipMods.focusGain} bonusSuffix="%" />
            </div>

            {/* Defense */}
            <div>
              <h3 className="text-[10px] font-bold text-text-gold uppercase tracking-wider mb-1 border-b border-border-subtle pb-1">Defense</h3>
              <StatRowCompact label="Physical" value={Math.round(equipMods.physicalResistance) || "0"} />
              <StatRowCompact label="Fire" value={Math.round(equipMods.fireResistance + equipMods.elementalResistance) || "0"} />
              <StatRowCompact label="Ice" value={Math.round(equipMods.iceResistance + equipMods.elementalResistance) || "0"} />
              <StatRowCompact label="Lightning" value={Math.round(equipMods.lightningResistance + equipMods.elementalResistance) || "0"} />
              <StatRowCompact label="Plague" value={Math.round(equipMods.plagueResistance + equipMods.elementalResistance) || "0"} />
              <StatRowCompact label="Dmg Resist" value={fmtPct(equipMods.damageResistance)} />
              <StatRowCompact label="Poise" value={Math.round(equipMods.poise) || "0"} />
              <StatRowCompact label="Stagger Res" value={fmtPct(equipMods.staggerResistance)} />
            </div>

            {/* Weight */}
            <div>
              <h3 className="text-[10px] font-bold text-text-gold uppercase tracking-wider mb-1 border-b border-border-subtle pb-1">Weight</h3>
              <StatRowCompact label="Equip Load" value={Math.round(charStats.equipLoad * (1 + equipMods.equipLoad / 100))} />
              <StatRowCompact label="Equipped" value={equipMods.equippedWeight.toFixed(1)} />
              <StatRowCompact label="Class" value={`${weightClass.name} (${Math.round(weightClass.ratio * 100)}%)`}
                valueColor={weightClass.name === "Light" ? "text-green-400" : weightClass.name === "Medium" ? "text-yellow-400" : "text-red-400"} />
            </div>

            {/* Speed */}
            <div>
              <h3 className="text-[10px] font-bold text-text-gold uppercase tracking-wider mb-1 border-b border-border-subtle pb-1">Speed</h3>
              <StatRowCompact label="Overall" value={fmtPct(equipMods.overallSpeed)} />
              <StatRowCompact label="Movement" value={fmtPct(equipMods.movementSpeed)} />
              <StatRowCompact label="Attack" value={fmtPct(equipMods.attackSpeed)} />
            </div>

            {/* Damage */}
            <div>
              <h3 className="text-[10px] font-bold text-text-gold uppercase tracking-wider mb-1 border-b border-border-subtle pb-1">Damage</h3>
              <StatRowCompact label="Damage" value={fmtPct(equipMods.damage + equipMods.attackDamage)} />
              <StatRowCompact label="Physical" value={fmtPct(equipMods.physicalDamage)} />
              <StatRowCompact label="Fire" value={fmtPct(equipMods.fireDamage)} />
              <StatRowCompact label="Ice" value={fmtPct(equipMods.iceDamage)} />
              <StatRowCompact label="Lightning" value={fmtPct(equipMods.lightningDamage)} />
              <StatRowCompact label="Plague" value={fmtPct(equipMods.plagueDamage)} />
              <StatRowCompact label="Rune" value={fmtPct(equipMods.runeDamage)} />
              <StatRowCompact label="Stagger" value={fmtPct(equipMods.staggerDamage)} />
            </div>

            {/* Miscellaneous */}
            <div>
              <h3 className="text-[10px] font-bold text-text-gold uppercase tracking-wider mb-1 border-b border-border-subtle pb-1">Miscellaneous</h3>
              <StatRowCompact label="Crit Chance" value={`${Math.round(charStats.critChance + equipMods.critChance)}%`}
                bonus={equipMods.critChance} bonusSuffix="%" />
              <StatRowCompact label="Crit Damage" value={`${Math.round(charStats.critDamage + equipMods.critDamage)}%`}
                bonus={equipMods.critDamage} bonusSuffix="%" />
              <StatRowCompact label="Lifesteal" value={fmtPct(equipMods.lifesteal)} />
              <StatRowCompact label="Armor Pen" value={fmtPct(equipMods.armorPenetration)} />
              <StatRowCompact label="Thorns" value={fmtPct(equipMods.thorns)} />
              <StatRowCompact label="Regain HP" value={fmtPct(equipMods.regainableHealth)} />
              <StatRowCompact label="Barrier" value={fmtPct(equipMods.barrierGain)} />
              <StatRowCompact label="Healing" value={fmtPct(equipMods.healing)} />
            </div>
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
            baseStats={(() => {
              const item = slots[configSlot];
              if (!item) return null;
              const cfg = slotConfigs[configSlot] || defaultItemConfig();
              const upgradeLevel = cfg.upgradeLevel || 1;

              // For weapons: compute stats dynamically from balance config (damage scales with upgrade level)
              if (item.weaponClass && balanceConfig) {
                const allItems = Object.values(itemPools).flat();
                const rawWeapon = allItems.find(w => w.id === item.id);
                const scrapedWs = weaponStatsDb[item.id];
                const scrapedStats = scrapedWs?.stats || {};
                const scrapedFallback = {
                  poiseDamage: scrapedStats.poiseDamage || 0,
                  staminaCost: scrapedStats.staminaCost || 0,
                };
                const computed = computeWeaponBaseStats(
                  item.weaponClass,
                  (rawWeapon as SlotItem)?.stats || {},
                  upgradeLevel,
                  balanceConfig,
                  scrapedFallback,
                );
                return computed;
              }

              // For armor/shields/trinkets: use scraped stats (no upgrade scaling)
              const ws = weaponStatsDb[item.id];
              if (ws?.stats) {
                return { ...ws.stats, critChance: ws.critChance || ws.stats.critChance || 0, critDamage: ws.critDamage || ws.stats.critDamage || 0 };
              }
              return null;
            })()}
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

/** Equipment row: icon label + square item slots + optional sub-slots (runes/gems) */
function EquipRow({
  icon,
  label,
  slots: slotDefs,
  subSlots,
  onSlotClick,
}: {
  icon: string;
  label: string;
  slots: { slot: EquipSlot; item: SlotItem | null; blocked: boolean }[];
  subSlots?: { key: string; item: { name: string; icon?: string } | null; onClick: () => void }[];
  onSlotClick: (slot: EquipSlot) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-lg w-7 text-center shrink-0" title={label}>{icon}</span>
      {slotDefs.map(({ slot, item, blocked }) => (
        <button
          key={slot}
          onClick={() => !blocked && onSlotClick(slot)}
          disabled={blocked}
          className={`w-11 h-11 rounded border flex items-center justify-center transition-colors shrink-0 ${
            blocked
              ? "bg-bg-primary/30 border-border-subtle/20 opacity-30 cursor-not-allowed"
              : item
                ? "bg-bg-secondary border-accent-gold/30 hover:border-accent-gold/60"
                : "bg-bg-primary/60 border-border-subtle/50 border-dashed hover:border-accent-gold/40"
          }`}
          title={item ? item.name : EQUIP_SLOT_LABELS[slot]}
        >
          {item ? (
            <ItemIcon icon={item.icon} size={32} />
          ) : (
            <span className="text-text-secondary/30 text-sm">+</span>
          )}
        </button>
      ))}
      {subSlots && subSlots.map((sub) => (
        <button
          key={sub.key}
          onClick={sub.onClick}
          className={`w-11 h-11 rounded border flex items-center justify-center transition-colors shrink-0 ${
            sub.item
              ? "bg-bg-secondary border-border-subtle/60 hover:border-accent-gold/40"
              : "bg-bg-primary/40 border-border-subtle/30 border-dashed hover:border-accent-gold/30"
          }`}
          title={sub.item ? sub.item.name : "Empty slot"}
        >
          {sub.item ? (
            <ItemIcon icon={sub.item.icon} size={24} />
          ) : (
            <span className="text-text-secondary/20 text-xs">+</span>
          )}
        </button>
      ))}
    </div>
  );
}

/** Compact stat row for the two-column stat panel */
function StatRowCompact({
  label,
  value,
  valueColor = "text-text-primary",
  bonus,
  bonusSuffix,
}: {
  label: string;
  value: string | number;
  valueColor?: string;
  bonus?: number;
  bonusSuffix?: string;
}) {
  const hasBonus = bonus !== undefined && bonus !== 0;
  return (
    <div className="flex justify-between py-0.5 text-xs leading-tight">
      <span className="text-text-secondary truncate mr-1">{label}</span>
      <span className={`font-medium whitespace-nowrap ${valueColor}`}>
        {value}
        {hasBonus && (
          <span className={`ml-0.5 text-[10px] ${bonus! > 0 ? "text-green-400" : "text-red-400"}`}>
            ({bonus! > 0 ? "+" : ""}{Math.round(bonus! * 10) / 10}{bonusSuffix || ""})
          </span>
        )}
      </span>
    </div>
  );
}

function fmtPct(value: number): string {
  if (value === 0) return "0%";
  const sign = value > 0 ? "+" : "";
  return `${sign}${Math.round(value * 10) / 10}%`;
}

function StatRow({
  label,
  value,
  valueColor = "text-text-primary",
  bonus,
  bonusSuffix,
}: {
  label: string;
  value: string | number;
  valueColor?: string;
  bonus?: number;
  bonusSuffix?: string;
}) {
  const hasBonus = bonus !== undefined && bonus !== 0;
  return (
    <div className="flex justify-between py-1 text-sm">
      <span className="text-text-secondary">{label}</span>
      <span className={`font-medium ${valueColor}`}>
        {value}
        {hasBonus && (
          <span className={`ml-1 text-xs ${bonus! > 0 ? "text-green-400" : "text-red-400"}`}>
            ({bonus! > 0 ? "+" : ""}{Math.round(bonus! * 10) / 10}{bonusSuffix || ""})
          </span>
        )}
      </span>
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
