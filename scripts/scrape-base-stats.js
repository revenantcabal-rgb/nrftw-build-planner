const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'public', 'data');

async function main() {
  console.log('Scraping base stats from reference planner...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Go to planner page and wait for it to load
  await page.goto('https://www.norestforthewicked.gg/planner', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(5000);

  // Extract base stats for ALL weapons at upgrade level 1 and 16
  // The planner page computes stats when you select a weapon and set upgrade level
  // We can do this by calling the site's internal functions directly

  const stats = await page.evaluate(() => {
    const app = document.querySelector('#__nuxt').__vue_app__;
    const pinia = app.config.globalProperties.$pinia;
    const db = pinia._s.get('db_data')._internal.database;
    const t = app.config.globalProperties.$tolgee.getAllRecords().find(r => r.namespace === 'version4').data;
    const tr = (k) => (t[k] || k).replace(/''/g, "'");

    // Get balance config for stat computation
    const store = pinia._s.get('db_data');

    // Weapon stat indices from the game data
    // itemCoreStatsModifiers keys:
    // 0=PhysDmg, 1=FireDmg, 2=IceDmg, 3=LightDmg, 4=HolyDmg, 5=PlagueDmg
    // 6=PhysDef, 7=FireDef, 8=IceDef, 9=LightDef, 10=HolyDef, 11=PlagueDef
    // 12=Poise, 13=PoiseDmg, 14=CritChance, 15=CritDmg, 16=StamCost
    // 17=FocusGain, 18=StrScaling, 19=DexScaling, 20=IntScaling, 21=FaithScaling
    // 22=Weight, 23=StamRegen

    // Try to access the upgrade templates for scaling
    const upgradeTemplates = db.upgradeTemplates;
    const hasTemplates = upgradeTemplates ? Object.keys(upgradeTemplates).length : 0;

    // Extract raw stat data from weapons
    const weapons = {};
    Object.entries(db.weapons).forEach(([id, w]) => {
      const d = w.data;
      const stats = d.itemCoreStatsModifiers || {};

      // Extract the base stat values
      // The array format appears to be [min, max, hasScaling, scalingMultiplier, ?]
      // or possibly [base, scalingPerLevel, ?, ?, ?]
      const baseStats = {};

      // Key stat indices for weapons
      const STAT_KEYS = {
        damage: '0',      // Physical Damage
        poiseDmg: '13',   // Poise Damage
        critChance: '14', // Critical Damage Chance
        critDmg: '15',    // Critical Damage
        stamCost: '16',   // Attack Stamina Cost
        focusGain: '17',  // Focus Gain On Hit
        weight: '22',     // Equipped Weight
      };

      Object.entries(STAT_KEYS).forEach(([name, key]) => {
        const vals = stats[key];
        if (vals && Array.isArray(vals)) {
          baseStats[name] = vals;
        }
      });

      weapons[id] = {
        name: tr(w.name),
        baseAttributes: d.baseAttributes,
        upgradeTemplate: d.upgradeTemplate,
        rawStats: baseStats,
        dropLevel: d.dropLevel,
        weaponClass: d.weaponClass,
        damageSchool: d.damageSchool,
      };
    });

    // Extract armor stats
    const armors = {};
    Object.entries(db.armors).forEach(([id, a]) => {
      const d = a.data;
      const stats = d.itemCoreStatsModifiers || {};

      const ARMOR_STAT_KEYS = {
        physDef: '6',
        fireDef: '7',
        iceDef: '8',
        lightDef: '9',
        holyDef: '10',
        plagueDef: '11',
        poise: '12',
        weight: '22',
      };

      const baseStats = {};
      Object.entries(ARMOR_STAT_KEYS).forEach(([name, key]) => {
        const vals = stats[key];
        if (vals && Array.isArray(vals)) {
          baseStats[name] = vals;
        }
      });

      armors[id] = {
        name: tr(a.name),
        baseAttributes: d.baseAttributes,
        upgradeTemplate: d.upgradeTemplate,
        rawStats: baseStats,
        dropLevel: d.dropLevel,
      };
    });

    // Extract shield stats
    const shields = {};
    Object.entries(db.shields).forEach(([id, s]) => {
      const d = s.data;
      const stats = d.itemCoreStatsModifiers || {};

      const SHIELD_STAT_KEYS = {
        shieldArmor: '6',
        poiseDmgOnBlock: '13',
        focusGainOnBlock: '17',
        weight: '22',
      };

      const baseStats = {};
      Object.entries(SHIELD_STAT_KEYS).forEach(([name, key]) => {
        const vals = stats[key];
        if (vals && Array.isArray(vals)) {
          baseStats[name] = vals;
        }
      });

      shields[id] = {
        name: tr(s.name),
        baseAttributes: d.baseAttributes,
        upgradeTemplate: d.upgradeTemplate,
        rawStats: baseStats,
        dropLevel: d.dropLevel,
      };
    });

    // Try to get upgrade template data (how stats scale with upgrade level)
    const templates = {};
    if (upgradeTemplates) {
      Object.entries(upgradeTemplates).forEach(([id, tmpl]) => {
        if (tmpl.data) {
          templates[id] = tmpl.data;
        }
      });
    }

    return {
      weapons,
      armors,
      shields,
      templates,
      templateCount: Object.keys(templates).length,
      weaponCount: Object.keys(weapons).length,
      armorCount: Object.keys(armors).length,
      shieldCount: Object.keys(shields).length,
    };
  });

  console.log('Extracted:');
  console.log('  Weapons:', stats.weaponCount, 'with raw stats');
  console.log('  Armors:', stats.armorCount, 'with raw stats');
  console.log('  Shields:', stats.shieldCount, 'with raw stats');
  console.log('  Upgrade templates:', stats.templateCount);

  // Save
  fs.writeFileSync(path.join(DATA_DIR, 'weapon-stats.json'), JSON.stringify(stats.weapons, null, 2).replace(/''/g, "'"));
  fs.writeFileSync(path.join(DATA_DIR, 'armor-stats.json'), JSON.stringify(stats.armors, null, 2).replace(/''/g, "'"));
  fs.writeFileSync(path.join(DATA_DIR, 'shield-stats.json'), JSON.stringify(stats.shields, null, 2).replace(/''/g, "'"));
  fs.writeFileSync(path.join(DATA_DIR, 'upgrade-templates.json'), JSON.stringify(stats.templates, null, 2));

  // Show a sample weapon's stats
  const sampleId = Object.keys(stats.weapons)[0];
  const sample = stats.weapons[sampleId];
  console.log('\nSample weapon:', sample.name);
  console.log('  Raw stats:', JSON.stringify(sample.rawStats, null, 2));

  // Now try to compute stats at level 1 and 16 using upgrade template
  if (sample.upgradeTemplate && stats.templates[sample.upgradeTemplate]) {
    const template = stats.templates[sample.upgradeTemplate];
    console.log('  Upgrade template keys:', Object.keys(template).slice(0, 10));
    console.log('  Template sample:', JSON.stringify(template).substring(0, 500));
  }

  await browser.close();
  console.log('\nDone!');
}

main().catch(err => { console.error('Error:', err); process.exit(1); });
