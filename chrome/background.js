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
  const result = await chrome.storage.local.get(SETTINGS_KEYS);
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
  const result = await chrome.storage.local.get(STATS_KEY);
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
    chrome.storage.local.set({ [STATS_KEY]: cachedStats });
  }, 1000);
}

// Initialize settings and stats on startup
loadSettings();
loadStats();

// Listen for settings changes and update cache
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  
  for (const key of SETTINGS_KEYS) {
    if (changes[key]) {
      cachedSettings[key] = changes[key].newValue;
    }
  }
  
  // Broadcast settings update to all Twitter/X tabs
  chrome.tabs.query({ url: ['https://x.com/*', 'https://twitter.com/*'] }, (tabs) => {
    for (const tab of tabs) {
      chrome.tabs.sendMessage(tab.id, { 
        type: 'settingsUpdate', 
        settings: cachedSettings 
      }).catch(() => {}); // Ignore errors for inactive tabs
    }
  });
});

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'getSettings') {
    if (cachedSettings) {
      sendResponse(cachedSettings);
    } else {
      loadSettings().then(settings => sendResponse(settings));
      return true; // Will respond asynchronously
    }
  }

  if (request.type === 'countrySpotted') {
    if (!cachedStats) {
      loadStats().then(() => handleCountrySpotted(request, sender, sendResponse));
      return true;
    }
    handleCountrySpotted(request, sender, sendResponse);
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

function handleCountrySpotted(request, sender, sendResponse) {
  const { country, flag } = request;
  if (!country) return;

  const isNew = !cachedStats.seenCountries[country];
  cachedStats.seenCountries[country] = (cachedStats.seenCountries[country] || 0) + 1;
  cachedStats.totalScanned++;

  if (isNew && cachedSettings.passport_mode) {
    const discoveredCount = Object.keys(cachedStats.seenCountries).length;
    chrome.tabs.sendMessage(sender.tab.id, {
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
chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setIcon({
    path: {
      "16": "icons/16.png",
      "48": "icons/48.png",
      "128": "icons/128.png"
    }
  });
});