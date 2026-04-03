/**
 * Extract weapon-to-default-rune mapping from the game database.
 *
 * Each weapon in the game has a default action/rune pre-installed.
 * This script extracts that mapping from the Pinia store's weaponToActions
 * data and cross-references with rune action IDs to produce a clean
 * { weaponId: runeId } mapping.
 *
 * Usage: node scripts/extract-weapon-default-runes.js
 * Requires: playwright (npx playwright install chromium)
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'public', 'data');
const BASE_URL = 'https://www.norestforthewicked.gg/db/weapons';

async function main() {
  console.log('Extracting weapon default rune mapping...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('Navigating to', BASE_URL);
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 60000 });

  console.log('Waiting for data store...');
  await page.waitForFunction(() => {
    try {
      const app = document.querySelector('#__nuxt').__vue_app__;
      const pinia = app.config.globalProperties.$pinia;
      const db = pinia._s.get('db_data')._internal.database;
      return Object.keys(db.weapons).length > 0;
    } catch { return false; }
  }, { timeout: 30000 });

  console.log('Store ready. Extracting weapon-to-actions mapping...');

  const result = await page.evaluate(() => {
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

    // Get weaponToActions mapping
    const weaponToActions = db.weaponToActions || {};

    // Build action-to-rune reverse lookup
    const actionToRune = {};
    for (const [runeId, rune] of Object.entries(db.runes)) {
      const actions = rune.data?.actions || [];
      for (const actionId of actions) {
        actionToRune[actionId] = {
          id: runeId,
          name: t(rune.name),
          icon: rune.icon,
          utility: rune.data?.utility || false,
          compatibleClasses: rune.data?.compatibleClasses || [],
        };
      }
    }

    // Map weapons to their default runes
    const weaponDefaultRunes = {};
    const debugInfo = {
      totalWeapons: Object.keys(db.weapons).length,
      totalWeaponToActions: 0,
      matched: 0,
      unmatched: [],
    };

    // weaponToActions could be: { weaponId: actionId } or { weaponId: [actionIds] } or something else
    // Let's explore the structure first
    const rawMapping = JSON.parse(JSON.stringify(weaponToActions));
    debugInfo.totalWeaponToActions = Object.keys(rawMapping).length;
    debugInfo.sampleEntries = Object.entries(rawMapping).slice(0, 5).map(([k, v]) => ({
      weaponId: k,
      weaponName: db.weapons[k] ? t(db.weapons[k].name) : 'unknown',
      value: v,
    }));

    for (const [weaponId, actionData] of Object.entries(rawMapping)) {
      // actionData could be a string ID, array, or object
      let actionIds = [];
      if (typeof actionData === 'string') {
        actionIds = [actionData];
      } else if (Array.isArray(actionData)) {
        actionIds = actionData.map(a => typeof a === 'string' ? a : a?.id || a?.identifier || String(a));
      } else if (typeof actionData === 'object' && actionData !== null) {
        // Could be { actionId: ... } or similar
        actionIds = Object.values(actionData).flat().map(a => typeof a === 'string' ? a : String(a));
      }

      // Find matching rune for first action
      for (const actionId of actionIds) {
        const rune = actionToRune[actionId];
        if (rune && !rune.utility) {
          weaponDefaultRunes[weaponId] = rune.id;
          debugInfo.matched++;
          break;
        }
      }

      if (!weaponDefaultRunes[weaponId] && db.weapons[weaponId]) {
        debugInfo.unmatched.push({
          weaponId,
          weaponName: t(db.weapons[weaponId].name),
          actionIds,
        });
      }
    }

    return {
      weaponDefaultRunes,
      debugInfo,
      rawMapping,
    };
  });

  console.log('\n=== Debug Info ===');
  console.log('Total weapons:', result.debugInfo.totalWeapons);
  console.log('WeaponToActions entries:', result.debugInfo.totalWeaponToActions);
  console.log('Matched to runes:', result.debugInfo.matched);
  console.log('Unmatched:', result.debugInfo.unmatched.length);

  if (result.debugInfo.sampleEntries) {
    console.log('\nSample weaponToActions entries:');
    for (const s of result.debugInfo.sampleEntries) {
      console.log(`  ${s.weaponName} (${s.weaponId}): ${JSON.stringify(s.value).slice(0, 100)}`);
    }
  }

  if (result.debugInfo.unmatched.length > 0) {
    console.log('\nFirst 5 unmatched:');
    for (const u of result.debugInfo.unmatched.slice(0, 5)) {
      console.log(`  ${u.weaponName}: actions=${JSON.stringify(u.actionIds).slice(0, 80)}`);
    }
  }

  // Save the clean mapping
  fs.writeFileSync(
    path.join(DATA_DIR, 'weapon-default-runes.json'),
    JSON.stringify(result.weaponDefaultRunes, null, 2)
  );
  console.log('\nSaved weapon-default-runes.json with', Object.keys(result.weaponDefaultRunes).length, 'entries');

  // Also save the raw mapping for debugging
  fs.writeFileSync(
    path.join(DATA_DIR, 'weaponToActions.json'),
    JSON.stringify(result.rawMapping, null, 2)
  );
  console.log('Saved weaponToActions.json (raw)');

  await browser.close();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
