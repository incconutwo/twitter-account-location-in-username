const CLOUD_API_URL = 'https://twitter-countries-api.tnemoroccan.workers.dev';

// Cache Configuration
const CACHE_KEY = 'twitter_location_cache';
const CACHE_EXPIRY_DAYS = 30; 
const CACHE_EXPIRY_NO_LOC_DAYS = 3;
const MAX_CACHE_SIZE = 5000; 

// State
let locationCache = new Map();
let hasUnsavedChanges = false;

// Queues
const cloudQueue = []; 
const twitterQueue = []; 
const queuedUsernames = new Set(); 
const submittedSessionCache = new Set(); 

// Concurrency & Timing
let isProcessingCloud = false;
let isProcessingTwitter = false;
let rateLimitResetTime = 0; 

// Observers
let observer = null;
const processingUsernames = new Set();

// Extension Settings
let extensionEnabled = true;
let blockedCountries = []; 
const TOGGLE_KEY = 'extension_enabled';
const BLOCKED_COUNTRIES_KEY = 'blocked_countries';
const DEFAULT_ENABLED = true;

// --- CROSS-BROWSER HELPER ---
function storageGet(keys) {
  return new Promise((resolve) => {
    if (typeof browser !== 'undefined' && browser.storage) {
      browser.storage.local.get(keys).then(resolve);
    } else {
      chrome.storage.local.get(keys, resolve);
    }
  });
}

function storageSet(data) {
  return new Promise((resolve) => {
    if (typeof browser !== 'undefined' && browser.storage) {
      browser.storage.local.set(data).then(resolve);
    } else {
      chrome.storage.local.set(data, resolve);
    }
  });
}

// Viewport Observer
const viewportObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const container = entry.target;
      viewportObserver.unobserve(container);
      
      const screenName = extractUsername(container);
      if (screenName) {
        addFlagToUsername(container, screenName).catch(() => {
          container.dataset.flagAdded = 'failed';
        });
      } else {
        container.dataset.flagAdded = 'failed';
      }
    }
  });
}, {
  rootMargin: '2000px 0px 2000px 0px',
  threshold: 0
});

// --- SETTINGS & INIT ---

async function loadSettings() {
  try {
    const result = await storageGet([TOGGLE_KEY, BLOCKED_COUNTRIES_KEY]);
    extensionEnabled = result[TOGGLE_KEY] !== undefined ? result[TOGGLE_KEY] : DEFAULT_ENABLED;
    
    if (result[BLOCKED_COUNTRIES_KEY]) {
      updateBlockedCountries(result[BLOCKED_COUNTRIES_KEY]);
    }
  } catch (error) {}
}

function updateBlockedCountries(input) {
  if (!input) {
    blockedCountries = [];
    return;
  }
  if (Array.isArray(input)) {
    blockedCountries = input.map(s => s.toLowerCase());
    return;
  }
  if (typeof input === 'string') {
    blockedCountries = input.split(',')
      .map(s => s.trim().toLowerCase())
      .filter(s => s.length > 0);
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'extensionToggle') {
    extensionEnabled = request.enabled;
    if (extensionEnabled) {
      setTimeout(() => { processUsernames(); }, 500);
    } else {
      removeAllFlags();
      const hiddenTweets = document.querySelectorAll('[data-location-hidden="true"]');
      hiddenTweets.forEach(tweet => {
        tweet.style.display = '';
        delete tweet.dataset.locationHidden;
      });
      viewportObserver.disconnect();
    }
  } else if (request.type === 'blockedCountriesUpdate') {
    updateBlockedCountries(request.countries);
  } else if (request.type === 'getStatus') {
    const now = Math.floor(Date.now() / 1000);
    const isRateLimited = rateLimitResetTime > now;
    sendResponse({
      rateLimited: isRateLimited,
      resetTime: rateLimitResetTime,
      queueLength: cloudQueue.length + twitterQueue.length
    });
  }
});

// --- CACHE SYSTEM ---

async function loadCache() {
  try {
    if (!chrome.runtime?.id) return;
    const result = await storageGet(CACHE_KEY);
    if (result[CACHE_KEY]) {
      const cached = result[CACHE_KEY];
      const now = Date.now();
      for (const [username, data] of Object.entries(cached)) {
        let location = null;
        let expiry = 0;
        if (typeof data === 'string' || data === null) {
          location = data;
          expiry = 0; 
        } else if (typeof data === 'object') {
          location = data.location;
          expiry = data.expiry || 0;
        }
        if (expiry > now) {
          locationCache.set(username, { location, expiry });
        }
      }
      if (locationCache.size > MAX_CACHE_SIZE) cleanCache();
    }
  } catch (error) {}
}

async function saveCache() {
  try {
    if (!hasUnsavedChanges || !chrome.runtime?.id) return;
    const cacheObj = {};
    const now = Date.now();
    for (const [username, data] of locationCache.entries()) {
      if (data.expiry > now) {
        cacheObj[username] = data;
      }
    }
    await storageSet({ [CACHE_KEY]: cacheObj });
    hasUnsavedChanges = false; 
  } catch (error) {}
}

function saveCacheEntry(username, location) {
  if (!chrome.runtime?.id) return;
  const now = Date.now();
  const days = location === null ? CACHE_EXPIRY_NO_LOC_DAYS : CACHE_EXPIRY_DAYS;
  const expiry = now + (days * 24 * 60 * 60 * 1000);
  locationCache.set(username, { location, expiry });
  hasUnsavedChanges = true; 
  if (locationCache.size > MAX_CACHE_SIZE + 100) cleanCache();
  if (!saveCache.timeout) {
    saveCache.timeout = setTimeout(async () => {
      await saveCache();
      saveCache.timeout = null;
    }, 2000);
  }
}

function cleanCache() {
  const now = Date.now();
  let deletedCount = 0;
  for (const [key, val] of locationCache) {
    if (val.expiry <= now) {
      locationCache.delete(key);
      deletedCount++;
    }
  }
  if (locationCache.size > MAX_CACHE_SIZE) {
    const toDelete = locationCache.size - MAX_CACHE_SIZE;
    const keys = locationCache.keys();
    for (let i = 0; i < toDelete; i++) {
      locationCache.delete(keys.next().value);
      deletedCount++;
    }
  }
  if (deletedCount > 0) hasUnsavedChanges = true;
}

window.addEventListener('pagehide', () => {
  if (hasUnsavedChanges) {
    clearTimeout(saveCache.timeout);
    saveCache(); 
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && hasUnsavedChanges) {
    clearTimeout(saveCache.timeout);
    saveCache();
  }
});

function injectPageScript() {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('pageScript.js');
  script.onload = function() { this.remove(); };
  (document.head || document.documentElement).appendChild(script);
  
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.data && event.data.type === '__rateLimitInfo') {
      rateLimitResetTime = event.data.resetTime;
    }
  });
}

// --- CLOUD API ---

async function fetchFromCloud(usernames) {
  try {
    const userString = usernames.join(',');
    const response = await fetch(`${CLOUD_API_URL}/lookup?users=${encodeURIComponent(userString)}`);
    if (!response.ok) return {};
    return await response.json();
  } catch (e) {
    return {};
  }
}

function submitToCloud(username, location) {
  if (submittedSessionCache.has(username)) return;
  if (!location) return;
  submittedSessionCache.add(username);
  fetch(`${CLOUD_API_URL}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, location })
  }).then(res => {}).catch(() => {});
}

// --- FAST LANE: CLOUD QUEUE ---

async function processCloudQueue() {
  if (isProcessingCloud || cloudQueue.length === 0) return;
  isProcessingCloud = true;

  const batch = [];
  while (cloudQueue.length > 0 && batch.length < 20) {
    batch.push(cloudQueue.shift());
  }

  if (batch.length === 0) {
    isProcessingCloud = false;
    return;
  }

  const usernames = batch.map(item => item.screenName);
  
  let cloudResults = {};
  try {
    cloudResults = await fetchFromCloud(usernames);
  } catch (e) {}
  
  const missingFromCloud = [];

  for (const item of batch) {
    const cloudLoc = cloudResults[item.screenName.toLowerCase()];
    if (cloudLoc) {
      saveCacheEntry(item.screenName, cloudLoc); 
      item.resolve(cloudLoc);
      queuedUsernames.delete(item.screenName);
    } else {
      missingFromCloud.push(item);
    }
  }

  if (missingFromCloud.length > 0) {
    missingFromCloud.forEach(item => twitterQueue.push(item));
    processTwitterQueue();
  }

  isProcessingCloud = false;
  
  if (cloudQueue.length > 0) {
    setTimeout(processCloudQueue, 50); 
  }
}

// --- SLOW LANE: TWITTER QUEUE ---

async function processTwitterQueue() {
  if (isProcessingTwitter || twitterQueue.length === 0) return;
  
  const now = Math.floor(Date.now() / 1000);
  if (rateLimitResetTime > now) {
    const waitTime = (rateLimitResetTime - now) * 1000;
    setTimeout(processTwitterQueue, Math.min(waitTime, 30000));
    return;
  }

  isProcessingTwitter = true;

  const item = twitterQueue.shift();
  
  if (!item) {
    isProcessingTwitter = false;
    return;
  }

  try {
    const location = await makeLocationRequest(item.screenName);
    item.resolve(location);
    queuedUsernames.delete(item.screenName);
    
    if (location) submitToCloud(item.screenName, location);
    
    setTimeout(() => {
      isProcessingTwitter = false;
      processTwitterQueue();
    }, 1500);
    
  } catch (e) {
    item.reject(e);
    isProcessingTwitter = false;
    processTwitterQueue();
  }
}

function makeLocationRequest(screenName) {
  return new Promise((resolve, reject) => {
    const requestId = Date.now() + Math.random();
    
    const handler = (event) => {
      if (event.source !== window) return;
      
      if (event.data && 
          event.data.type === '__locationResponse' &&
          event.data.screenName === screenName && 
          event.data.requestId === requestId) {
        window.removeEventListener('message', handler);
        const location = event.data.location;
        const isRateLimited = event.data.isRateLimited || false;
        
        if (!isRateLimited) {
          saveCacheEntry(screenName, location || null);
        }
        resolve(location || null);
      }
    };
    window.addEventListener('message', handler);
    window.postMessage({ type: '__fetchLocation', screenName, requestId }, '*');
    
    setTimeout(() => {
      window.removeEventListener('message', handler);
      resolve(null);
    }, 10000);
  });
}

async function getUserLocation(screenName) {
  if (locationCache.has(screenName)) {
    const data = locationCache.get(screenName);
    if (Date.now() < data.expiry) return data.location;
    locationCache.delete(screenName);
  }
  
  if (queuedUsernames.has(screenName)) {
    return null; 
  }

  return new Promise((resolve, reject) => {
    queuedUsernames.add(screenName);
    cloudQueue.push({ screenName, resolve, reject });
    
    if (!isProcessingCloud) {
      setTimeout(processCloudQueue, 100);
    }
  });
}

// --- DOM UTILS ---

function extractUsername(element) {
  const usernameElement = element.querySelector('[data-testid="UserName"], [data-testid="User-Name"]');
  if (usernameElement) {
    const links = usernameElement.querySelectorAll('a[href^="/"]');
    for (const link of links) {
      const href = link.getAttribute('href');
      const match = href.match(/^\/([^\/\?]+)/);
      if (match && match[1]) {
        const username = match[1];
        const excludedRoutes = ['home', 'explore', 'notifications', 'messages', 'i', 'compose', 'search', 'settings', 'bookmarks', 'lists', 'communities', 'hashtag'];
        if (!excludedRoutes.includes(username) && !username.match(/^(hashtag|search)/) && username.length > 0 && username.length < 20) {
          return username;
        }
      }
    }
  }
  return null;
}

function findHandleSection(container, screenName) {
  return Array.from(container.querySelectorAll('div')).find(div => {
    const link = div.querySelector(`a[href="/${screenName}"]`);
    return link && link.textContent?.trim() === `@${screenName}`;
  });
}

function checkAndHideTweet(usernameElement, locationStr) {
  if (blockedCountries.length > 0 && locationStr) {
    const locationLower = locationStr.toLowerCase();
    const isBlocked = blockedCountries.some(country => locationLower.includes(country));
    
    if (isBlocked) {
      const tweetArticle = usernameElement.closest('article[data-testid="tweet"]');
      if (tweetArticle) {
        tweetArticle.style.display = 'none';
        tweetArticle.dataset.locationHidden = 'true';
        return true;
      }
    } else {
      const tweetArticle = usernameElement.closest('article[data-testid="tweet"]');
      if (tweetArticle && tweetArticle.dataset.locationHidden === 'true') {
        tweetArticle.style.display = '';
        delete tweetArticle.dataset.locationHidden;
      }
    }
  }
  return false;
}

function getTwemojiUrl(emoji) {
  const hex = Array.from(emoji).map(c => c.codePointAt(0).toString(16)).join('-');
  return `https://abs-0.twimg.com/emoji/v2/svg/${hex}.svg`;
}

async function addFlagToUsername(usernameElement, screenName) {
  if (usernameElement.dataset.flagAdded === 'true') return;
  if (processingUsernames.has(screenName)) {
    await new Promise(resolve => setTimeout(resolve, 500));
    if (usernameElement.dataset.flagAdded === 'true') return;
    usernameElement.dataset.flagAdded = 'waiting';
    return;
  }

  usernameElement.dataset.flagAdded = 'processing';
  processingUsernames.add(screenName);
  
  try {
    const location = await getUserLocation(screenName);
    
    if (checkAndHideTweet(usernameElement, location)) {
      usernameElement.dataset.flagAdded = 'true';
      return;
    }
    
    if (!location) {
      usernameElement.dataset.flagAdded = 'failed';
      return;
    }

    const flagEmoji = getCountryFlag(location);
    if (!flagEmoji) {
      usernameElement.dataset.flagAdded = 'failed';
      return;
    }
  
    const containerForFlag = usernameElement.querySelector('[data-testid="UserName"], [data-testid="User-Name"]');
    if (!containerForFlag) return;
    
    const existingFlag = containerForFlag.querySelector('[data-twitter-flag]');
    if (existingFlag) {
       usernameElement.dataset.flagAdded = 'true';
       return;
    }

    const flagSpan = document.createElement('span');
    flagSpan.setAttribute('data-twitter-flag', 'true');
    flagSpan.style.cssText = 'contain:layout style;margin:0 4px;display:inline-flex;align-items:center;vertical-align:middle;';
    flagSpan.title = location; 
    
    const flagImg = document.createElement('img');
    flagImg.src = getTwemojiUrl(flagEmoji);
    flagImg.alt = flagEmoji;
    flagImg.title = location;
    flagImg.style.height = '1.2em';
    flagImg.style.width = 'auto';
    flagImg.style.display = 'block';
    
    flagSpan.appendChild(flagImg);
    containerForFlag.appendChild(flagSpan);
    usernameElement.dataset.flagAdded = 'true';

  } catch (error) {
    usernameElement.dataset.flagAdded = 'failed';
  } finally {
    processingUsernames.delete(screenName);
  }
}

function removeAllFlags() {
  document.querySelectorAll('[data-twitter-flag]').forEach(e => e.remove());
  document.querySelectorAll('[data-flag-added]').forEach(e => {
    delete e.dataset.flagAdded;
    delete e.dataset.observing;
  });
  if (viewportObserver) viewportObserver.disconnect();
}

async function processUsernames() {
  if (!extensionEnabled) return;
  const containers = document.querySelectorAll('article[data-testid="tweet"], [data-testid="UserCell"], [data-testid="User-Names"], [data-testid="User-Name"]');
  for (const container of containers) {
    if (container.dataset.flagAdded || container.dataset.observing) continue;
    container.dataset.observing = 'true';
    viewportObserver.observe(container);
  }
}

function initObserver() {
  if (observer) observer.disconnect();
  observer = new MutationObserver((mutations) => {
    if (extensionEnabled && mutations.some(m => m.addedNodes.length > 0)) {
      setTimeout(processUsernames, 500);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

async function init() {
  await loadSettings();
  await loadCache();
  
  if (!extensionEnabled) return;
  
  injectPageScript();
  setTimeout(processUsernames, 2000);
  initObserver();
  
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      setTimeout(processUsernames, 2000);
    }
  }).observe(document, { subtree: true, childList: true });
  
  setInterval(saveCache, 30000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}