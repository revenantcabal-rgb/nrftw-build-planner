const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'public', 'data');

async function main() {
  console.log('Deep extraction: enchantments, facets, gems, runes...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Navigate to a page that loads the full database
  await page.goto('https://www.norestforthewicked.gg/db/runes', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForFunction(() => {
    try {
      const app = document.querySelector('#__nuxt').__vue_app__;
      const db = app.config.globalProperties.$pinia._s.get('db_data')._internal.database;
      return Object.keys(db.enchants).length > 0;
    } catch { return false; }
  }, { timeout: 30000 });

  console.log('Database loaded. Extracting...');

  const data = await page.evaluate(() => {
    const app = document.querySelector('#__nuxt').__vue_app__;
    const pinia = app.config.globalProperties.$pinia;
    const db = pinia._s.get('db_data')._internal.database;
    const tolgee = app.config.globalProperties.$tolgee;
    const translations = tolgee.getAllRecords().find(r => r.namespace === 'version4').data;
    const t = (key) => {
      if (!key) return '';
      if (typeof key !== 'string') return String(key);
      if (key.startsWith('l') && /^l\d+$/.test(key)) return translations[key] || '';
      return key;
    };

    // Enchantment type names
    const ENCHANT_TYPES = { 0: 'facet', 1: 'blue', 2: 'purple', 3: 'golden', 4: 'exalted' };

    // Extract enchantments with their modifier data resolved
    const modDataList = db.modifierDataList || {};

    const enchantments = Object.entries(db.enchants).map(([id, e]) => {
      const d = e.data;
      const enchType = ENCHANT_TYPES[d.type] || 'unknown';

      // Try to resolve modifier data for description
      let modDesc = '';
      let modEffects = [];
      if (d.modifierData && modDataList[d.modifierData]) {
        const mod = modDataList[d.modifierData].data;
        if (mod && mod.modifiers) {
          mod.modifiers.forEach(m => {
            if (m.payloads) {
              m.payloads.forEach(p => {
                // Extract what we can from payload types
                if (p.amount && p.amount.scalingData) {
                  const scaling = p.amount.scalingData.scaling;
                  if (scaling && scaling.keys && scaling.keys.length > 0) {
                    const baseVal = scaling.keys[0][1];
                    const maxVal = scaling.keys[scaling.keys.length - 1][1];
                    modEffects.push({
                      type: p.clsType,
                      baseValue: baseVal,
                      maxValue: maxVal
                    });
                  }
                }
              });
            }
          });
        }
      }

      return {
        id,
        name: t(e.name) || '',
        description: t(e.description) || '',
        icon: e.icon || '',
        type: enchType,
        groupType: d.groupType,
        itemType: d.itemType,
        dropLevel: d.dropLevel,
        twoHandedDouble: d.twoHandedDoubleScaling,
        modifierDataId: d.modifierData,
        effects: modEffects
      };
    });

    // Extract gems with details
    const gems = Object.entries(db.gems).map(([id, g]) => {
      const d = g.data;
      return {
        id,
        name: t(g.name) || '',
        description: t(g.description) || '',
        icon: g.icon || '',
        gemType: d.itemType?.gemType,
        dropLevel: d.dropLevel
      };
    });

    // Extract runes with details
    const runes = Object.entries(db.runes).map(([id, r]) => {
      const d = r.data;
      return {
        id,
        name: t(r.name) || '',
        description: t(r.description) || '',
        icon: r.icon || '',
        runeType: d.itemType,
        dropLevel: d.dropLevel,
        isEquipment: d.filterType === 5 || d.filterType === 6,
        filterType: d.filterType
      };
    });

    // Get facet-specific data (enchantments of type 0)
    const facets = enchantments.filter(e => e.type === 'facet');

    return { enchantments, gems, runes, facets };
  });

  // Save files
  const files = {
    'enchantments-full': data.enchantments,
    'gems-full': data.gems,
    'runes-full': data.runes,
    'facets': data.facets
  };

  for (const [name, items] of Object.entries(files)) {
    const filepath = path.join(DATA_DIR, name + '.json');
    const json = JSON.stringify(items, null, 2).replace(/''/g, "'");
    fs.writeFileSync(filepath, json);
    console.log(`  ${name}: ${items.length} items (${(json.length/1024).toFixed(1)} KB)`);
  }

  // Now try to get the computed enchantment descriptions from the page rendering
  // Navigate to a weapon detail page to see how enchantments are displayed
  console.log('\nExtracting computed enchantment text from item pages...');

  // Get a weapon with enchantments
  const weaponWithEnchants = await page.evaluate(() => {
    const app = document.querySelector('#__nuxt').__vue_app__;
    const db = app.config.globalProperties.$pinia._s.get('db_data')._internal.database;
    const t = (key) => {
      const translations = app.config.globalProperties.$tolgee.getAllRecords().find(r => r.namespace === 'version4').data;
      if (!key || typeof key !== 'string') return '';
      return translations[key] || key;
    };

    // Find weapons with unique enchantments
    const weapons = Object.values(db.weapons).filter(w => w.data.uniqueItemConfig?.enchantments?.length > 0);
    return weapons.slice(0, 3).map(w => ({
      id: w.data.identifier,
      name: t(w.name),
      enchantIds: w.data.uniqueItemConfig.enchantments
    }));
  });

  console.log('Weapons with enchantments:', weaponWithEnchants.map(w => w.name).join(', '));

  // Visit a weapon page to get the rendered enchantment text
  if (weaponWithEnchants.length > 0) {
    const w = weaponWithEnchants[0];
    console.log(`Visiting weapon page: ${w.name} (${w.id})...`);
    await page.goto(`https://www.norestforthewicked.gg/db/weapons/straight_sword/${w.id}?section=General`, {
      waitUntil: 'networkidle', timeout: 30000
    });
    await page.waitForTimeout(3000);

    // Extract the enchantment text as rendered on the page
    const pageEnchants = await page.evaluate(() => {
      // Look for enchantment-related text on the page
      const enchantEls = document.querySelectorAll('[class*="enchant"], [class*="stat"], [class*="modifier"]');
      const results = [];
      enchantEls.forEach(el => {
        const text = el.textContent?.trim();
        if (text && text.length > 5 && text.length < 200) {
          results.push({ text, class: el.className });
        }
      });

      // Also try getting all text that looks like stat modifications
      const allText = document.body.innerText;
      const statLines = allText.split('\n').filter(line =>
        line.match(/[\+\-]\d+%?/) ||
        line.match(/increased|decreased|added|reduced/i)
      );

      return { enchantEls: results.slice(0, 20), statLines: statLines.slice(0, 30) };
    });

    console.log('Page enchantment text:', JSON.stringify(pageEnchants, null, 2).substring(0, 1000));
  }

  await browser.close();
  console.log('\nDone!');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
