const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'public', 'data');

async function main() {
  console.log('Extracting enchantment display text from rendered pages...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // First load the DB to get all enchantment IDs and find items that use them
  await page.goto('https://www.norestforthewicked.gg/db/weapons', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForFunction(() => {
    try {
      return Object.keys(document.querySelector('#__nuxt').__vue_app__.config.globalProperties.$pinia._s.get('db_data')._internal.database.weapons).length > 0;
    } catch { return false; }
  }, { timeout: 30000 });

  // Get the enchantment text directly from the database's computed display
  // The site uses a helper function to generate enchantment text - let's find it
  const enchantTexts = await page.evaluate(() => {
    const app = document.querySelector('#__nuxt').__vue_app__;
    const db = app.config.globalProperties.$pinia._s.get('db_data')._internal.database;
    const t = (key) => {
      const translations = app.config.globalProperties.$tolgee.getAllRecords().find(r => r.namespace === 'version4').data;
      if (!key || typeof key !== 'string') return '';
      return translations[key] || key;
    };

    const ENCHANT_TYPES = { 0: 'facet', 1: 'blue', 2: 'purple', 3: 'golden', 4: 'exalted' };
    const modDataList = db.modifierDataList || {};

    // Payload type names (from game code patterns)
    const PAYLOAD_TYPES = {
      0: 'Damage', 1: 'Physical Damage', 2: 'Fire Damage', 3: 'Ice Damage',
      4: 'Lightning Damage', 5: 'Plague Damage', 6: 'Holy Damage',
      7: 'Physical Resistance', 8: 'Fire Resistance', 9: 'Ice Resistance',
      10: 'Lightning Resistance', 11: 'Plague Resistance', 12: 'Holy Resistance',
      13: 'Poise', 14: 'Poise Damage', 15: 'Critical Damage Chance',
      16: 'Critical Damage', 17: 'Attack Speed', 18: 'Movement Speed',
      19: 'Stamina Cost', 20: 'Focus Gain', 21: 'Health Regen',
      22: 'Stamina Regen', 23: 'Focus Regen', 24: 'Lifesteal',
      25: 'Armor Penetration', 26: 'Healing', 27: 'Speed',
      28: 'Durability', 29: 'Equip Load', 30: 'Thorns',
      31: 'Block Stability', 32: 'Block Damage Reduction',
    };

    const results = [];

    Object.entries(db.enchants).forEach(([id, e]) => {
      const d = e.data;
      const enchType = ENCHANT_TYPES[d.type] || 'unknown';
      let description = '';
      let effects = [];

      // Try to build description from modifier data
      if (d.modifierData && modDataList[d.modifierData]) {
        const mod = modDataList[d.modifierData].data;
        if (mod && mod.modifiers) {
          mod.modifiers.forEach(m => {
            if (m.payloads) {
              m.payloads.forEach(p => {
                const typeName = PAYLOAD_TYPES[p.clsType] || `Effect ${p.clsType}`;
                if (p.amount && p.amount.scalingData) {
                  const scaling = p.amount.scalingData.scaling;
                  if (scaling && scaling.keys && scaling.keys.length > 0) {
                    const minVal = scaling.keys[0][1];
                    const maxVal = scaling.keys[scaling.keys.length - 1][1];
                    const isPercent = Math.abs(minVal) <= 2 && Math.abs(maxVal) <= 2;
                    const minDisplay = isPercent ? (minVal * 100).toFixed(0) + '%' : minVal.toFixed(1);
                    const maxDisplay = isPercent ? (maxVal * 100).toFixed(0) + '%' : maxVal.toFixed(1);

                    effects.push({
                      stat: typeName,
                      min: minDisplay,
                      max: maxDisplay,
                      isPercent
                    });
                  }
                }
              });
            }
          });
        }
      }

      // Build description from effects
      if (effects.length > 0) {
        description = effects.map(eff => {
          const sign = parseFloat(eff.min) >= 0 ? '+' : '';
          if (eff.min === eff.max) {
            return `${sign}${eff.min} ${eff.stat}`;
          }
          return `${sign}(${eff.min} - ${eff.max}) ${eff.stat}`;
        }).join(', ');
      }

      results.push({
        id,
        name: t(e.name) || description.split(',')[0] || `Enchant ${id.slice(-6)}`,
        description,
        icon: e.icon || '',
        type: enchType,
        groupType: d.groupType,
        itemType: d.itemType,
        dropLevel: d.dropLevel,
        effects
      });
    });

    return results;
  });

  // Save
  const filepath = path.join(DATA_DIR, 'enchantments.json');
  const json = JSON.stringify(enchantTexts, null, 2).replace(/''/g, "'");
  fs.writeFileSync(filepath, json);

  // Count by type
  const byType = {};
  enchantTexts.forEach(e => {
    byType[e.type] = (byType[e.type] || 0) + 1;
  });

  console.log(`Saved ${enchantTexts.length} enchantments:`);
  console.log('  By type:', JSON.stringify(byType));
  console.log(`  With descriptions: ${enchantTexts.filter(e => e.description).length}`);
  console.log(`  With effects: ${enchantTexts.filter(e => e.effects.length > 0).length}`);

  // Show some samples
  console.log('\nFacet samples:');
  enchantTexts.filter(e => e.type === 'facet').slice(0, 5).forEach(e => {
    console.log(`  ${e.name || 'unnamed'}: ${e.description || 'no desc'}`);
  });

  console.log('\nBlue enchant samples:');
  enchantTexts.filter(e => e.type === 'blue').slice(0, 5).forEach(e => {
    console.log(`  ${e.name || 'unnamed'}: ${e.description || 'no desc'}`);
  });

  await browser.close();
  console.log('\nDone!');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
