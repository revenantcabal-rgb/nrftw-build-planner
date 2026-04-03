// Stat computation engine using balance-config.json formulas
// Interpolates values from game curves

type CurveKey = [number, number];

interface Curve {
  keys: CurveKey[];
}

/**
 * Interpolate a value from a game curve.
 * Curves are arrays of [x, y] pairs. Values between points are linearly interpolated.
 */
export function interpolateCurve(curve: Curve | undefined, x: number): number {
  if (!curve || !curve.keys || curve.keys.length === 0) return 0;

  const keys = curve.keys;

  // Before first point
  if (x <= keys[0][0]) return keys[0][1];
  // After last point
  if (x >= keys[keys.length - 1][0]) return keys[keys.length - 1][1];

  // Find surrounding points and interpolate
  for (let i = 0; i < keys.length - 1; i++) {
    const [x0, y0] = keys[i];
    const [x1, y1] = keys[i + 1];
    if (x >= x0 && x <= x1) {
      const t = (x - x0) / (x1 - x0);
      return y0 + t * (y1 - y0);
    }
  }

  return keys[keys.length - 1][1];
}

/**
 * Compute character stats from attributes using balance config.
 */
export function computeCharacterStats(
  attrs: Record<string, number>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  balanceConfig: any
): Record<string, number> {
  const stats: Record<string, number> = {};

  if (!balanceConfig?.attributeScaling?.scaling) return stats;

  // Map our attribute keys to game attributeType indices
  const ATTR_MAP: Record<string, number> = {
    health: 0,
    stamina: 1,
    // strength: 2, dexterity: 3, intelligence: 4, faith: 5 - these affect weapon damage scaling
    focus: 6,
    equipLoad: 7,
  };

  // Compute stats from attribute scaling curves
  balanceConfig.attributeScaling.scaling.forEach(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (s: any) => {
      const attrType = s.attributeType;
      const statType = s.statType;
      const attrKey = Object.entries(ATTR_MAP).find(([, v]) => v === attrType)?.[0];
      if (attrKey && attrs[attrKey] !== undefined) {
        const value = interpolateCurve(s.curve, attrs[attrKey]);
        stats[`stat_${statType}`] = Math.round(value * 10) / 10;
      }
    }
  );

  // Add base hero stats
  if (balanceConfig.heroStats?.baseStatList) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    balanceConfig.heroStats.baseStatList.forEach((bs: any) => {
      const key = `base_stat_${bs.statType}`;
      stats[key] = bs.baseValue;
    });
  }

  // Named stats for display
  stats.health = stats.stat_0 || 100;
  stats.stamina = stats.stat_1 || 50;
  stats.focus = stats.stat_6 || 100;
  stats.equipLoad = stats.stat_2 || 100;
  stats.staminaRegen = stats.base_stat_41 || 35;
  stats.critChance = stats.base_stat_15 || 10;
  stats.critDamage = (stats.base_stat_101 || 0.25) * 100; // Convert to percentage

  return stats;
}

/**
 * Weapon class -> coreStatModifiers index mapping.
 * Maps game weaponClass IDs to the index used in balance config's weapon.coreStatModifiers.
 */
const WEAPON_CLASS_MAP: Record<number, number> = {
  1:5, 2:19, 3:20, 4:18, 5:11, 6:17, 7:8, 8:7, 9:16, 10:15,
  12:28, 13:25, 14:29, 15:24, 16:27, 17:30, 18:22, 19:6, 21:26,
  22:9, 23:12, 24:14, 25:13, 26:33,
};

/**
 * Stat index -> display name mapping for weapons.
 * Verified indices: 0=damage, 3=focusGain, 4=weight, 5=durability, 11=critChance, 12=critDamage.
 * Indices 2 (poise) and stamina cost don't match the formula - use scraped values for those.
 */
const WEAPON_COMPUTED_STATS: Record<number, string> = {
  0: "damage",       // Physical Damage (scales with upgrade level)
  3: "focusGain",    // Focus Gain On Hit
  4: "weight",       // Equipped Weight
  5: "durability",   // Durability
  11: "critChance",  // Critical Damage Chance (percentage)
  12: "critDamage",  // Critical Damage (percentage)
};

/**
 * Compute weapon base stats at a given upgrade level.
 *
 * Formula: stat = coreStatScaling[i].value * itemMod[i][2] * classTypeMod[i][2]
 * Damage growth: damage += coreStatScaling[0].value * itemMod[0][2] * (upgradeLevel - 1)
 *
 * Stats where the formula is verified: damage, focusGain, weight, durability, critChance, critDamage.
 * Poise damage and stamina cost use fallback scraped values (formula unknown).
 *
 * @param weaponClass - the weapon's class ID (e.g. 3 for great_club)
 * @param itemStats - the weapon's itemCoreStatsModifiers (5-element arrays keyed by stat index)
 * @param upgradeLevel - the current upgrade level (1-16)
 * @param balanceConfig - the full balance config
 * @param scrapedFallback - optional scraped stats to fill in poise damage and stamina cost
 */
export function computeWeaponBaseStats(
  weaponClass: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  itemStats: Record<string, number[]>,
  upgradeLevel: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  balanceConfig: any,
  scrapedFallback?: Record<string, number>,
): Record<string, number> {
  const stats: Record<string, number> = {};
  if (!balanceConfig?.weapon?.coreStatScaling) return scrapedFallback || stats;

  const scaling = balanceConfig.weapon.coreStatScaling;
  const classModIdx = WEAPON_CLASS_MAP[weaponClass];
  const classMods = classModIdx !== undefined
    ? balanceConfig.weapon.coreStatModifiers?.[classModIdx]
    : null;

  for (const [statIdxStr, cfg] of Object.entries(scaling) as [string, { value: number; growth: number; percentageStat?: boolean }][]) {
    const statIdx = parseInt(statIdxStr);
    const name = WEAPON_COMPUTED_STATS[statIdx];
    if (!name) continue;

    const itemMod = itemStats?.[statIdxStr]?.[2] ?? 0;
    const classBase = classMods?.[statIdxStr]?.[2] ?? 1;

    // Base value at level 1
    let value = cfg.value * itemMod * classBase;

    // Damage (stat 0) scales with upgrade level
    if (statIdx === 0 && upgradeLevel > 1) {
      value += cfg.value * itemMod * (upgradeLevel - 1);
    }

    // Format: percentage stats display differently
    if (statIdx === 11) {
      // critChance: raw ~0.1 → display as 10%
      value = Math.round(value * 1000) / 10;
    } else if (statIdx === 12) {
      // critDamage: raw 1 → display as 100%
      value = Math.round(value * 100);
    } else {
      value = Math.round(value * 10) / 10;
    }

    if (value !== 0) {
      stats[name] = value;
    }
  }

  // Fill in poise damage and stamina cost from scraped fallback (formula unknown)
  if (scrapedFallback) {
    if (scrapedFallback.poiseDamage && !stats.poiseDamage) {
      stats.poiseDamage = scrapedFallback.poiseDamage;
    }
    if (scrapedFallback.staminaCost && !stats.staminaCost) {
      stats.staminaCost = scrapedFallback.staminaCost;
    }
  }

  return stats;
}

/**
 * Weight class based on equipped weight vs equip load capacity.
 */
export function getWeightClass(
  equippedWeight: number,
  equipLoadCapacity: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  balanceConfig: any
): { name: string; ratio: number; staminaRecoveryMult: number } {
  if (equipLoadCapacity <= 0) return { name: "Overloaded", ratio: 1, staminaRecoveryMult: 0.6 };

  const ratio = equippedWeight / equipLoadCapacity;
  const weightClasses = balanceConfig?.equipment?.weightClassBalance;

  if (!weightClasses) {
    if (ratio < 0.35) return { name: "Light", ratio, staminaRecoveryMult: 1.2 };
    if (ratio < 0.6) return { name: "Medium", ratio, staminaRecoveryMult: 1.0 };
    if (ratio < 1.0) return { name: "Heavy", ratio, staminaRecoveryMult: 0.8 };
    return { name: "Overloaded", ratio, staminaRecoveryMult: 0.6 };
  }

  // Use actual weight class definitions from balance config
  const classes = Object.values(weightClasses) as { loadRatioThreshold: number; staminaRecoveryMultiplier: number }[];
  const names = ["Light", "Medium", "Heavy", "Overloaded"];

  for (let i = 0; i < classes.length; i++) {
    if (ratio < classes[i].loadRatioThreshold) {
      return {
        name: names[i] || "Unknown",
        ratio,
        staminaRecoveryMult: classes[i].staminaRecoveryMultiplier,
      };
    }
  }

  return { name: "Overloaded", ratio, staminaRecoveryMult: 0.6 };
}
