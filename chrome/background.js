// Centralized Settings Manager
// Settings are loaded once here and shared with all content scripts via messaging

const SETTINGS_KEYS = ['extension_enabled', 'blocked_countries', 'verified_only_mode', 'auto_block_mode', 'passport_mode', 'dev_data_source', 'always_load_comments', 'block_vpn_mode', 'bypass_followed_mode'];
const STATS_KEY = 'extension_stats';
const TOTAL_COUNTRIES = 195;
const TELEMETRY_ENDPOINT = 'https://twitter-countries-api.tnemoroccan.workers.dev/telemetry';

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
    always_load_comments: result.always_load_comments ?? false,
    block_vpn_mode: result.block_vpn_mode ?? false,
    bypass_followed_mode: result.bypass_followed_mode !== false
  };
  return cachedSettings;
}

function normalizeStats(raw) {
  const s = raw || {};
  return {
    hiddenPosts: Number(s.hiddenPosts) || 0,
    blockedAccounts: Number(s.blockedAccounts) || 0,
    seenCountries: (s.seenCountries && typeof s.seenCountries === 'object') ? s.seenCountries : {},
    totalScanned: Number(s.totalScanned) || 0,
    shownMilestones: Array.isArray(s.shownMilestones) ? s.shownMilestones : []
  };
}

// Load stats from storage
async function loadStats() {
  const result = await chrome.storage.local.get(STATS_KEY);
  cachedStats = normalizeStats(result[STATS_KEY]);
  return cachedStats;
}

let isSavingStats = false;
function saveStatsDebounced() {
  if (statsSaveTimer) clearTimeout(statsSaveTimer);
  statsSaveTimer = setTimeout(() => {
    statsSaveTimer = null;
    isSavingStats = true;
    chrome.storage.local.set({ [STATS_KEY]: cachedStats }, () => {
      isSavingStats = false;
    });
  }, 1000);
}

// Telemetry & Anonymous Analytics Relay (Zero User Disruption)
async function sendTelemetry(urlPath, eventName, data) {
  try {
    const payload = {
      url: urlPath || '/active',
      name: eventName || null,
      data: data || {},
      language: navigator.language || 'en'
    };
    await fetch(TELEMETRY_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (_) {
    // Fail-safe, non-blocking: silently ignore network errors
  }
}

async function checkDailyActive() {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const { last_telemetry_date } = await chrome.storage.local.get('last_telemetry_date');
    if (last_telemetry_date !== today) {
      await chrome.storage.local.set({ last_telemetry_date: today });
      const version = chrome.runtime.getManifest().version;
      sendTelemetry('/active', 'daily_active', { version });
    }
  } catch (_) {}
}

// Initialize settings, stats, and daily active heartbeat
const initPromise = Promise.all([loadSettings(), loadStats()]).then(() => {
  checkDailyActive();
});
chrome.runtime.onStartup?.addListener(() => {
  checkDailyActive();
});

// Listen for settings changes and update cache
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  
  initPromise.then(() => {
    for (const key of SETTINGS_KEYS) {
      if (changes[key]) {
        cachedSettings[key] = changes[key].newValue;
      }
    }

    if (changes[STATS_KEY] && !isSavingStats) {
      cachedStats = normalizeStats(changes[STATS_KEY].newValue);
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
    message: "100 spam posts hidden! Your timeline is looking cleaner.\n\nMind leaving a quick review to help others find us?",
    buttonText: "Leave a Review",
    url: "https://chromewebstore.google.com/detail/xtwitter-country-flags-bl/dgodabjkaifjlhpcapiohikkklnailla/reviews?utm_source=milestone100"
  },
  500: {
    message: "Whoa! You've officially hidden 500 spam posts.\n\nOur Cloudflare database processes thousands of requests daily to keep your feed clean. Support with $5 on Ko-fi to unlock Lifetime Pro!",
    buttonText: "Support $5 (Get Lifetime Pro)",
    url: "https://ko-fi.com/incconutwo?ref=milestone500"
  },
  2500: {
    message: "2,500+ posts hidden! You're a power user. Help keep the servers running and unlock Lifetime Pro by supporting $5 on Ko-fi!",
    buttonText: "Support $5 (Lifetime Pro)",
    url: "https://ko-fi.com/incconutwo?ref=milestone2500"
  }
};

const SCANNED_MILESTONE_CONFIGS = {
  500: {
    key: 'scanned_500',
    count: 500,
    message: "You've spotted 500 user locations on X!\n\nOur community database runs 24/7 to show instant flags without slowing down your feed. Chip in $5 on Ko-fi to help cover server costs & get Lifetime Pro!",
    buttonText: "Support $5 (Get Lifetime Pro)",
    url: "https://ko-fi.com/incconutwo?ref=scanned500"
  },
  2500: {
    key: 'scanned_2500',
    count: 2500,
    message: "2,500+ user locations revealed!\n\nYou're a true power user! Help keep this extension 100% independent and ad-free; support with $5 on Ko-fi and get Lifetime Pro!",
    buttonText: "Support $5 (Lifetime Pro)",
    url: "https://ko-fi.com/incconutwo?ref=scanned2500"
  }
};

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'getSettings') {
    initPromise.then(() => sendResponse(cachedSettings));
    return true; // Will respond asynchronously
  }

  if (request.type === 'sendTelemetry') {
    sendTelemetry(request.url, request.eventName, request.data);
    return false;
  }

  initPromise.then(() => {
    if (request.type === 'countrySpotted') {
      handleCountrySpotted(request, sender);
    } else if (request.type === 'incrementStat') {
      handleIncrementStat(request, sender);
    } else if (request.type === 'testMilestone') {
      const config = MILESTONE_CONFIGS[request.count] || SCANNED_MILESTONE_CONFIGS[request.count];
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

  if (isNew && cachedSettings.passport_mode && sender?.tab?.id) {
    const discoveredCount = Object.keys(cachedStats.seenCountries).length;
    chrome.tabs.sendMessage(sender.tab.id, {
      type: 'showDiscoveryToast',
      countryName: country,
      flag: flag,
      discoveredCount: discoveredCount,
      total: TOTAL_COUNTRIES
    }).catch(() => {});
  }

  // Trigger Ko-fi milestone toast for users who use the extension for flags (500 & 2,500 accounts scanned)
  const scannedCount = cachedStats.totalScanned;
  const scannedMilestone = SCANNED_MILESTONE_CONFIGS[scannedCount];
  if (scannedMilestone && !cachedStats.shownMilestones.includes(scannedMilestone.key)) {
    cachedStats.shownMilestones.push(scannedMilestone.key);
    if (sender?.tab?.id) {
      chrome.tabs.sendMessage(sender.tab.id, {
        type: 'showMilestoneToast',
        count: scannedMilestone.count,
        message: scannedMilestone.message,
        buttonText: scannedMilestone.buttonText,
        url: scannedMilestone.url
      }).catch(() => {});
    }
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

  const version = chrome.runtime.getManifest().version;
  if (details && details.reason === 'install') {
    sendTelemetry('/installed', 'extension_installed', { version });
  } else if (details && details.reason === 'update') {
    sendTelemetry('/updated', 'extension_updated', {
      version,
      previous_version: details.previousVersion || 'unknown'
    });
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