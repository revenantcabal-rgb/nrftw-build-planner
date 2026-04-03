const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'public', 'data');

async function main() {
  console.log('Scraping COMPUTED base stats from reference planner...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto('https://www.norestforthewicked.gg/planner', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(5000);
  console.log('Planner loaded.');

  // Get all weapon IDs and names
  const weapons = await page.evaluate(() => {
    const app = document.querySelector('#__nuxt').__vue_app__;
    const db = app.config.globalProperties.$pinia._s.get('db_data')._internal.database;
    const t = app.config.globalProperties.$tolgee.getAllRecords().find(r => r.namespace === 'version4').data;
    const tr = (k) => (t[k] || k).replace(/''/g, "'");
    return Object.entries(db.weapons).map(([id, w]) => ({
      id: w.data.identifier,
      name: tr(w.name),
    }));
  });

  console.log('Total weapons:', weapons.length);

  // For each weapon, select it in the planner's Main Hand slot and read the computed base stats
  // The planner uses Vue reactivity - we need to find the right way to trigger item selection

  // First, let's understand how to select a weapon programmatically
  // Click on Main Hand slot to open the picker
  const mainHandSlot = await page.$('text=Main Hand');
  if (!mainHandSlot) {
    console.log('Could not find Main Hand slot');
    await browser.close();
    return;
  }

  await mainHandSlot.click();
  await page.waitForTimeout(2000);

  // Check if item picker opened
  const pickerOpen = await page.evaluate(() => {
    const dialogs = document.querySelectorAll('.p-dialog, [class*="dialog"], [class*="modal"], [class*="overlay"]');
    return dialogs.length;
  });
  console.log('Picker dialogs found:', pickerOpen);

  // Try clicking the first item in the weapon list
  const screenshot1 = await page.screenshot({ path: 'debug-planner.png' });

  // Actually, let me try a different approach - use the site's internal Vue methods
  // to select weapons and read the computed stats
  const result = await page.evaluate(async () => {
    const app = document.querySelector('#__nuxt').__vue_app__;
    const db = app.config.globalProperties.$pinia._s.get('db_data')._internal.database;
    const t = app.config.globalProperties.$tolgee.getAllRecords().find(r => r.namespace === 'version4').data;
    const tr = (k) => (t[k] || k).replace(/''/g, "'");

    // Find the actual stat computation functions
    // The site has a getBalanceConfig that returns the stat formulas
    const store = app.config.globalProperties.$pinia._s.get('db_data');

    // Check for computed getters that might give us base stats
    const allKeys = Object.getOwnPropertyNames(Object.getPrototypeOf(store));
    const getters = allKeys.filter(k => k.startsWith('get'));

    // Try calling stat-related getters
    const balanceConfig = typeof store.getBalanceConfig === 'function' ? store.getBalanceConfig() : store.getBalanceConfig;
    const simConfig = typeof store.getSimulationConfig === 'function' ? store.getSimulationConfig() : store.getSimulationConfig;

    return {
      getters: getters,
      balanceConfigType: typeof balanceConfig,
      balanceKeys: balanceConfig ? Object.keys(balanceConfig).slice(0, 20) : [],
      simConfigType: typeof simConfig,
      simKeys: simConfig ? Object.keys(simConfig).slice(0, 20) : [],
    };
  });

  console.log('Store getters:', result.getters);
  console.log('Balance config:', result.balanceConfigType, result.balanceKeys);
  console.log('Sim config:', result.simConfigType, result.simKeys);

  // Now let me try to find the actual stat computation by looking at the balance config
  const balanceData = await page.evaluate(() => {
    const app = document.querySelector('#__nuxt').__vue_app__;
    const store = app.config.globalProperties.$pinia._s.get('db_data');
    const bc = typeof store.getBalanceConfig === 'function' ? store.getBalanceConfig() : store.getBalanceConfig;

    if (!bc) return null;

    // The balance config likely contains formulas for how baseAttributes translates to actual stats
    return JSON.stringify(bc).substring(0, 3000);
  });

  console.log('\nBalance config data:', balanceData ? balanceData.substring(0, 1000) : 'null');

  await browser.close();
  console.log('\nDone!');
}

main().catch(err => { console.error('Error:', err); process.exit(1); });
