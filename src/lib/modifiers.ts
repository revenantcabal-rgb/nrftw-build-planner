/**
 * Modifier aggregation system.
 * Parses enchantment descriptions, facet effects, and gem effects
 * to produce a unified set of stat modifiers for the stat panel.
 */

// All stats tracked by the stat panel
export interface StatModifiers {
  // General
  maxHealth: number;       // flat or %
  maxStamina: number;
  maxFocus: number;
  staminaRecovery: number; // %
  focusGain: number;       // %

  // Defense
  physicalResistance: number;
  fireResistance: number;
  iceResistance: number;
  lightningResistance: number;
  plagueResistance: number;
  elementalResistance: number; // applies to all elemental
  damageResistance: number;
  poise: number;
  staggerResistance: number;

  // Weight
  equipLoad: number;       // %
  equippedWeight: number;  // absolute from items

  // Damage
  damage: number;          // general %
  attackDamage: number;    // %
  physicalDamage: number;
  fireDamage: number;
  iceDamage: number;
  lightningDamage: number;
  plagueDamage: number;
  runeDamage: number;
  staggerDamage: number;

  // Speed
  overallSpeed: number;    // %
  movementSpeed: number;
  attackSpeed: number;

  // Misc
  critChance: number;      // added %
  critDamage: number;      // added %
  lifesteal: number;
  armorPenetration: number;
  thorns: number;
  regainableHealth: number;
  barrierGain: number;
  healing: number;
}

export function emptyModifiers(): StatModifiers {
  return {
    maxHealth: 0, maxStamina: 0, maxFocus: 0, staminaRecovery: 0, focusGain: 0,
    physicalResistance: 0, fireResistance: 0, iceResistance: 0, lightningResistance: 0,
    plagueResistance: 0, elementalResistance: 0, damageResistance: 0, poise: 0, staggerResistance: 0,
    equipLoad: 0, equippedWeight: 0,
    damage: 0, attackDamage: 0, physicalDamage: 0, fireDamage: 0, iceDamage: 0,
    lightningDamage: 0, plagueDamage: 0, runeDamage: 0, staggerDamage: 0,
    overallSpeed: 0, movementSpeed: 0, attackSpeed: 0,
    critChance: 0, critDamage: 0, lifesteal: 0, armorPenetration: 0,
    thorns: 0, regainableHealth: 0, barrierGain: 0, healing: 0,
  };
}

// Map enchantment stat names to our modifier keys
const ENCHANT_STAT_MAP: Record<string, keyof StatModifiers> = {
  "max health": "maxHealth",
  "max stamina": "maxStamina",
  "max focus": "maxFocus",
  "stamina recovery": "staminaRecovery",
  "focus gain": "focusGain",
  "physical resistance": "physicalResistance",
  "fire resistance": "fireResistance", // mapped from Fire Damage for armor enchants that say "Fire Resistance"
  "ice resistance": "iceResistance",
  "lightning resistance": "lightningResistance",
  "plague resistance": "plagueResistance",
  "elemental resistance": "elementalResistance",
  "damage resistance": "damageResistance",
  "poise defense": "poise",
  "stagger resistance": "staggerResistance",
  "equip load": "equipLoad",
  "weight": "equippedWeight",
  "damage": "damage",
  "attack damage": "attackDamage",
  "physical damage": "physicalDamage",
  "fire damage": "fireDamage",
  "ice damage": "iceDamage",
  "lightning damage": "lightningDamage",
  "plague damage": "plagueDamage",
  "rune damage": "runeDamage",
  "stagger damage": "staggerDamage",
  "overall speed": "overallSpeed",
  "movement speed": "movementSpeed",
  "attack speed": "attackSpeed",
  "critical hit chance": "critChance",
  "critical damage chance": "critChance",
  "critical damage": "critDamage",
  "lifesteal": "lifesteal",
  "armor penetration": "armorPenetration",
  "thorns": "thorns",
  "regainable health": "regainableHealth",
  "barrier gain": "barrierGain",
  "healing": "healing",
};

// Map facet stat names to our modifier keys
const FACET_STAT_MAP: Record<string, keyof StatModifiers> = {
  "Attack Speed": "attackSpeed",
  "Damage": "damage",
  "Stamina Cost": "staminaRecovery", // "Stamina Cost" on weapons ≈ general; but in stat panel it shows as stamina-related
  "Focus Gain": "focusGain",
  "Focus Gain On Hit": "focusGain",
  "Critical Damage Chance": "critChance",
  "Critical Damage": "critDamage",
  "Poise Damage": "staggerDamage",
  "Attack Stamina Cost": "staminaRecovery", // negative = good for stamina
  "Durability": "maxHealth", // not really, but we don't track durability in stat panel
  "Physical Resistance": "physicalResistance",
  "Fire Resistance": "fireResistance",
  "Ice Resistance": "iceResistance",
  "Lightning Resistance": "lightningResistance",
  "Plague Resistance": "plagueResistance",
  "Poise Defense": "poise",
  "Movement Speed": "movementSpeed",
  "Overall Speed": "overallSpeed",
  "Equip Load": "equipLoad",
  "Weight": "equippedWeight",
};

/**
 * Parse an enchantment description to extract the range of values.
 * Returns { stat, min, max, isPercent, isConditional }.
 * isConditional = true for things like "for 10 seconds after Parry".
 */
export function parseEnchantmentRange(description: string): {
  stat: string;
  min: number;
  max: number;
  isPercent: boolean;
  isConditional: boolean;
  isReduction: boolean;
} | null {
  // Pattern: "StatName increased/reduced by X%-Y%"
  const m = description.match(
    /^(.+?)\s+(increased|reduced|decreased)\s+by\s+(\d+\.?\d*)(%?)\s*-?\s*(\d+\.?\d*)?(%?)/i
  );
  if (m) {
    const statName = m[1].trim();
    const isReduction = m[2].toLowerCase() !== "increased";
    const min = parseFloat(m[3]);
    const max = m[5] ? parseFloat(m[5]) : min;
    const isPercent = m[4] === "%" || m[6] === "%";
    // Check if conditional (has "for X seconds" or "after" or "on" etc.)
    const isConditional = /\b(for \d+ seconds|after|on |against |while |if |during )/i.test(description);
    return { stat: statName, min, max, isPercent, isConditional, isReduction };
  }

  // Pattern: "Gain X%-Y% StatName on Event"
  const m2 = description.match(
    /^Gain\s+(\d+\.?\d*)(%?)\s*-?\s*(\d+\.?\d*)?(%?)\s+(.+)/i
  );
  if (m2) {
    const min = parseFloat(m2[1]);
    const max = m2[3] ? parseFloat(m2[3]) : min;
    const isPercent = m2[2] === "%" || m2[4] === "%";
    const rest = m2[5].trim();
    // These are conditional
    return { stat: rest, min, max, isPercent, isConditional: true, isReduction: false };
  }

  return null;
}

/**
 * Get the modifier key for an enchantment stat name.
 */
export function getEnchantModifierKey(statName: string): keyof StatModifiers | null {
  const lower = statName.toLowerCase().trim();
  return ENCHANT_STAT_MAP[lower] || null;
}

interface EnchantData {
  rarity: string;
  slot: string;
  group: string;
  description: string;
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
}

interface ItemConfig {
  runes: unknown[];
  facet: string | null;
  gem: { id: string; name: string; effects?: string[] } | null;
  enchantments: (EnchantData | null)[];
  enchantmentValues?: (number | null)[];
  upgradeLevel: number;
}

interface WeaponStats {
  damage: number;
  poiseDamage: number;
  staminaCost: number;
  focusGain: number;
  durability?: number;
  weight?: number;
  critChance?: number;
  critDamage?: number;
}

interface SlotItem {
  id: string;
  name: string;
  weaponType?: string;
  shieldType?: string;
  handling?: string;
  armorSlot?: string;
}

/**
 * Collect all stat modifiers from all equipped items and their configs.
 */
export function collectAllModifiers(
  slots: Record<string, SlotItem | null>,
  slotConfigs: Record<string, ItemConfig>,
  facetList: FacetData[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  weaponStatsDb: Record<string, any>,
): StatModifiers {
  const mods = emptyModifiers();

  const slotOrder = ["weapon", "offhand", "head", "chest", "hands", "legs", "ring1", "ring2", "ring3"];

  for (const slotKey of slotOrder) {
    const item = slots[slotKey];
    if (!item) continue;
    const config = slotConfigs[slotKey];
    if (!config) {
      // Still add weight and defense from base stats even without config
      const ws = weaponStatsDb[item.id];
      if (ws?.stats) {
        if (ws.stats.weight) mods.equippedWeight += ws.stats.weight;
        if (ws.stats.physicalDefense) mods.physicalResistance += ws.stats.physicalDefense;
        if (ws.stats.fireDefense) mods.fireResistance += ws.stats.fireDefense;
        if (ws.stats.iceDefense) mods.iceResistance += ws.stats.iceDefense;
        if (ws.stats.lightningDefense) mods.lightningResistance += ws.stats.lightningDefense;
        if (ws.stats.plagueDefense) mods.plagueResistance += ws.stats.plagueDefense;
        if (ws.stats.poise) mods.poise += ws.stats.poise;
      }
      continue;
    }

    // 1. Add item base stats (weight + armor defenses)
    const ws = weaponStatsDb[item.id];
    if (ws?.stats) {
      if (ws.stats.weight) mods.equippedWeight += ws.stats.weight;
      // Armor defense values are flat additions
      if (ws.stats.physicalDefense) mods.physicalResistance += ws.stats.physicalDefense;
      if (ws.stats.fireDefense) mods.fireResistance += ws.stats.fireDefense;
      if (ws.stats.iceDefense) mods.iceResistance += ws.stats.iceDefense;
      if (ws.stats.lightningDefense) mods.lightningResistance += ws.stats.lightningDefense;
      if (ws.stats.plagueDefense) mods.plagueResistance += ws.stats.plagueDefense;
      if (ws.stats.poise) mods.poise += ws.stats.poise;
    }

    // 2. Apply facet effects
    if (config.facet) {
      const facet = facetList.find(f => f.name.toLowerCase() === config.facet);
      if (facet?.effects) {
        for (const eff of facet.effects) {
          if (eff.type === "Infusion" || eff.type === "Special") continue; // Skip non-numeric effects
          const modKey = FACET_STAT_MAP[eff.stat];
          if (!modKey) continue;
          // Parse value like "+10%", "-20%", "+75"
          const valMatch = eff.value.match(/^([+-])(\d+\.?\d*)(%?)$/);
          if (!valMatch) continue;
          const sign = valMatch[1] === "-" ? -1 : 1;
          const num = parseFloat(valMatch[2]);
          mods[modKey] += sign * num;
        }
      }
    }

    // 3. Apply enchantment effects
    if (config.enchantments) {
      config.enchantments.forEach((ench, i) => {
        if (!ench) return;
        const parsed = parseEnchantmentRange(ench.description);
        if (!parsed) return;
        // Skip conditional enchantments - they only apply in specific game situations
        if (parsed.isConditional) return;
        const modKey = getEnchantModifierKey(parsed.stat);
        if (!modKey) return;
        // Use user-set value if available, otherwise use max of range
        const userValue = config.enchantmentValues?.[i];
        const value = userValue ?? parsed.max;
        const sign = parsed.isReduction ? -1 : 1;
        mods[modKey] += sign * value;
      });
    }

    // 4. Apply gem effects (basic parsing)
    if (config.gem?.effects) {
      for (const effect of config.gem.effects) {
        parseGemEffect(effect, mods);
      }
    }
  }

  return mods;
}

/**
 * Parse a gem effect string and apply it to modifiers.
 * Gem effects are free-text like "Critical Hit Chance increased by 5%"
 */
function parseGemEffect(effect: string, mods: StatModifiers): void {
  const parsed = parseEnchantmentRange(effect);
  if (!parsed) return;
  if (parsed.isConditional) return;
  const modKey = getEnchantModifierKey(parsed.stat);
  if (!modKey) return;
  const sign = parsed.isReduction ? -1 : 1;
  mods[modKey] += sign * parsed.max;
}
