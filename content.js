const CLOUD_API_URL = 'https://twitter-countries-api.tnemoroccan.workers.dev';

// Cache Configuration
const CACHE_KEY = 'twitter_location_cache';
const CACHE_EXPIRY_DAYS = 30; 
const CACHE_STALE_DAYS = 90;
const CACHE_EXPIRY_NO_LOC_DAYS = 14;
const MAX_CACHE_SIZE = 5000; 

// State
let locationCache = new Map();
let hasUnsavedChanges = false;
const SUBMISSION_HISTORY_KEY = 'submission_history';
let submissionHistory = new Set();

// Queues
const cloudQueue = []; 
const twitterQueue = []; 
const queuedUsernames = new Set(); 
const submittedSessionCache = new Set(); 

// Concurrency & Timing
let isProcessingCloud = false;
let isProcessingTwitter = false;
let rateLimitResetTime = 0; 
let saveCacheTimeout = null;

// Observers
let observer = null;
const processingUsernames = new Set();

// Extension Settings
let extensionEnabled = true;
let blockedCountries = []; 
const TOGGLE_KEY = 'extension_enabled';
const BLOCKED_COUNTRIES_KEY = 'blocked_countries';
const DEFAULT_ENABLED = true;

const TARGET_SELECTORS = 'article[data-testid="tweet"], [data-testid="UserCell"], [data-testid="User-Names"], [data-testid="User-Name"]';

// --- CSS INJECTION (Performance) ---
function injectStyles() {
  if (document.getElementById('twitter-flags-style')) return;
  const style = document.createElement('style');
  style.id = 'twitter-flags-style';
  style.textContent = `
    .tf-flag {
      contain: layout style;
      margin: 0 4px;
      display: inline-flex;
      align-items: center;
      vertical-align: middle;
      height: 1.2em;
    }
    .tf-flag img {
      height: 1.2em;
      width: auto;
      display: block;
    }
  `;
  (document.head || document.documentElement).appendChild(style);
}

// --- CROSS-BROWSER HELPER ---
function isContextInvalid() {
  return !chrome.runtime?.id;
}

function storageGet(keys) {
  return new Promise((resolve) => {
    if (isContextInvalid()) return resolve({});
    if (typeof browser !== 'undefined' && browser.storage) {
      browser.storage.local.get(keys).then(resolve);
    } else {
      chrome.storage.local.get(keys, resolve);
    }
  });
}

function storageSet(data) {
  return new Promise((resolve) => {
    if (isContextInvalid()) return resolve();
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
    const result = await storageGet([TOGGLE_KEY, BLOCKED_COUNTRIES_KEY, SUBMISSION_HISTORY_KEY]);
    extensionEnabled = result[TOGGLE_KEY] !== undefined ? result[TOGGLE_KEY] : DEFAULT_ENABLED;
    
    if (result[BLOCKED_COUNTRIES_KEY]) {
      updateBlockedCountries(result[BLOCKED_COUNTRIES_KEY]);
    }
    if (result[SUBMISSION_HISTORY_KEY] && Array.isArray(result[SUBMISSION_HISTORY_KEY])) {
      submissionHistory = new Set(result[SUBMISSION_HISTORY_KEY]);
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
    if (isContextInvalid()) return;
    const storageResult = await storageGet(CACHE_KEY);
    if (storageResult[CACHE_KEY]) {
      const cachedDataMap = storageResult[CACHE_KEY];
      const currentTimeMs = Date.now();
      
      for (const [username, cacheEntry] of Object.entries(cachedDataMap)) {
        let locationName = null;
        let expirationTimestamp = 0;
        
        if (typeof cacheEntry === 'string' || cacheEntry === null) {
          locationName = cacheEntry;
          expirationTimestamp = currentTimeMs + (CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000); 
        } else {
          locationName = cacheEntry.location;
          expirationTimestamp = cacheEntry.expiry || 0;
        }

        const staleGracePeriodMs = (CACHE_STALE_DAYS - CACHE_EXPIRY_DAYS) * 24 * 60 * 60 * 1000;
        
        if (expirationTimestamp + staleGracePeriodMs > currentTimeMs) {
          locationCache.set(username, { location: locationName, expiry: expirationTimestamp });
        }
      }
      if (locationCache.size > MAX_CACHE_SIZE) cleanCache();
    }
  } catch (loadingError) {}
}

async function saveCache() {
  try {
    if (!hasUnsavedChanges || isContextInvalid()) return;
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
  if (isContextInvalid()) return;
  const now = Date.now();
  const days = location === null ? CACHE_EXPIRY_NO_LOC_DAYS : CACHE_EXPIRY_DAYS;
  const expiry = now + (days * 24 * 60 * 60 * 1000);
  locationCache.set(username, { location, expiry });
  hasUnsavedChanges = true; 
  
  if (locationCache.size > MAX_CACHE_SIZE + 100) cleanCache();
  
  if (saveCacheTimeout) clearTimeout(saveCacheTimeout);
  saveCacheTimeout = setTimeout(saveCache, 2000);
}

function cleanCache() {
  const currentTimeMs = Date.now();
  let expiredEntriesCount = 0;
  for (const [username, cacheEntry] of locationCache) {
    if (cacheEntry.expiry <= currentTimeMs) {
      locationCache.delete(username);
      expiredEntriesCount++;
    }
  }
  if (locationCache.size > MAX_CACHE_SIZE) {
    const entriesToRemoveCount = locationCache.size - MAX_CACHE_SIZE;
    const cacheKeysIterator = locationCache.keys();
    for (let i = 0; i < entriesToRemoveCount; i++) {
      locationCache.delete(cacheKeysIterator.next().value);
      expiredEntriesCount++;
    }
  }
  if (expiredEntriesCount > 0) hasUnsavedChanges = true;
}

window.addEventListener('pagehide', () => {
  if (hasUnsavedChanges) {
    if (saveCacheTimeout) clearTimeout(saveCacheTimeout);
    saveCache(); 
  }
  flushWriteBuffer();
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && hasUnsavedChanges) {
    if (saveCacheTimeout) clearTimeout(saveCacheTimeout);
    saveCache();
  }
});

function injectPageScript() {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('pageScript.js');
  script.setAttribute('data-extension-id', chrome.runtime.id); 
  script.onload = function() { this.remove(); };
  (document.head || document.documentElement).appendChild(script);
  
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (!event.data || event.data.target !== 'contentScript') return;
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

// BATCH WRITE OPTIMIZATION
let writeBuffer = [];
let writeTimer = null;
const BATCH_SIZE = 50; // Optimized for D1 Worker Limit
const BATCH_DELAY = 30000;

function flushWriteBuffer() {
  if (writeTimer) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }
  
  if (writeBuffer.length === 0) return;
  
  const batch = [...writeBuffer];
  writeBuffer = []; 

  fetch(`${CLOUD_API_URL}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(batch),
    keepalive: true
  }).catch(() => {});
}

function submitToCloud(username, location) {
  if (submittedSessionCache.has(username)) return;
  if (!location) return;

  if (submissionHistory.has(username)) return;

  if (locationCache.has(username)) {
    const cached = locationCache.get(username);
    if (cached.location === location) {
      submittedSessionCache.add(username);
      return;
    }
  }
  
  submittedSessionCache.add(username);
  submissionHistory.add(username);
  
  if (submissionHistory.size > 2000) {
    const it = submissionHistory.values();
    for (let i = 0; i < 500; i++) {
      submissionHistory.delete(it.next().value);
    }
  }
  
  // Debounced save for history
  storageSet({ [SUBMISSION_HISTORY_KEY]: Array.from(submissionHistory) });

  writeBuffer.push({ username, location });
  
  if (writeBuffer.length >= BATCH_SIZE) {
    flushWriteBuffer();
  } else if (!writeTimer) {
    writeTimer = setTimeout(flushWriteBuffer, BATCH_DELAY);
  }
}

// --- FAST LANE: CLOUD QUEUE ---

async function processCloudQueue() {
  if (isProcessingCloud || cloudQueue.length === 0) return;
  if (isContextInvalid()) return;
  
  isProcessingCloud = true;

  const requestBatch = [];
  // Increased batch size to 50 for Cloudflare D1 optimization
  while (cloudQueue.length > 0 && requestBatch.length < 50) {
    requestBatch.push(cloudQueue.shift());
  }

  if (requestBatch.length === 0) {
    isProcessingCloud = false;
    return;
  }

  const batchScreenNames = requestBatch.map(request => request.screenName);
  const uniqueScreenNames = [...new Set(batchScreenNames)];
  
  let cloudLocationMap = {};
  try {
    cloudLocationMap = await fetchFromCloud(uniqueScreenNames);
  } catch (fetchError) {}
  
  const requestsMissingFromCloud = [];

  for (const request of requestBatch) {
    const normalizedScreenName = request.screenName.toLowerCase();
    const locationFromCloud = cloudLocationMap[normalizedScreenName];
    
    if (locationFromCloud !== undefined) {
      saveCacheEntry(request.screenName, locationFromCloud); 
      if (request.resolve) request.resolve(locationFromCloud);
      queuedUsernames.delete(request.screenName);
    } else {
      if (request.resolve && request.resolve.length > 0) { 
        requestsMissingFromCloud.push(request);
      } else {
        queuedUsernames.delete(request.screenName);
      }
    }
  }

  if (requestsMissingFromCloud.length > 0) {
    requestsMissingFromCloud.forEach(request => twitterQueue.push(request));
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
  if (isContextInvalid()) return;
  
  const currentTimeSeconds = Math.floor(Date.now() / 1000);
  if (rateLimitResetTime > currentTimeSeconds) {
    const waitTimeMs = (rateLimitResetTime - currentTimeSeconds) * 1000;
    setTimeout(processTwitterQueue, Math.min(waitTimeMs, 30000));
    return;
  }

  isProcessingTwitter = true;

  const currentTwitterRequest = twitterQueue.shift();
  
  if (!currentTwitterRequest) {
    isProcessingTwitter = false;
    return;
  }

  try {
    const location = await makeLocationRequest(currentTwitterRequest.screenName);
    currentTwitterRequest.resolve(location);
    queuedUsernames.delete(currentTwitterRequest.screenName);
    
    if (location) submitToCloud(currentTwitterRequest.screenName, location);
    
    setTimeout(() => {
      isProcessingTwitter = false;
      processTwitterQueue();
    }, 1500);
    
  } catch (requestError) {
    currentTwitterRequest.reject(requestError);
    isProcessingTwitter = false;
    processTwitterQueue();
  }
}

function makeLocationRequest(screenName) {
  return new Promise((resolve, reject) => {
    const uniqueRequestId = Date.now() + Math.random();
    
    const locationResponseHandler = (event) => {
      if (event.source !== window) return;
      if (!event.data || event.data.target !== 'contentScript') return;
      
      if (event.data && 
          event.data.type === '__locationResponse' &&
          event.data.screenName === screenName && 
          event.data.requestId === uniqueRequestId) {
        window.removeEventListener('message', locationResponseHandler);
        const locationData = event.data.location;
        const isRateLimited = event.data.isRateLimited || false;
        
        if (!isRateLimited) {
          saveCacheEntry(screenName, locationData || null);
        }
        resolve(locationData || null);
      }
    };
    window.addEventListener('message', locationResponseHandler);
    window.postMessage({ type: '__fetchLocation', screenName, requestId: uniqueRequestId, target: 'pageScript' }, '*');
    
    setTimeout(() => {
      window.removeEventListener('message', locationResponseHandler);
      resolve(null);
    }, 10000);
  });
}

async function getUserLocation(screenName) {
  if (locationCache.has(screenName)) {
    const data = locationCache.get(screenName);
    const now = Date.now();
    
    if (now < data.expiry) {
      return data.location;
    }
    
    const staleLimit = data.expiry + ((CACHE_STALE_DAYS - CACHE_EXPIRY_DAYS) * 24 * 60 * 60 * 1000);
    if (now < staleLimit) {
      if (!queuedUsernames.has(screenName)) {
        queuedUsernames.add(screenName);
        cloudQueue.push({ screenName, resolve: () => {}, reject: () => {} });
        if (!isProcessingCloud) setTimeout(processCloudQueue, 100);
      }
      return data.location;
    }
    
    locationCache.delete(screenName);
  }
  
  if (queuedUsernames.has(screenName)) {
    return null; 
  }

  return new Promise((resolve, reject) => {
    queuedUsernames.add(screenName);
    cloudQueue.push({ screenName, resolve, reject });
    if (!isProcessingCloud) setTimeout(processCloudQueue, 100);
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
    
    if (containerForFlag.querySelector('[data-twitter-flag]')) {
       usernameElement.dataset.flagAdded = 'true';
       return;
    }

    const flagSpan = document.createElement('span');
    flagSpan.className = 'tf-flag'; // Use injected CSS class
    flagSpan.setAttribute('data-twitter-flag', 'true');
    flagSpan.title = location; 
    
    const flagImg = document.createElement('img');
    flagImg.src = getTwemojiUrl(flagEmoji);
    flagImg.alt = flagEmoji;
    flagImg.title = location;
    
    flagSpan.appendChild(flagImg);

    // Locate the specific handle element (leaf node) to append the flag next to it
    // This fixes the issue where the flag appears on a new line in post details
    let targetContainer = containerForFlag;
    const handleText = `@${screenName.toLowerCase()}`;
    const leafNodes = containerForFlag.querySelectorAll('*');
    
    for (const node of leafNodes) {
      if (node.children.length === 0 && node.textContent.toLowerCase().includes(handleText)) {
        if (node.parentElement) targetContainer = node.parentElement;
        break;
      }
    }
    
    targetContainer.appendChild(flagSpan);
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

function observeNode(node) {
   if (node.dataset.flagAdded || node.dataset.observing) return;
   node.dataset.observing = 'true';
   viewportObserver.observe(node);
}

async function processUsernames() {
  if (!extensionEnabled || isContextInvalid()) return;
  const containers = document.querySelectorAll(`${TARGET_SELECTORS}:not([data-observing="true"])`);
  for (let i = 0; i < containers.length; i++) {
    observeNode(containers[i]);
  }
}

function initObserver() {
  if (observer) observer.disconnect();
  
  observer = new MutationObserver((mutations) => {
    if (!extensionEnabled) return;
    
    for (let i = 0; i < mutations.length; i++) {
      const addedNodes = mutations[i].addedNodes;
      for (let j = 0; j < addedNodes.length; j++) {
        const node = addedNodes[j];
        if (node.nodeType !== 1) continue;

        if (node.matches(TARGET_SELECTORS)) {
          observeNode(node);
        } else {
          const children = node.querySelectorAll(TARGET_SELECTORS);
          for (let k = 0; k < children.length; k++) {
            observeNode(children[k]);
          }
        }
      }
    }
  });
  
  observer.observe(document.body, { 
    childList: true, 
    subtree: true 
  });
}

async function init() {
  await loadSettings();
  await loadCache();
  
  if (!extensionEnabled) return;
  
  injectStyles();
  
  const link = document.createElement('link');
  link.rel = 'preconnect';
  link.href = CLOUD_API_URL;
  document.head.appendChild(link);

  injectPageScript();
  
  // Wait a bit for Twitter to make some API calls first
  setTimeout(() => {
    if (!headersReady) {
      // Proactive Fallback: Construct valid headers from cookies if interception timed out
      // This ensures API calls work immediately even if the user is idle on load
      const getCookie = (name) => {
        const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
        return match ? match[2] : null;
      };
      
      const csrfToken = getCookie('ct0');
      // Standard Twitter Web Client Bearer Token (Static)
      const PUBLIC_BEARER = 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';

      if (csrfToken) {
        twitterHeaders = {
          'authorization': PUBLIC_BEARER,
          'x-csrf-token': csrfToken,
          'x-twitter-active-user': 'yes',
          'x-twitter-auth-type': 'OAuth2Session',
          'x-twitter-client-language': 'en',
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        };
        headersReady = true;
      } else {
        // Minimal fallback (will likely fail auth-gated endpoints but prevents crash)
        twitterHeaders = {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        };
        headersReady = true;
      }
    }
  }, 3000);

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    processUsernames();
  } else {
    document.addEventListener('DOMContentLoaded', processUsernames);
  }

  initObserver();
  
  let lastUrl = location.href;
  const navObserver = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      setTimeout(processUsernames, 100);
    }
  });
  navObserver.observe(document.head, { subtree: true, childList: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}