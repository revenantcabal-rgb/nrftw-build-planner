const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'public', 'data');

/**
 * Scrape armor, shield, and trinket stats by visiting individual detail pages
 * and reading the rendered stat values from the page text.
 */
async function main() {
  console.log('Scraping armor, shield, and trinket stats...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // First, go to the DB page to get the Pinia store
  await page.goto('https://www.norestforthewicked.gg/db/weapons', {
    waitUntil: 'networkidle', timeout: 60000
  });
  await page.waitForTimeout(5000);

  // Extract all armor, shield, trinket IDs from the Pinia store
  const allIds = await page.evaluate(() => {
    const app = document.querySelector('#__nuxt')?.__vue_app__;
    if (!app) return null;

    const db = app.config.globalProperties.$pinia._s.get('db_data')._internal.database;
    const t = app.config.globalProperties.$tolgee.getAllRecords().find(r => r.namespace === 'version4').data;
    const tr = (k) => (t[k] || k).replace(/''/g, "'");

    const result = { armors: [], shields: [], trinkets: [] };

    // Armors
    if (db.armors) {
      for (const [id, item] of Object.entries(db.armors)) {
        const d = item.data;
        const material = {0: 'cloth', 1: 'leather', 2: 'mesh', 3: 'plate'}[d.armorType] || 'cloth';
        result.armors.push({
          id,
          name: tr(item.name),
          material,
          baseAttributes: d.baseAttributes,
          dropLevel: d.dropLevel,
          armorSlot: {0: 'head', 1: 'chest', 2: 'hands', 3: 'legs'}[d.materialType] || 'chest',
        });
      }
    }

    // Shields
    if (db.shields) {
      for (const [id, item] of Object.entries(db.shields)) {
        result.shields.push({
          id,
          name: tr(item.name),
          baseAttributes: item.data.baseAttributes,
          dropLevel: item.data.dropLevel,
        });
      }
    }

    // Trinkets
    if (db.trinkets) {
      for (const [id, item] of Object.entries(db.trinkets)) {
        result.trinkets.push({
          id,
          name: tr(item.name),
          baseAttributes: item.data.baseAttributes,
          dropLevel: item.data.dropLevel,
        });
      }
    }

    return result;
  });

  if (!allIds) {
    console.error('Failed to get database from Pinia store');
    await browser.close();
    return;
  }

  console.log(`Found: ${allIds.armors.length} armors, ${allIds.shields.length} shields, ${allIds.trinkets.length} trinkets`);

  // Scrape armor detail pages
  const armorResults = {};
  console.log('\nScraping armor pages...');
  for (const armor of allIds.armors) {
    try {
      const url = `https://www.norestforthewicked.gg/db/armor/${armor.material}/${armor.id}?section=General`;
      await page.goto(url, { waitUntil: 'networkidle', timeout: 12000 });
      await page.waitForTimeout(1000);

      const stats = await page.evaluate(() => {
        const body = document.body.innerText;
        const lines = body.split('\n').map(l => l.trim()).filter(l => l.length > 0);

        const result = {};
        const statMap = {
          'Physical Defense': 'physicalDefense',
          'Fire Defense': 'fireDefense',
          'Ice Defense': 'iceDefense',
          'Lightning Defense': 'lightningDefense',
          'Holy Defense': 'holyDefense',
          'Plague Defense': 'plagueDefense',
          'Poise': 'poise',
          'Weight': 'weight',
          'Durability': 'durability',
        };

        for (const [label, key] of Object.entries(statMap)) {
          for (let i = 0; i < lines.length; i++) {
            if (lines[i] === label) {
              // Check next line for number
              for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
                const numMatch = lines[j].match(/^(\d+\.?\d*)$/);
                if (numMatch) {
                  result[key] = parseFloat(numMatch[1]);
                  break;
                }
              }
              break;
            }
          }
        }

        // Fallback: get all numbers
        const numberLines = lines.filter(l => l.match(/^\d+\.?\d*$/)).map(Number);
        return { stats: result, numberLines: numberLines.slice(0, 15) };
      });

      armorResults[armor.id] = {
        id: armor.id,
        name: armor.name,
        stats: stats.stats,
        numberLines: stats.numberLines,
      };
      process.stdout.write('.');
    } catch (e) {
      process.stdout.write('!');
    }
  }
  console.log(`\nScraped ${Object.keys(armorResults).length} armors`);

  // Check first result
  const sampleArmor = Object.values(armorResults)[0];
  if (sampleArmor) {
    console.log('Sample armor:', sampleArmor.name, sampleArmor.stats, 'nums:', sampleArmor.numberLines);
  }

  // If labeled stats are empty, try to build from number positions
  const armorHasStats = Object.values(armorResults).some(a => Object.keys(a.stats).length > 0);
  if (!armorHasStats) {
    console.log('Labeled stats empty, mapping from number positions...');
    // Armor number pattern: [upgradeLevel, physDef, fireDef, iceDef, lightDef, holyDef, plagueDef, poise, durability, weight]
    for (const armor of Object.values(armorResults)) {
      const nums = armor.numberLines;
      if (nums.length >= 8) {
        // Skip upgrade level (first number)
        let idx = 0;
        if (nums[0] <= 16) idx = 1; // skip upgrade level

        armor.stats = {
          physicalDefense: nums[idx] || 0,
          fireDefense: nums[idx + 1] || 0,
          iceDefense: nums[idx + 2] || 0,
          lightningDefense: nums[idx + 3] || 0,
          holyDefense: nums[idx + 4] || 0,
          plagueDefense: nums[idx + 5] || 0,
          poise: nums[idx + 6] || 0,
        };
        // Find weight (decimal number)
        const decimalNums = nums.filter(n => String(n).includes('.'));
        if (decimalNums.length > 0) armor.stats.weight = decimalNums[0];
        // Find durability (usually 100)
        const durIdx = nums.findIndex((n, i) => i > idx + 6 && n >= 50 && n <= 200 && !String(n).includes('.'));
        if (durIdx >= 0) armor.stats.durability = nums[durIdx];
      }
    }
  }

  fs.writeFileSync(
    path.join(DATA_DIR, 'armor-computed-stats.json'),
    JSON.stringify(armorResults, null, 2)
  );

  // Scrape shield detail pages
  const shieldResults = {};
  console.log('\nScraping shield pages...');
  for (const shield of allIds.shields) {
    try {
      const url = `https://www.norestforthewicked.gg/db/shields/${shield.id}?section=General`;
      await page.goto(url, { waitUntil: 'networkidle', timeout: 12000 });
      await page.waitForTimeout(1000);

      const stats = await page.evaluate(() => {
        const body = document.body.innerText;
        const lines = body.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        const result = {};
        const statMap = {
          'Shield Armor': 'shieldArmor',
          'Poise Damage On Block': 'poiseDamageOnBlock',
          'Weight': 'weight',
          'Durability': 'durability',
        };
        for (const [label, key] of Object.entries(statMap)) {
          for (let i = 0; i < lines.length; i++) {
            if (lines[i] === label) {
              for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
                const numMatch = lines[j].match(/^(\d+\.?\d*)$/);
                if (numMatch) {
                  result[key] = parseFloat(numMatch[1]);
                  break;
                }
              }
              break;
            }
          }
        }
        const numberLines = lines.filter(l => l.match(/^\d+\.?\d*$/)).map(Number);
        return { stats: result, numberLines: numberLines.slice(0, 15) };
      });

      shieldResults[shield.id] = {
        id: shield.id,
        name: shield.name,
        stats: stats.stats,
        numberLines: stats.numberLines,
      };
      process.stdout.write('.');
    } catch (e) {
      process.stdout.write('!');
    }
  }
  console.log(`\nScraped ${Object.keys(shieldResults).length} shields`);

  // Fallback mapping for shields
  const shieldHasStats = Object.values(shieldResults).some(s => Object.keys(s.stats).length > 0);
  if (!shieldHasStats) {
    console.log('Shield labeled stats empty, mapping from numbers...');
    for (const shield of Object.values(shieldResults)) {
      const nums = shield.numberLines;
      if (nums.length >= 3) {
        let idx = 0;
        if (nums[0] <= 16) idx = 1;
        shield.stats = {
          shieldArmor: nums[idx] || 0,
          poiseDamageOnBlock: nums[idx + 1] || 0,
        };
        const decimalNums = nums.filter(n => String(n).includes('.'));
        if (decimalNums.length > 0) shield.stats.weight = decimalNums[0];
        const durIdx = nums.findIndex((n, i) => i > idx + 1 && n >= 50 && n <= 200 && !String(n).includes('.'));
        if (durIdx >= 0) shield.stats.durability = nums[durIdx];
      }
    }
  }

  fs.writeFileSync(
    path.join(DATA_DIR, 'shield-computed-stats.json'),
    JSON.stringify(shieldResults, null, 2)
  );

  // Scrape trinket detail pages
  const trinketResults = {};
  console.log('\nScraping trinket pages...');
  for (const trinket of allIds.trinkets) {
    try {
      const url = `https://www.norestforthewicked.gg/db/trinkets/${trinket.id}?section=General`;
      await page.goto(url, { waitUntil: 'networkidle', timeout: 12000 });
      await page.waitForTimeout(1000);

      const stats = await page.evaluate(() => {
        const body = document.body.innerText;
        const lines = body.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        const result = {};
        for (let i = 0; i < lines.length; i++) {
          if (lines[i] === 'Weight') {
            for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
              const numMatch = lines[j].match(/^(\d+\.?\d*)$/);
              if (numMatch) { result.weight = parseFloat(numMatch[1]); break; }
            }
          }
        }
        const numberLines = lines.filter(l => l.match(/^\d+\.?\d*$/)).map(Number);
        return { stats: result, numberLines: numberLines.slice(0, 10) };
      });

      trinketResults[trinket.id] = {
        id: trinket.id,
        name: trinket.name,
        stats: stats.stats,
        numberLines: stats.numberLines,
      };
      process.stdout.write('.');
    } catch (e) {
      process.stdout.write('!');
    }
  }
  console.log(`\nScraped ${Object.keys(trinketResults).length} trinkets`);

  // Trinket weight fallback
  for (const trinket of Object.values(trinketResults)) {
    if (!trinket.stats.weight) {
      const decimalNums = trinket.numberLines.filter(n => String(n).includes('.'));
      if (decimalNums.length > 0) trinket.stats.weight = decimalNums[0];
    }
  }

  fs.writeFileSync(
    path.join(DATA_DIR, 'trinket-computed-stats.json'),
    JSON.stringify(trinketResults, null, 2)
  );

  // Final summary
  console.log('\n=== Summary ===');
  for (const [cat, results] of [['Armor', armorResults], ['Shield', shieldResults], ['Trinket', trinketResults]]) {
    const vals = Object.values(results);
    const withWeight = vals.filter(v => v.stats?.weight > 0);
    console.log(`${cat}: ${vals.length} scraped, ${withWeight.length} with weight`);
    if (vals[0]) console.log(`  Sample: ${vals[0].name} stats=${JSON.stringify(vals[0].stats)}`);
  }

  await browser.close();
}

main().catch(err => { console.error('Error:', err); process.exit(1); });
