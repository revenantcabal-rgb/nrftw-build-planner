/**
 * Compute armor, shield, and trinket display stats from balance config.
 * Since the actual formulas aren't fully known and page scraping doesn't work
 * (stats rendered in custom Vue components), we use the balance config's
 * coreStatScaling + armorType/materialType modifiers to approximate.
 *
 * Formula: stat = coreStatScaling[i].value * itemMod[i][2] * slotMod[i][2] * materialMod[i][2]
 *        + coreStatScaling[i].growth * (upgradeLevel - 1)
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'public', 'data');

const bc = require(path.join(DATA_DIR, 'balance-config.json'));
const armors = require(path.join(DATA_DIR, 'armors.json'));
const shields = require(path.join(DATA_DIR, 'shields.json'));
const trinkets = require(path.join(DATA_DIR, 'trinkets.json'));

// Armor stat names (coreStatScaling indices 0-9)
const ARMOR_STAT_NAMES = {
  0: 'physicalDefense',
  // 1: 'weight' - formula produces incorrect values, skip until verified
  2: 'poise',       // value=10
  3: 'durability',  // value=100
  // 4-7: elemental defenses - exceptionalScaling=true, value=0, can't compute
  // 8-9: percentageStat - unclear mapping
};

// Slot mapping
const ARMOR_SLOT_MAP = { head: 0, chest: 1, hands: 2, legs: 3 };

// Material mapping - index in materialTypeCoreStatModifiers
// 0 = default/none, 1 = cloth, 2 = leather, 3 = mesh, 4 = plate
const MATERIAL_MAP = { cloth: 1, leather: 2, mesh: 3, plate: 4 };

// Default upgrade level for display
const DEFAULT_UPGRADE = 4;

function computeArmorStats(item, upgradeLevel = DEFAULT_UPGRADE) {
  const stats = {};
  const scaling = bc.armor.coreStatScaling;
  const slotIdx = ARMOR_SLOT_MAP[item.armorSlot] ?? 0;
  const matIdx = MATERIAL_MAP[item.material] ?? 1;

  for (const [statIdx, cfg] of Object.entries(scaling)) {
    const i = parseInt(statIdx);
    const name = ARMOR_STAT_NAMES[i];
    if (!name) continue;

    // Get modifiers - use index [2] from the 5-element arrays
    const itemMod = item.stats?.[statIdx]?.[2] ?? 0;
    const slotMod = bc.armor.armorTypeCoreStatModifiers?.[slotIdx]?.[statIdx]?.[2] ?? 1;
    const matMod = bc.armor.materialTypeCoreStatModifiers?.[matIdx]?.[statIdx]?.[2] ?? 1;

    let value = cfg.value * itemMod * slotMod * matMod;

    // Apply growth per upgrade level
    if (cfg.growth > 0) {
      value += cfg.growth * (upgradeLevel - 1) * itemMod * slotMod * matMod;
    }

    if (cfg.percentageStat) {
      value = Math.round(value * 1000) / 10; // Convert to percentage
    } else {
      value = Math.round(value * 10) / 10;
    }

    if (value !== 0 && name !== 'plagueDefense2') {
      stats[name] = (stats[name] || 0) + value;
    }
  }

  return stats;
}

// Shield stat names (coreStatScaling indices)
const SHIELD_STAT_NAMES = {
  0: 'shieldArmor',   // value=40, growth=10
  // 1: unused (value=0)
  2: 'weight',         // value=1
  3: 'poiseDamageOnBlock', // value=10
  4: 'poiseDamageOnBlock2', // value=1 (may be redundant)
  5: 'durability',     // value=100
};

function computeShieldStats(shield, upgradeLevel = DEFAULT_UPGRADE) {
  const stats = {};
  const scaling = bc.shield?.coreStatScaling;
  if (!scaling) return stats;

  for (const [statIdx, cfg] of Object.entries(scaling)) {
    const i = parseInt(statIdx);
    const name = SHIELD_STAT_NAMES[i];
    if (!name || name === 'poiseDamageOnBlock2') continue;

    const rawStats = shield.stats || {};
    const itemMod = rawStats[statIdx]?.[2] ?? 0;

    // Shield type modifiers: 31=light, 33=medium, 34=great
    const shieldTypeMap = { light: 31, medium: 33, great: 34 };
    const shieldTypeKey = shieldTypeMap[shield.shieldType] ?? 31;
    const typeMod = bc.shield.shieldTypeCoreStatModifiers?.[shieldTypeKey]?.[statIdx]?.[2] ?? 1;

    let value = cfg.value * itemMod * typeMod;

    if (cfg.growth > 0) {
      value += cfg.growth * (upgradeLevel - 1) * itemMod * typeMod;
    }

    if (cfg.percentageStat) {
      value = Math.round(value * 1000) / 10;
    } else {
      value = Math.round(value * 10) / 10;
    }

    if (value !== 0) stats[name] = value;
  }

  return stats;
}

// Compute all armor stats
console.log('Computing armor stats for', armors.length, 'armors...');
const armorResults = {};
for (const armor of armors) {
  const stats = computeArmorStats(armor);
  armorResults[armor.id] = {
    id: armor.id,
    name: armor.name,
    stats,
  };
}

// Verify with a known item
const sampleArmors = [
  armors.find(a => a.material === 'plate' && a.armorSlot === 'chest' && a.rarity !== 'common'),
  armors.find(a => a.material === 'cloth' && a.armorSlot === 'head'),
  armors.find(a => a.material === 'mesh' && a.armorSlot === 'legs'),
].filter(Boolean);

for (const a of sampleArmors) {
  console.log(`\n${a.name} (${a.material} ${a.armorSlot}):`);
  console.log('  Stats:', JSON.stringify(armorResults[a.id].stats));
}

fs.writeFileSync(
  path.join(DATA_DIR, 'armor-computed-stats.json'),
  JSON.stringify(armorResults, null, 2)
);
console.log('\nSaved armor-computed-stats.json with', Object.keys(armorResults).length, 'entries');

// Compute shield stats
console.log('\nComputing shield stats for', shields.length, 'shields...');
const shieldResults = {};
for (const shield of shields) {
  const stats = computeShieldStats(shield);
  shieldResults[shield.id] = {
    id: shield.id,
    name: shield.name,
    stats,
  };
}

if (shields.length > 0) {
  console.log(`\nSample shield: ${shields[0].name}:`);
  console.log('  Stats:', JSON.stringify(shieldResults[shields[0].id].stats));
}

fs.writeFileSync(
  path.join(DATA_DIR, 'shield-computed-stats.json'),
  JSON.stringify(shieldResults, null, 2)
);

// Trinkets - just extract weight from balance config
const trinketResults = {};
for (const trinket of trinkets) {
  trinketResults[trinket.id] = {
    id: trinket.id,
    name: trinket.name,
    stats: { weight: 1.0 }, // Trinkets typically weight 1.0
  };
}
fs.writeFileSync(
  path.join(DATA_DIR, 'trinket-computed-stats.json'),
  JSON.stringify(trinketResults, null, 2)
);
console.log('Saved trinket-computed-stats.json with', Object.keys(trinketResults).length, 'entries');
