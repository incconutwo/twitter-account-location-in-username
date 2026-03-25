// Centralized Settings Manager
// Settings are loaded once here and shared with all content scripts via messaging

const SETTINGS_KEYS = ['extension_enabled', 'blocked_countries', 'verified_only_mode', 'auto_block_mode', 'passport_mode', 'dev_data_source'];
const STATS_KEY = 'extension_stats';
const TOTAL_COUNTRIES = 195;

let cachedSettings = null;
let cachedStats = null;
let statsSaveTimer = null;

// Load settings from storage
async function loadSettings() {
  const result = await browser.storage.local.get(SETTINGS_KEYS);
  cachedSettings = {
    extension_enabled: result.extension_enabled ?? true,
    blocked_countries: result.blocked_countries || [],
    verified_only_mode: result.verified_only_mode ?? false,
    auto_block_mode: result.auto_block_mode ?? false,
    passport_mode: result.passport_mode ?? true,
    dev_data_source: result.dev_data_source || 'auto'
  };
  return cachedSettings;
}

// Load stats from storage
async function loadStats() {
  const result = await browser.storage.local.get(STATS_KEY);
  const rawStats = result[STATS_KEY] || {};
  cachedStats = {
    hiddenPosts: rawStats.hiddenPosts || 0,
    blockedAccounts: rawStats.blockedAccounts || 0,
    seenCountries: rawStats.seenCountries || {},
    totalScanned: rawStats.totalScanned || 0
  };
  return cachedStats;
}

function saveStatsDebounced() {
  if (statsSaveTimer) clearTimeout(statsSaveTimer);
  statsSaveTimer = setTimeout(() => {
    browser.storage.local.set({ [STATS_KEY]: cachedStats });
  }, 1000);
}

// Initialize settings and stats on startup
loadSettings();
loadStats();

// Listen for settings changes and update cache
browser.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  
  for (const key of SETTINGS_KEYS) {
    if (changes[key]) {
      cachedSettings[key] = changes[key].newValue;
    }
  }
  
  // Broadcast settings update to all Twitter/X tabs
  browser.tabs.query({ url: ['https://x.com/*', 'https://twitter.com/*'] }).then((tabs) => {
    for (const tab of tabs) {
      browser.tabs.sendMessage(tab.id, { 
        type: 'settingsUpdate', 
        settings: cachedSettings 
      }).catch(() => {}); // Ignore errors for inactive tabs
    }
  });
});

// Handle messages from content scripts
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'getSettings') {
    if (cachedSettings) {
      return Promise.resolve(cachedSettings);
    } else {
      return loadSettings();
    }
  }

  if (request.type === 'countrySpotted') {
    if (!cachedStats) {
      loadStats().then(() => handleCountrySpotted(request, sender));
      return true;
    }
    handleCountrySpotted(request, sender);
  }

  if (request.type === 'incrementStat') {
    if (!cachedStats) {
      loadStats().then(() => handleIncrementStat(request));
      return true;
    }
    handleIncrementStat(request);
  }

  return false;
});

function handleCountrySpotted(request, sender) {
  const { country, flag } = request;
  if (!country) return;

  const isNew = !cachedStats.seenCountries[country];
  cachedStats.seenCountries[country] = (cachedStats.seenCountries[country] || 0) + 1;
  cachedStats.totalScanned++;

  if (isNew && cachedSettings.passport_mode) {
    const discoveredCount = Object.keys(cachedStats.seenCountries).length;
    browser.tabs.sendMessage(sender.tab.id, {
      type: 'showDiscoveryToast',
      countryName: country,
      flag: flag,
      discoveredCount: discoveredCount,
      total: TOTAL_COUNTRIES
    }).catch(() => {});
  }

  saveStatsDebounced();
}

function handleIncrementStat(request) {
  const { statType } = request;
  if (statType === 'hidden') cachedStats.hiddenPosts++;
  else if (statType === 'blocked') cachedStats.blockedAccounts++;
  saveStatsDebounced();
}

// Set icon on install
browser.runtime.onInstalled.addListener(() => {
  browser.action.setIcon({
    path: {
      "16": "icons/16.png",
      "48": "icons/48.png",
      "128": "icons/128.png"
    }
  });
});