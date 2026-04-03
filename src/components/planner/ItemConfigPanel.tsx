"use client";

import { useState, useMemo, useEffect } from "react";
import ItemIcon from "@/components/items/ItemIcon";
import { RARITY_TEXT } from "@/lib/constants";
import type { Rarity } from "@/lib/types";

// --- Types ---

interface ConfigItem {
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
}

interface RuneData {
  id: string;
  name: string;
  icon?: string;
  isUtility: boolean;
  compatibleClasses: number[];
}

interface GemData {
  id: string;
  name: string;
  icon?: string;
}

interface FacetEffect {
  stat: string;
  value: string;
  type: string;
  positive: boolean;
}

interface FacetData {
  name: string;
  slot: string;
  effects: FacetEffect[];
  // Legacy fields for old data format
  upside?: string;
  downside?: string;
}

interface EnchantData {
  rarity: string;
  slot: string;
  group: string;
  description: string;
}

export interface ItemConfig {
  runes: (RuneData | null)[];
  facet: string | null;
  gem: GemData | null;
  enchantments: (EnchantData | null)[];
  upgradeLevel: number;
}

// --- Helpers ---

function isWeaponSlot(slotKey: string, item: ConfigItem): boolean {
  if (slotKey === "weapon") return true;
  if (slotKey === "offhand" && item.weaponType && !item.shieldType) return true;
  return false;
}

function getItemSlotType(slotKey: string, item: ConfigItem): string {
  if (slotKey === "weapon" || (slotKey === "offhand" && item.weaponType)) {
    if (item.weaponType === "bow") return "bow";
    return "weapon";
  }
  if (slotKey === "offhand" && item.shieldType) return "shield";
  if (slotKey === "head") return "helmet";
  if (slotKey === "chest") return "armor";
  if (slotKey === "legs") return "pants";
  if (slotKey === "hands") return "gloves";
  if (slotKey.startsWith("ring")) return "ring";
  return "weapon";
}

const MAX_UPGRADE = 16;

// --- Component ---

interface ItemConfigPanelProps {
  item: ConfigItem;
  slotKey: string;
  slotLabel: string;
  config: ItemConfig;
  allRunes: RuneData[];
  allGems: GemData[];
  allFacets: FacetData[];
  allEnchantments: EnchantData[];
  onConfigChange: (config: ItemConfig) => void;
  onChangeItem: () => void;
  onRemoveItem: () => void;
  onClose: () => void;
}

export function defaultItemConfig(): ItemConfig {
  return {
    runes: [null, null, null, null],
    facet: null,
    gem: null,
    enchantments: [null, null, null, null, null],
    upgradeLevel: 1,
  };
}

export default function ItemConfigPanel({
  item,
  slotKey,
  slotLabel,
  config,
  allRunes,
  allGems,
  allFacets,
  allEnchantments,
  onConfigChange,
  onChangeItem,
  onRemoveItem,
  onClose,
}: ItemConfigPanelProps) {
  // Normalize config - guard against old saved configs missing new fields
  const safeConfig: ItemConfig = {
    runes: config.runes || [null, null, null, null],
    facet: config.facet || null,
    gem: config.gem || null,
    enchantments: config.enchantments || [null, null, null, null, null],
    upgradeLevel: config.upgradeLevel || 1,
  };

  const [activeRuneSlot, setActiveRuneSlot] = useState<number | null>(null);
  const [activeGemSlot, setActiveGemSlot] = useState(false);
  const [showFacetPicker, setShowFacetPicker] = useState(false);
  const [activeEnchantSlot, setActiveEnchantSlot] = useState<number | null>(null);
  const [runeSearch, setRuneSearch] = useState("");
  const [gemSearch, setGemSearch] = useState("");
  const [enchantSearch, setEnchantSearch] = useState("");

  const showWeaponRunes = isWeaponSlot(slotKey, item);
  const itemSlotType = getItemSlotType(slotKey, item);

  // Filter runes by weapon compatibility
  const compatibleRunes = useMemo(() => {
    if (!showWeaponRunes || !item.weaponClass) return [];
    return allRunes
      .filter((r) => !r.isUtility)
      .filter((r) => {
        if (!r.compatibleClasses || r.compatibleClasses.length === 0) return true;
        return r.compatibleClasses.includes(item.weaponClass!);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allRunes, item.weaponClass, showWeaponRunes]);

  // Filter facets by slot type with proper slot-specific logic
  const slotFacets = useMemo(() => {
    const isWeapon = itemSlotType === "weapon" || itemSlotType === "bow";
    if (isWeapon) return allFacets.filter((f) => f.slot === "weapon" || f.slot === "weapons");
    if (itemSlotType === "shield") return allFacets.filter((f) => f.slot === "shield");
    // Armor slots: get general armor facets + slot-specific
    // legs gets armor + "legs", gloves gets armor + "gloves"
    return allFacets.filter((f) => {
      if (f.slot === "armor") return true;
      if (f.slot === "legs" && itemSlotType === "pants") return true;
      if (f.slot === "gloves" && itemSlotType === "gloves") return true;
      return false;
    });
  }, [allFacets, itemSlotType]);

  // Filter enchantments by slot type
  const slotEnchantments = useMemo(() => {
    return allEnchantments.filter((e) => e.slot === itemSlotType);
  }, [allEnchantments, itemSlotType]);

  // Groups already used by selected enchantments
  const usedGroups = useMemo(() => {
    const groups = new Set<string>();
    safeConfig.enchantments.forEach((e) => {
      if (e?.group) groups.add(e.group);
    });
    return groups;
  }, [safeConfig.enchantments]);

  // Enchantments available for a specific slot (excluding used groups)
  const availableEnchantments = useMemo(() => {
    const slotIndex = activeEnchantSlot;
    if (slotIndex === null) return [];
    const currentEnchant = safeConfig.enchantments[slotIndex];
    const currentGroup = currentEnchant?.group;

    return slotEnchantments.filter((e) => {
      // Allow the currently selected group
      if (e.group === currentGroup) return true;
      // Block groups already used in other slots
      if (usedGroups.has(e.group)) return false;
      return true;
    });
  }, [slotEnchantments, usedGroups, activeEnchantSlot, safeConfig.enchantments]);

  const filteredRunes = runeSearch
    ? compatibleRunes.filter((r) => r.name.toLowerCase().includes(runeSearch.toLowerCase()))
    : compatibleRunes;

  const filteredGems = gemSearch
    ? allGems.filter((g) => g.name.toLowerCase().includes(gemSearch.toLowerCase()))
    : allGems;

  const filteredEnchants = enchantSearch
    ? availableEnchantments.filter((e) => e.description.toLowerCase().includes(enchantSearch.toLowerCase()))
    : availableEnchantments;

  const selectedFacet = slotFacets.find((f) => f.name.toLowerCase() === safeConfig.facet);

  // Count plagued (exalted) enchantments
  const exaltedCount = safeConfig.enchantments.filter((e) => e?.rarity === "plagued").length;

  function setRune(i: number, rune: RuneData | null) {
    const n = [...safeConfig.runes];
    n[i] = rune;
    onConfigChange({ ...safeConfig, runes: n });
    setActiveRuneSlot(null);
  }

  function setFacet(name: string | null) {
    onConfigChange({ ...safeConfig, facet: name });
    setShowFacetPicker(false);
  }

  function setGem(gem: GemData | null) {
    onConfigChange({ ...safeConfig, gem });
    setActiveGemSlot(false);
  }

  function setEnchantment(i: number, ench: EnchantData | null) {
    const n = [...safeConfig.enchantments];
    n[i] = ench;
    onConfigChange({ ...safeConfig, enchantments: n });
    setActiveEnchantSlot(null);
  }

  function setUpgradeLevel(level: number) {
    onConfigChange({ ...safeConfig, upgradeLevel: Math.max(1, Math.min(MAX_UPGRADE, level)) });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-bg-secondary border border-border-subtle rounded-lg w-full max-w-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-bg-secondary border-b border-border-subtle p-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-bold text-text-gold">{slotLabel}</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary text-xl p-1">&#x2715;</button>
        </div>

        <div className="p-4 space-y-5">
          {/* Selected Item */}
          <div className="flex items-center gap-3 p-3 bg-bg-card rounded-lg border border-border-subtle">
            <ItemIcon icon={item.icon} size={40} />
            <div className="flex-1 min-w-0">
              <span className="text-sm font-semibold text-text-primary truncate block">{item.name}</span>
              <span className={`text-xs font-semibold uppercase ${RARITY_TEXT[item.rarity || "common"]}`}>{item.rarity}</span>
            </div>
            <button onClick={onChangeItem} className="text-xs text-text-secondary hover:text-text-gold px-2 py-1 border border-border-subtle rounded">Swap</button>
            <button onClick={onRemoveItem} className="text-xs text-red-400/60 hover:text-red-400 px-2 py-1 border border-border-subtle rounded">Remove</button>
          </div>

          {/* Upgrade Level */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-gold uppercase font-bold">Upgrade Level</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setUpgradeLevel(safeConfig.upgradeLevel - 1)}
                className="w-6 h-6 rounded bg-bg-card text-text-secondary hover:text-text-primary text-xs flex items-center justify-center">-</button>
              <span className="w-8 text-center text-sm font-bold text-text-primary border border-border-subtle rounded px-1">{safeConfig.upgradeLevel}</span>
              <button onClick={() => setUpgradeLevel(safeConfig.upgradeLevel + 1)}
                className="w-6 h-6 rounded bg-bg-card text-text-secondary hover:text-text-primary text-xs flex items-center justify-center">+</button>
              <button onClick={() => setUpgradeLevel(MAX_UPGRADE)}
                className="text-xs text-text-secondary hover:text-text-gold px-2 py-0.5 border border-border-subtle rounded">Max</button>
            </div>
          </div>

          {/* Item Details */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            {item.weaponType && <DetailRow label="Type" value={item.weaponType} />}
            {item.handling && <DetailRow label="Handling" value={item.handling} />}
            {item.material && <DetailRow label="Material" value={item.material} />}
            {item.damageType && <DetailRow label="Damage Type" value={item.damageType} />}
            {item.dropLevel && <DetailRow label="Drop Level" value={String(item.dropLevel)} />}
          </div>

          {/* Runes - ONLY for weapons */}
          {showWeaponRunes && (
            <Section title={`Runes (Max: 4)`} subtitle={`${compatibleRunes.length} compatible`}>
              <div className="grid grid-cols-2 gap-2">
                {safeConfig.runes.map((rune, i) => (
                  <PickerSlot key={i} label="Add Rune" selected={rune ? rune.name : null} icon={rune?.icon}
                    isOpen={activeRuneSlot === i}
                    onOpen={() => { setActiveRuneSlot(i); setRuneSearch(""); }}
                    onClear={() => setRune(i, null)}
                    onClose={() => setActiveRuneSlot(null)}>
                    <input type="text" placeholder="Search runes..." value={runeSearch} onChange={(e) => setRuneSearch(e.target.value)} autoFocus
                      className="w-full px-2 py-1 bg-bg-primary border border-border-subtle rounded text-xs text-text-primary mb-1 focus:outline-none" />
                    {filteredRunes.map((r) => (
                      <button key={r.id} onClick={() => setRune(i, r)}
                        className="w-full text-left px-2 py-1 text-xs text-text-primary hover:bg-bg-card-hover rounded flex items-center gap-2">
                        <ItemIcon icon={r.icon} size={18} /><span className="truncate">{r.name}</span>
                      </button>
                    ))}
                  </PickerSlot>
                ))}
              </div>
            </Section>
          )}

          {/* Facet */}
          <Section title="Facet">
            {showFacetPicker ? (
              <div className="bg-bg-card rounded-lg border border-accent-gold/40 p-2 max-h-60 overflow-y-auto">
                <button onClick={() => setFacet(null)} className="w-full text-left px-2 py-1 text-xs text-text-secondary hover:bg-bg-card-hover rounded italic mb-1">None (clear)</button>
                {slotFacets.map((f) => (
                  <button key={f.name + f.slot} onClick={() => setFacet(f.name.toLowerCase())}
                    className={`w-full text-left px-3 py-2 hover:bg-bg-card-hover rounded transition-colors ${safeConfig.facet === f.name.toLowerCase() ? "bg-bg-card-hover" : ""}`}>
                    <span className="text-sm text-text-primary font-medium">{f.name}</span>
                    <div className="text-xs mt-0.5 space-y-0.5">
                      {f.effects ? f.effects.map((eff, i) => (
                        <div key={i}>
                          {eff.type === "Infusion" ? (
                            <span className="text-blue-400">[Infusion] {eff.stat}</span>
                          ) : eff.type === "Special" ? (
                            <span className={eff.positive ? "text-yellow-400" : "text-red-400"}>[Special] {eff.stat} {eff.value}</span>
                          ) : (
                            <span className={eff.positive ? "text-green-400" : "text-red-400"}>
                              [Stat] {eff.value} {eff.stat} ({eff.type})
                            </span>
                          )}
                        </div>
                      )) : (
                        <>
                          {f.upside && <span className="text-green-400">[Stat] {f.upside}</span>}
                          {f.downside && <span className="text-red-400 ml-2">[Stat] {f.downside}</span>}
                        </>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <button onClick={() => setShowFacetPicker(true)}
                className={`w-full text-left p-3 rounded-lg border text-sm transition-colors ${selectedFacet ? "bg-bg-card border-border-subtle hover:border-accent-gold/40" : "bg-bg-card/50 border-border-subtle border-dashed hover:border-accent-gold/40"}`}>
                {selectedFacet ? (
                  <div>
                    <span className="text-text-primary font-medium">{selectedFacet.name}</span>
                    <div className="text-xs mt-0.5 space-y-0.5">
                      {selectedFacet.effects ? selectedFacet.effects.map((eff, i) => (
                        <div key={i}>
                          {eff.type === "Infusion" ? (
                            <span className="text-blue-400">[Infusion] {eff.stat}</span>
                          ) : eff.type === "Special" ? (
                            <span className={eff.positive ? "text-yellow-400" : "text-red-400"}>[Special] {eff.stat} {eff.value}</span>
                          ) : (
                            <span className={eff.positive ? "text-green-400" : "text-red-400"}>
                              [Stat] {eff.value} {eff.stat} ({eff.type})
                            </span>
                          )}
                        </div>
                      )) : (
                        <>
                          {selectedFacet.upside && <div className="text-green-400">[Stat] {selectedFacet.upside}</div>}
                          {selectedFacet.downside && <div className="text-red-400">[Stat] {selectedFacet.downside}</div>}
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <span className="text-text-secondary/50">+ Add Facet</span>
                )}
              </button>
            )}
          </Section>

          {/* Gems */}
          <Section title="Gems (Max: 1)">
            {activeGemSlot ? (
              <div className="bg-bg-card rounded-lg border border-accent-gold/40 p-2 max-h-48 overflow-y-auto">
                <input type="text" placeholder="Search gems..." value={gemSearch} onChange={(e) => setGemSearch(e.target.value)} autoFocus
                  className="w-full px-2 py-1 bg-bg-primary border border-border-subtle rounded text-xs text-text-primary mb-1 focus:outline-none" />
                <button onClick={() => setGem(null)} className="w-full text-left px-2 py-1 text-xs text-text-secondary hover:bg-bg-card-hover rounded italic">Clear</button>
                {filteredGems.map((g) => (
                  <button key={g.id} onClick={() => setGem(g)}
                    className="w-full text-left px-2 py-1 text-xs text-text-primary hover:bg-bg-card-hover rounded flex items-center gap-2">
                    <ItemIcon icon={g.icon} size={18} /><span className="truncate">{g.name}</span>
                  </button>
                ))}
              </div>
            ) : (
              <button onClick={() => { setActiveGemSlot(true); setGemSearch(""); }}
                className={`w-full text-left p-3 rounded-lg border text-sm transition-colors ${safeConfig.gem ? "bg-bg-card border-border-subtle hover:border-accent-gold/40" : "bg-bg-card/50 border-border-subtle border-dashed hover:border-accent-gold/40"}`}>
                {safeConfig.gem ? (
                  <div className="flex items-center gap-2"><ItemIcon icon={safeConfig.gem.icon} size={20} /><span className="text-text-primary">{safeConfig.gem.name}</span></div>
                ) : (
                  <span className="text-text-secondary/50">+ Add Gem</span>
                )}
              </button>
            )}
          </Section>

          {/* Enchantments */}
          <Section title={`Enchantments (Max: 5)`} subtitle={`Exalted (${exaltedCount}/4)`}>
            <div className="space-y-2">
              {safeConfig.enchantments.map((ench, i) => (
                <div key={i}>
                  {activeEnchantSlot === i ? (
                    <div className="bg-bg-card rounded-lg border border-accent-gold/40 p-2 max-h-60 overflow-y-auto">
                      <input type="text" placeholder="Search enchantments..." value={enchantSearch} onChange={(e) => setEnchantSearch(e.target.value)} autoFocus
                        className="w-full px-2 py-1 bg-bg-primary border border-border-subtle rounded text-xs text-text-primary mb-1 focus:outline-none" />
                      <button onClick={() => setEnchantment(i, null)} className="w-full text-left px-2 py-1 text-xs text-text-secondary hover:bg-bg-card-hover rounded italic">Clear</button>
                      {filteredEnchants.map((e, j) => {
                        const isGroupBlocked = usedGroups.has(e.group) && safeConfig.enchantments[i]?.group !== e.group;
                        const isExaltedBlocked = e.rarity === "plagued" && exaltedCount >= 4 && safeConfig.enchantments[i]?.rarity !== "plagued";
                        const blocked = isGroupBlocked || isExaltedBlocked;
                        return (
                          <button key={j} onClick={() => !blocked && setEnchantment(i, e)} disabled={blocked}
                            className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${blocked ? "opacity-30 cursor-not-allowed" : "hover:bg-bg-card-hover"}`}>
                            <div className="flex items-center gap-2">
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${e.rarity === "plagued" ? "bg-rarity-exalted" : "bg-rarity-rare"}`} />
                              <span className="text-text-primary">{e.description}</span>
                            </div>
                            <span className="text-text-secondary/50 ml-4 text-[10px]">[{e.group}]</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <button onClick={() => { setActiveEnchantSlot(i); setEnchantSearch(""); }}
                      className={`w-full text-left p-2.5 rounded-lg border text-sm transition-colors ${ench ? "bg-bg-card border-border-subtle hover:border-accent-gold/40" : "bg-bg-card/50 border-border-subtle border-dashed hover:border-accent-gold/40"}`}>
                      {ench ? (
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${ench.rarity === "plagued" ? "bg-rarity-exalted" : "bg-rarity-rare"}`} />
                          <span className="text-xs text-text-primary">{ench.description}</span>
                          <span className="text-[10px] text-text-secondary/50 ml-auto shrink-0">[{ench.group}]</span>
                        </div>
                      ) : (
                        <span className="text-xs text-text-secondary/50">+ Add Enchantment</span>
                      )}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

// --- Sub-components ---

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-text-gold uppercase font-bold">{title}</span>
        {subtitle && <span className="text-xs text-text-secondary">{subtitle}</span>}
      </div>
      {children}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1 px-2 bg-bg-card rounded">
      <span className="text-text-secondary">{label}</span>
      <span className="text-text-primary capitalize">{value}</span>
    </div>
  );
}

function PickerSlot({ label, selected, icon, isOpen, onOpen, onClear, onClose, children }: {
  label: string; selected: string | null; icon?: string; isOpen: boolean;
  onOpen: () => void; onClear: () => void; onClose: () => void; children: React.ReactNode;
}) {
  if (isOpen) {
    return (
      <div className="bg-bg-card rounded-lg border border-accent-gold/40 p-2 max-h-48 overflow-y-auto">
        <button onClick={() => { onClear(); onClose(); }} className="w-full text-left px-2 py-1 text-xs text-text-secondary hover:bg-bg-card-hover rounded italic">Clear</button>
        {children}
      </div>
    );
  }
  return (
    <button onClick={onOpen}
      className={`w-full text-left p-2.5 rounded-lg border text-sm transition-colors ${selected ? "bg-bg-card border-border-subtle hover:border-accent-gold/40" : "bg-bg-card/50 border-border-subtle border-dashed hover:border-accent-gold/40"}`}>
      {selected ? (
        <div className="flex items-center gap-2">
          {icon && <ItemIcon icon={icon} size={20} />}
          <span className="text-xs text-text-primary truncate">{selected}</span>
        </div>
      ) : (
        <span className="text-xs text-text-secondary/50">+ {label}</span>
      )}
    </button>
  );
}
