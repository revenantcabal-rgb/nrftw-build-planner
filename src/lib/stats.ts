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
 * Compute weapon base stats at a given upgrade level.
 * Uses the weapon's baseAttributes and the balance config's scaling curves.
 */
export function computeWeaponBaseStats(
  baseAttributes: number,
  upgradeLevel: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  balanceConfig: any
): Record<string, number> {
  const stats: Record<string, number> = {};
  if (!balanceConfig?.weapon?.coreStatScaling) return stats;

  const WEAPON_STAT_NAMES: Record<string, string> = {
    "0": "damage",
    "1": "poiseDamage",
    "2": "staminaCost",
    "3": "critChance",
    "4": "focusGain",
    "5": "critDamage",
    "11": "weight",
  };

  const scaling = balanceConfig.weapon.coreStatScaling;

  Object.entries(scaling).forEach(([statIdx, config]: [string, unknown]) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cfg = config as any;
    const name = WEAPON_STAT_NAMES[statIdx];
    if (!name) return;

    let value = cfg.value * baseAttributes;

    // Apply growth from upgrade level
    if (cfg.percentageGrowthCurve?.keys?.length > 0) {
      const growthMult = interpolateCurve(cfg.percentageGrowthCurve, upgradeLevel);
      value *= (1 + growthMult);
    }

    // Apply fixed growth per level
    if (cfg.growth) {
      value += cfg.growth * (upgradeLevel - 1);
    }

    if (cfg.percentageStat) {
      stats[name] = Math.round(value * 100) / 100;
    } else {
      stats[name] = Math.round(value * 10) / 10;
    }
  });

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
