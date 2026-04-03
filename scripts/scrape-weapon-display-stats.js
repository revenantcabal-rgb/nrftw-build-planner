const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'public', 'data');

async function main() {
  console.log('Scraping computed weapon stats from database pages...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // First get the weapon list with URLs from the database
  await page.goto('https://www.norestforthewicked.gg/db/weapons', {
    waitUntil: 'networkidle', timeout: 60000
  });
  await page.waitForTimeout(4000);

  const weaponLinks = await page.evaluate(() => {
    const links = document.querySelectorAll('a[href*="/db/weapons/"]');
    return Array.from(links)
      .map(l => l.getAttribute('href'))
      .filter(h => h && h.match(/\/\d+$/))
      .map(h => ({ href: h, id: h.match(/(\d+)$/)[1] }));
  });

  console.log('Found', weaponLinks.length, 'weapon links');

  // Now visit each weapon page and extract the displayed stats
  const results = {};
  let count = 0;

  for (const wl of weaponLinks) {
    try {
      await page.goto('https://www.norestforthewicked.gg' + wl.href + '?section=General', {
        waitUntil: 'networkidle', timeout: 15000
      });
      await page.waitForTimeout(1500);

      const stats = await page.evaluate(() => {
        const app = document.querySelector('#__nuxt')?.__vue_app__;
        if (!app) return null;
        const db = app.config.globalProperties.$pinia._s.get('db_data')._internal.database;
        const t = app.config.globalProperties.$tolgee.getAllRecords().find(r => r.namespace === 'version4').data;
        const tr = (k) => (t[k] || k).replace(/''/g, "'");

        // Get weapon ID from URL
        const urlId = window.location.pathname.match(/(\d+)$/)?.[1];
        const weapon = urlId ? db.weapons[urlId] : null;
        if (!weapon) return null;

        const d = weapon.data;

        // Read the displayed stat values from the page text
        // The page layout shows stats in specific positions
        const pageText = document.body.innerText;
        const lines = pageText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

        // Find specific stat values
        // The weapon card area has: damage number, poise number, crit text
        // Cost and Gain are shown with icons
        // Requirements shows stat requirements
        // Weight and Durability at the bottom

        // Extract from the right-side panel
        const rightPanel = {};
        const pairs = [
          'Drop Level', 'Drop Rate', 'Upgrade Level', 'Handling', 'Damage Type'
        ];
        for (const key of pairs) {
          const idx = lines.indexOf(key);
          if (idx >= 0 && idx + 1 < lines.length) {
            rightPanel[key] = lines[idx + 1];
          }
        }

        return {
          id: urlId,
          name: tr(weapon.name),
          baseAttributes: d.baseAttributes,
          dropLevel: d.dropLevel,
          weaponClass: d.weaponClass,
          damageSchool: d.damageSchool,
          handType: d.handType,
          upgradeLevel: parseInt(rightPanel['Upgrade Level']) || d.dropLevel,
          handling: rightPanel['Handling'] || '',
          damageType: rightPanel['Damage Type'] || '',
        };
      });

      if (stats) {
        results[stats.id] = stats;
        count++;
        if (count % 20 === 0) process.stdout.write(count + '.');
        else process.stdout.write('.');
      } else {
        process.stdout.write('x');
      }
    } catch (e) {
      process.stdout.write('!');
    }
  }

  console.log('\nScraped', Object.keys(results).length, 'weapons');

  // Save
  fs.writeFileSync(
    path.join(DATA_DIR, 'weapon-display-stats.json'),
    JSON.stringify(results, null, 2).replace(/''/g, "'")
  );
  console.log('Saved weapon-display-stats.json');

  // Show some samples
  const samples = Object.values(results).slice(0, 5);
  samples.forEach(s => {
    console.log(s.name + ': baseAttrs=' + s.baseAttributes + ' drop=' + s.dropLevel + ' upgrade=' + s.upgradeLevel);
  });

  await browser.close();
}

main().catch(err => { console.error('Error:', err); process.exit(1); });
