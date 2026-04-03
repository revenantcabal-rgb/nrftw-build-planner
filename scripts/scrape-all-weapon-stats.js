const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'public', 'data');

async function main() {
  console.log('Scraping ALL weapon display stats...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Get all weapon URLs
  await page.goto('https://www.norestforthewicked.gg/db/weapons', {
    waitUntil: 'networkidle', timeout: 60000
  });
  await page.waitForTimeout(4000);

  const weaponLinks = await page.evaluate(() => {
    const links = document.querySelectorAll('a[href*="/db/weapons/"]');
    return Array.from(links)
      .map(l => l.getAttribute('href'))
      .filter(h => h && h.match(/\/\d+$/));
  });

  console.log('Found', weaponLinks.length, 'weapons to scrape');

  const results = {};
  let count = 0;

  for (const href of weaponLinks) {
    const id = href.match(/(\d+)$/)[1];
    try {
      await page.goto('https://www.norestforthewicked.gg' + href + '?section=General', {
        waitUntil: 'networkidle', timeout: 12000
      });
      await page.waitForTimeout(1200);

      const data = await page.evaluate((weaponId) => {
        const app = document.querySelector('#__nuxt')?.__vue_app__;
        if (!app) return null;

        const db = app.config.globalProperties.$pinia._s.get('db_data')._internal.database;
        const t = app.config.globalProperties.$tolgee.getAllRecords().find(r => r.namespace === 'version4').data;
        const tr = (k) => (t[k] || k).replace(/''/g, "'");

        const weapon = db.weapons[weaponId];
        if (!weapon) return null;

        const d = weapon.data;
        const body = document.body.innerText;
        const lines = body.split('\n').map(l => l.trim()).filter(l => l.length > 0);

        // Find number-only lines (the stat values)
        const numberLines = lines.filter(l => l.match(/^\d+\.?\d*$/)).map(Number);

        // The number pattern on weapon pages (verified across 3 weapons):
        // [upgradeLevel, damage, poiseDmg, staminaCost, focusGain, req1, req2, durability, weight, ...]
        // BUT bow pages have different pattern (no poise shown same way)

        // Also extract crit text
        const critLine = lines.find(l => l.includes('Chance to Deal'));
        let critChance = 0, critDamage = 0;
        if (critLine) {
          const critMatch = critLine.match(/(\d+)%\s*Chance to Deal\s*(\d+)%/);
          if (critMatch) {
            critChance = parseInt(critMatch[1]);
            critDamage = parseInt(critMatch[2]);
          }
        }

        // Get the upgrade level from right panel
        const ulIdx = lines.indexOf('Upgrade Level');
        const upgradeLevel = ulIdx >= 0 ? parseInt(lines[ulIdx + 1]) || 4 : 4;

        return {
          id: weaponId,
          name: tr(weapon.name),
          baseAttributes: d.baseAttributes,
          dropLevel: d.dropLevel,
          weaponClass: d.weaponClass,
          upgradeLevel,
          critChance,
          critDamage,
          numberLines: numberLines.slice(0, 15), // First 15 numbers
          handType: d.handType,
          damageSchool: d.damageSchool,
        };
      }, id);

      if (data) {
        // Map the number pattern based on position
        const nums = data.numberLines;
        // Pattern: [upgradeLevel, damage, poiseDmg, staminaCost, focusGain, ...]
        // Skip the first number (upgrade level) if it matches
        let startIdx = 0;
        if (nums[0] === data.upgradeLevel) startIdx = 1;

        data.stats = {
          damage: nums[startIdx] || 0,
          poiseDamage: nums[startIdx + 1] || 0,
          staminaCost: nums[startIdx + 2] || 0,
          focusGain: nums[startIdx + 3] || 0,
        };

        // Find weight (always has decimal point)
        const weightNum = nums.find(n => n % 1 !== 0 || (n >= 5 && n <= 100 && nums.indexOf(n) > startIdx + 5));
        // The weight is one of the later numbers with a decimal
        const decimalNums = data.numberLines.filter(n => String(n).includes('.'));
        if (decimalNums.length > 0) {
          data.stats.weight = decimalNums[0];
        }

        // Find durability (usually 100 or near it)
        const durIdx = nums.findIndex((n, i) => i > startIdx + 3 && (n === 100 || n >= 50 && n <= 200));
        if (durIdx >= 0) data.stats.durability = nums[durIdx];

        results[id] = data;
        count++;
        if (count % 20 === 0) process.stdout.write(count + '.');
        else process.stdout.write('.');
      }
    } catch (e) {
      process.stdout.write('!');
    }
  }

  console.log('\nScraped', Object.keys(results).length, 'weapons with stats');

  // Save
  fs.writeFileSync(
    path.join(DATA_DIR, 'weapon-computed-stats.json'),
    JSON.stringify(results, null, 2)
  );

  // Verify with known values
  const fury = Object.values(results).find(w => w.name === "Falstead's Fury");
  if (fury) {
    console.log('\nFalstead\'s Fury verification:');
    console.log('  Expected: Damage=22, Poise=12, Cost=14, Gain=10, Weight=30');
    console.log('  Got:', JSON.stringify(fury.stats));
    console.log('  Numbers:', fury.numberLines);
  }

  await browser.close();
}

main().catch(err => { console.error('Error:', err); process.exit(1); });
