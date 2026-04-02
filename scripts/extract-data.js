const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'public', 'data');
const BASE_URL = 'https://www.norestforthewicked.gg/db/weapons';

async function main() {
  console.log('Starting data extraction...');
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('Navigating to', BASE_URL);
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 60000 });

  // Wait for the Pinia store to be populated
  console.log('Waiting for data store...');
  await page.waitForFunction(() => {
    try {
      const app = document.querySelector('#__nuxt').__vue_app__;
      const pinia = app.config.globalProperties.$pinia;
      const db = pinia._s.get('db_data')._internal.database;
      return Object.keys(db.weapons).length > 0;
    } catch { return false; }
  }, { timeout: 30000 });

  console.log('Store ready. Extracting data...');

  // Extract all data in the browser context
  const allData = await page.evaluate(() => {
    const app = document.querySelector('#__nuxt').__vue_app__;
    const pinia = app.config.globalProperties.$pinia;
    const db = pinia._s.get('db_data')._internal.database;
    const tolgee = app.config.globalProperties.$tolgee;
    const records = tolgee.getAllRecords();
    const gameRecord = records.find(r => r.namespace === 'version4');
    const translations = gameRecord.data;

    const t = (key) => {
      if (!key) return '';
      if (typeof key !== 'string') return String(key);
      if (key.startsWith('l') && /^l\d+$/.test(key)) return translations[key] || key;
      return key;
    };

    const WEAPON_TYPES = {
      5:'straight_sword',6:'wakizashi',7:'curved_sword',8:'knife',9:'rapier',
      11:'great_sword',12:'curved_great_sword',13:'axe',14:'great_axe',
      15:'scythe',16:'double_dagger',17:'spear',18:'halberd',19:'club',
      20:'great_club',22:'hammer',24:'great_hammer',25:'mace',26:'bow',
      27:'gauntlet',28:'staff',29:'wand',30:'light',33:'unarmed'
    };
    const HAND_TYPES = {1:'one-handed',2:'two-handed',4:'dual-wielding',5:'two-handed'};
    const RARITY = {0:'common',1:'uncommon',2:'rare',3:'epic',4:'exalted'};
    const DAMAGE_SCHOOLS = {0:'physical',1:'fire',2:'ice',3:'lightning',4:'holy',5:'plague',9:'physical',10:'mixed'};
    const ARMOR_SLOTS = {1:'head',2:'chest',3:'legs',4:'hands'};
    const ARMOR_MATERIALS = {1:'cloth',2:'leather',3:'mesh',4:'plate'};
    const SHIELD_TYPES = {31:'light',33:'medium',34:'great'};

    // Weapons
    const weapons = Object.entries(db.weapons).map(([id, w]) => {
      const d = w.data;
      return {
        id: d.identifier, name: t(w.name), description: t(w.description), icon: w.icon,
        weaponType: WEAPON_TYPES[d.itemType.weaponType] || 'unknown',
        handling: HAND_TYPES[d.handType] || 'unknown',
        rarity: d.uniqueItemConfig ? RARITY[d.uniqueItemConfig.rarity] || 'common' : 'common',
        isUnique: !!d.uniqueItemConfig, dropLevel: d.dropLevel, sellValue: d.baseItemValue,
        damageType: DAMAGE_SCHOOLS[d.damageSchool] || 'physical',
        baseAttributes: d.baseAttributes,
        enchantmentIds: d.uniqueItemConfig?.enchantments || [],
        stats: d.itemCoreStatsModifiers || {}
      };
    });

    // Armor
    const armors = Object.entries(db.armors).map(([id, a]) => {
      const d = a.data;
      return {
        id: d.identifier, name: t(a.name), description: t(a.description), icon: a.icon,
        armorSlot: ARMOR_SLOTS[d.itemType?.armorType] || 'unknown',
        material: ARMOR_MATERIALS[d.itemType?.materialType] || 'unknown',
        rarity: d.uniqueItemConfig ? RARITY[d.uniqueItemConfig.rarity] || 'common' : 'common',
        isUnique: !!d.uniqueItemConfig, dropLevel: d.dropLevel, sellValue: d.baseItemValue,
        baseAttributes: d.baseAttributes,
        enchantmentIds: d.uniqueItemConfig?.enchantments || [],
        stats: d.itemCoreStatsModifiers || {}
      };
    });

    // Shields
    const shields = Object.entries(db.shields).map(([id, s]) => {
      const d = s.data;
      return {
        id: d.identifier, name: t(s.name), description: t(s.description), icon: s.icon,
        shieldType: SHIELD_TYPES[d.itemType?.shieldType] || 'unknown',
        rarity: d.uniqueItemConfig ? RARITY[d.uniqueItemConfig.rarity] || 'common' : 'common',
        isUnique: !!d.uniqueItemConfig, dropLevel: d.dropLevel, sellValue: d.baseItemValue,
        baseAttributes: d.baseAttributes,
        enchantmentIds: d.uniqueItemConfig?.enchantments || [],
        stats: d.itemCoreStatsModifiers || {}
      };
    });

    // Trinkets
    const trinkets = Object.entries(db.trinkets).map(([id, tr]) => {
      const d = tr.data;
      return {
        id: d.identifier, name: t(tr.name), description: t(tr.description), icon: tr.icon,
        rarity: d.uniqueItemConfig ? RARITY[d.uniqueItemConfig.rarity] || 'common' : 'common',
        isUnique: !!d.uniqueItemConfig, dropLevel: d.dropLevel, sellValue: d.baseItemValue,
        enchantmentIds: d.uniqueItemConfig?.enchantments || []
      };
    });

    // Enchantments
    const enchantments = Object.entries(db.enchants).map(([id, e]) => ({
      id, name: t(e.name), description: t(e.description), icon: e.icon, data: e.data
    }));

    // Runes
    const runes = Object.entries(db.runes).map(([id, r]) => ({
      id, name: t(r.name), description: t(r.description), icon: r.icon, data: r.data
    }));

    // Gems
    const gems = Object.entries(db.gems).map(([id, g]) => ({
      id, name: t(g.name), description: t(g.description), icon: g.icon, data: g.data
    }));

    // Food
    const food = Object.entries(db.food).map(([id, f]) => ({
      id, name: t(f.name), description: t(f.description), icon: f.icon, data: f.data
    }));

    // Armor Sets
    const armorSets = Object.entries(db.armorSets).map(([id, s]) => ({
      id, name: t(s.name), description: t(s.description), data: s.data
    }));

    return { weapons, armors, shields, trinkets, enchantments, runes, gems, food, armorSets, translations };
  });

  // Save each category
  const categories = [
    'weapons', 'armors', 'shields', 'trinkets',
    'enchantments', 'runes', 'gems', 'food', 'armorSets', 'translations'
  ];

  for (const cat of categories) {
    const filepath = path.join(DATA_DIR, cat + '.json');
    const json = JSON.stringify(allData[cat], null, 2);
    fs.writeFileSync(filepath, json);
    const count = Array.isArray(allData[cat]) ? allData[cat].length : Object.keys(allData[cat]).length;
    console.log(`  ${cat}: ${count} items (${(json.length/1024).toFixed(1)} KB)`);
  }

  await browser.close();
  console.log('\nDone! Data saved to', DATA_DIR);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
