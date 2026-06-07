// Centralized Settings Manager
// Settings are loaded once here and shared with all content scripts via messaging

const SETTINGS_KEYS = ['extension_enabled', 'blocked_countries', 'verified_only_mode', 'auto_block_mode', 'passport_mode', 'dev_data_source', 'always_load_comments'];
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
    dev_data_source: result.dev_data_source || 'auto',
    always_load_comments: result.always_load_comments ?? false
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
    totalScanned: rawStats.totalScanned || 0,
    shownMilestones: rawStats.shownMilestones || []
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
const initPromise = Promise.all([loadSettings(), loadStats()]);

// Listen for settings changes and update cache
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  
  initPromise.then(() => {
    for (const key of SETTINGS_KEYS) {
      if (changes[key]) {
        cachedSettings[key] = changes[key].newValue;
      }
    }

    if (changes[STATS_KEY]) {
      cachedStats = changes[STATS_KEY].newValue;
    }
    
    // Only broadcast settings update if settings actually changed
    const settingsChanged = SETTINGS_KEYS.some(key => changes[key]);
    if (settingsChanged) {
      chrome.tabs.query({ url: ['https://x.com/*', 'https://twitter.com/*'] }, (tabs) => {
        for (const tab of tabs) {
          chrome.tabs.sendMessage(tab.id, { 
            type: 'settingsUpdate', 
            settings: cachedSettings 
          }).catch(() => {}); // Ignore errors for inactive tabs
        }
      });
    }
  });
});

const MILESTONE_CONFIGS = {
  100: {
    message: "100 spam posts hidden! 🚩 Your timeline is looking cleaner.\n\nMind leaving a quick review to help others find us?",
    buttonText: "Leave a Review ⭐",
    url: "https://chromewebstore.google.com/detail/xtwitter-country-flags-bl/dgodabjkaifjlhpcapiohikkklnailla/reviews?utm_source=milestone100"
  },
  500: {
    message: "Whoa! You've officially hidden 500 spam posts. 🛡️\n\nOur Cloudflare database processes thousands of requests daily to keep your feed clean. To help cover server costs and keep this free, please consider a $3 donation!",
    buttonText: "Send a Pizza Slice 🍕",
    url: "https://ko-fi.com/incconutwo?ref=milestone500"
  },
  2500: {
    message: "2,500+ posts hidden! 🚀 You're a power user. Help keep the servers running and keeping it free for everyone by donating $5.",
    buttonText: "Donate $5 🍕",
    url: "https://ko-fi.com/incconutwo?ref=milestone2500"
  }
};

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'getSettings') {
    initPromise.then(() => sendResponse(cachedSettings));
    return true; // Will respond asynchronously
  }

  initPromise.then(() => {
    if (request.type === 'countrySpotted') {
      handleCountrySpotted(request, sender);
    } else if (request.type === 'incrementStat') {
      handleIncrementStat(request, sender);
    } else if (request.type === 'testMilestone') {
      const config = MILESTONE_CONFIGS[request.count];
      if (config) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]?.id) {
            chrome.tabs.sendMessage(tabs[0].id, {
              type: 'showMilestoneToast',
              count: request.count,
              ...config
            }).catch(() => {});
          }
        });
      }
    }
  });

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

function handleIncrementStat(request, sender) {
  const { statType } = request;
  if (statType === 'hidden') {
    cachedStats.hiddenPosts++;
    
    // Check for milestones
    const count = cachedStats.hiddenPosts;
    const config = MILESTONE_CONFIGS[count];
    
    if (config && !cachedStats.shownMilestones.includes(count)) {
      cachedStats.shownMilestones.push(count);
      
      if (sender && sender.tab && sender.tab.id) {
        chrome.tabs.sendMessage(sender.tab.id, {
          type: 'showMilestoneToast',
          count: count,
          ...config
        }).catch(() => {}); // handle Chrome runtime lastError gracefully
      }
    }
  } else if (statType === 'blocked') {
    cachedStats.blockedAccounts++;
  }
  saveStatsDebounced();
}

// Set icon on install & open dashboard on update
chrome.runtime.onInstalled.addListener((details) => {
  chrome.action.setIcon({
    path: {
      "16": "icons/16.png",
      "48": "icons/48.png",
      "128": "icons/128.png"
    }
  });

  if (details && details.reason === 'update') {
    chrome.tabs.create({
      url: chrome.runtime.getURL('dashboard.html?update=true')
    });
  }
});

// Flush cached statistics before service worker suspension
chrome.runtime.onSuspend.addListener(() => {
  if (statsSaveTimer) {
    clearTimeout(statsSaveTimer);
    statsSaveTimer = null;
  }
  if (cachedStats) {
    chrome.storage.local.set({ [STATS_KEY]: cachedStats });
  }
});