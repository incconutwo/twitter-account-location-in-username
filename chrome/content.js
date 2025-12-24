const CLOUD_API_URL = 'https://twitter-countries-api.tnemoroccan.workers.dev';
const CACHE_KEY = 'twitter_location_cache';
const CACHE_EXPIRY_DAYS = 30;
const CACHE_STALE_DAYS = 90;
const CACHE_EXPIRY_NO_LOC = 14;
const MAX_CACHE_SIZE = 5000;
const BATCH_SIZE = 50;

// State
let locationCache = new Map();
let submissionHistory = new Set();
let hasUnsavedChanges = false;
let saveCacheTimer = null;
let writeBuffer = [];
let writeTimer = null;

const cloudQueue = [];
const twitterQueue = [];
const queuedUsernames = new Set();
const submittedSessionCache = new Set();

let extensionEnabled = true;
let blockedCountries = [];
let verifiedOnlyMode = false;
let autoBlockMode = false;
let isProcessingCloud = false;
let isProcessingTwitter = false;
let rateLimitResetTime = 0;

// Observers
let observer = null;
const processingUsernames = new Set();

// Selectors
const TARGET_SELECTORS = 'article[data-testid="tweet"], [data-testid="UserCell"], [data-testid="User-Names"], [data-testid="User-Name"]';

// --- Utils ---

function isContextInvalid() {
  return !chrome.runtime?.id;
}

const storage = {
  get: (keys) => new Promise(resolve => {
    if (isContextInvalid()) return resolve({});
    if (typeof browser !== 'undefined' && browser.storage) {
      browser.storage.local.get(keys).then(resolve);
    } else {
      chrome.storage.local.get(keys, resolve);
    }
  }),
  set: (data) => new Promise(resolve => {
    if (isContextInvalid()) return resolve();
    if (typeof browser !== 'undefined' && browser.storage) {
      browser.storage.local.set(data).then(resolve);
    } else {
      chrome.storage.local.set(data, resolve);
    }
  })
};

function getTwemojiUrl(emoji) {
  const hex = Array.from(emoji).map(c => c.codePointAt(0).toString(16)).join('-');
  return `https://abs-0.twimg.com/emoji/v2/svg/${hex}.svg`;
}

// --- Init & Settings ---

async function loadSettings() {
  try {
    const res = await storage.get(['extension_enabled', 'blocked_countries', 'submission_history', 'verified_only_mode', 'auto_block_mode']);
    extensionEnabled = res.extension_enabled ?? true;
    submissionHistory = new Set(res.submission_history || []);
    verifiedOnlyMode = res.verified_only_mode ?? false;
    autoBlockMode = res.auto_block_mode ?? false;
    
    if (res.blocked_countries) {
      updateBlockedCountries(res.blocked_countries);
    }
  } catch (e) {}
}

function updateBlockedCountries(input) {
  if (!input) blockedCountries = [];
  else if (Array.isArray(input)) blockedCountries = input.map(s => s.toLowerCase());
  else blockedCountries = input.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
}

// --- Cache Management ---

async function loadCache() {
  try {
    const res = await storage.get(CACHE_KEY);
    if (!res[CACHE_KEY]) return;

    const now = Date.now();
    for (const [user, entry] of Object.entries(res[CACHE_KEY])) {
      const data = typeof entry === 'object' ? entry : { location: entry, expiry: 0 };
      if (typeof entry === 'string') data.expiry = now + (CACHE_EXPIRY_DAYS * 86400000);
      
      if (data.expiry > now - (CACHE_STALE_DAYS * 86400000)) {
        locationCache.set(user, data);
      }
    }
    if (locationCache.size > MAX_CACHE_SIZE) cleanCache();
  } catch (e) {}
}

function saveCacheEntry(username, location, verified = false) {
  if (isContextInvalid()) return;
  const days = location === null ? CACHE_EXPIRY_NO_LOC : CACHE_EXPIRY_DAYS;
  locationCache.set(username, { 
    location,
    verified,
    expiry: Date.now() + (days * 86400000) 
  });
  hasUnsavedChanges = true;
  
  if (locationCache.size > MAX_CACHE_SIZE + 100) cleanCache();
  if (saveCacheTimer) clearTimeout(saveCacheTimer);
  saveCacheTimer = setTimeout(flushCacheToDisk, 2000);
}

async function flushCacheToDisk() {
  if (!hasUnsavedChanges || isContextInvalid()) return;
  const exportObj = {};
  const now = Date.now();
  for (const [k, v] of locationCache) {
    if (v.expiry > now) exportObj[k] = v;
  }
  await storage.set({ [CACHE_KEY]: exportObj });
  hasUnsavedChanges = false;
}

function cleanCache() {
  const now = Date.now();
  let changed = false;

  for (const [k, v] of locationCache) {
    if (v.expiry <= now) {
      locationCache.delete(k);
      changed = true;
    }
  }

  if (locationCache.size > MAX_CACHE_SIZE) {
    const toRemove = locationCache.size - MAX_CACHE_SIZE;
    for (let i = 0; i < toRemove; i++) {
      locationCache.delete(locationCache.keys().next().value);
    }
    changed = true;
  }
  if (changed) hasUnsavedChanges = true;
}

// --- Cloud & Network ---

function flushWriteBuffer() {
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = null;
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

function submitToCloud(username, location, verified = false) {
  if (!location || submittedSessionCache.has(username) || submissionHistory.has(username)) return;
  
  const cached = locationCache.get(username);
  if (cached && cached.location === location && cached.verified === verified) {
    submittedSessionCache.add(username);
    return;
  }

  submittedSessionCache.add(username);
  submissionHistory.add(username);
  
  if (submissionHistory.size > 2000) {
    const iter = submissionHistory.values();
    for(let i=0; i<500; i++) submissionHistory.delete(iter.next().value);
  }
  
  storage.set({ submission_history: Array.from(submissionHistory) });
  
  writeBuffer.push({ username, location, verified });
  if (writeBuffer.length >= BATCH_SIZE) flushWriteBuffer();
  else if (!writeTimer) writeTimer = setTimeout(flushWriteBuffer, 30000);
}

// --- Logic Pipelines ---

async function processCloudQueue() {
  if (isProcessingCloud || cloudQueue.length === 0 || isContextInvalid()) return;
  isProcessingCloud = true;

  const batch = [];
  while (cloudQueue.length > 0 && batch.length < 50) batch.push(cloudQueue.shift());

  if (batch.length === 0) { isProcessingCloud = false; return; }

  const usernames = batch.map(x => x.screenName);
  let results = {};
  
  try {
    const res = await fetch(`${CLOUD_API_URL}/lookup?users=${encodeURIComponent(usernames.join(','))}`);
    if (res.ok) results = await res.json();
  } catch (e) {}

  const retryList = [];
  
  batch.forEach(req => {
    const userData = results[req.screenName.toLowerCase()];
    if (userData !== undefined) {
      // Cloud API now returns {location, verified} objects
      const location = typeof userData === 'object' ? userData.location : userData;
      const verified = typeof userData === 'object' ? userData.verified : false;
      
      // If verifiedOnlyMode is enabled and cloud doesn't have verified info, fall through to Twitter
      if (verifiedOnlyMode && typeof userData !== 'object') {
        retryList.push(req);
      } else {
        saveCacheEntry(req.screenName, location, verified);
        req.resolve({ location, verified });
        queuedUsernames.delete(req.screenName);
      }
    } else {
      retryList.push(req);
    }
  });

  if (retryList.length > 0) {
    retryList.forEach(req => twitterQueue.push(req));
    processTwitterQueue();
  }

  isProcessingCloud = false;
  if (cloudQueue.length > 0) setTimeout(processCloudQueue, 50);
}

async function processTwitterQueue() {
  if (isProcessingTwitter || twitterQueue.length === 0 || isContextInvalid()) return;

  const now = Math.floor(Date.now() / 1000);
  if (rateLimitResetTime > now) {
    setTimeout(processTwitterQueue, Math.min((rateLimitResetTime - now) * 1000, 30000));
    return;
  }

  isProcessingTwitter = true;
  const req = twitterQueue.shift();
  if (!req) { isProcessingTwitter = false; return; }

  try {
    const userData = await new Promise((resolve) => {
      const id = Date.now() + Math.random();
      const handler = (e) => {
        if (e.source !== window || !e.data || e.data.type !== '__userDataResponse' || e.data.requestId !== id) return;
        window.removeEventListener('message', handler);
        if (!e.data.isRateLimited) {
          saveCacheEntry(req.screenName, e.data.location, e.data.verified);
        }
        resolve({ location: e.data.location, verified: e.data.verified ?? false });
      };
      window.addEventListener('message', handler);
      window.postMessage({ type: '__fetchUserData', screenName: req.screenName, requestId: id, target: 'pageScript' }, '*');
      setTimeout(() => { window.removeEventListener('message', handler); resolve({ location: null, verified: false }); }, 10000);
    });

    req.resolve(userData);
    queuedUsernames.delete(req.screenName);
    if (userData.location) submitToCloud(req.screenName, userData.location, userData.verified);
    
    setTimeout(() => { isProcessingTwitter = false; processTwitterQueue(); }, 1500);
  } catch (e) {
    req.reject(e);
    isProcessingTwitter = false;
    processTwitterQueue();
  }
}

async function getUserData(screenName) {
  if (locationCache.has(screenName)) {
    const data = locationCache.get(screenName);
    if (Date.now() < data.expiry) {
      return { location: data.location, verified: data.verified ?? false };
    }
    locationCache.delete(screenName);
  }

  if (queuedUsernames.has(screenName)) return { location: null, verified: false };

  return new Promise((resolve, reject) => {
    queuedUsernames.add(screenName);
    cloudQueue.push({ screenName, resolve, reject });
    if (!isProcessingCloud) setTimeout(processCloudQueue, 100);
  });
}

// --- DOM & Visuals ---

function extractUsername(el) {
  const userNode = el.querySelector('[data-testid="User-Name"]');
  if (!userNode) return null;
  for (const link of userNode.querySelectorAll('a[href^="/"]')) {
    const m = link.getAttribute('href').match(/^\/([^\/\?]+)$/);
    if (m && !['home','explore','notifications','messages','search'].includes(m[1])) return m[1];
  }
  return null;
}

async function addFlagToUsername(container, screenName) {
  if (container.dataset.flagAdded === 'true' || processingUsernames.has(screenName)) return;
  processingUsernames.add(screenName);
  container.dataset.flagAdded = 'processing';

  try {
    // Request location AND verified status from pageScript
    const userData = await getUserData(screenName);
    const location = userData?.location;
    const isVerified = userData?.verified ?? false;
    
    if (blockedCountries.length && location) {
      const isBlocked = blockedCountries.some(c => location.toLowerCase().includes(c));
      
      // Check if we should filter this user
      const shouldFilter = isBlocked && (!verifiedOnlyMode || isVerified);
      
      if (shouldFilter) {
        const article = container.closest('article[data-testid="tweet"]');
        if (article) {
          article.style.display = 'none';
          article.dataset.locationHidden = 'true';
          container.dataset.flagAdded = 'true';
          
          // If auto-block is enabled, send block request
          if (autoBlockMode) {
            window.postMessage({ type: '__blockUser', screenName, target: 'pageScript' }, '*');
          }
          return;
        }
      }
    }

    const flag = getCountryFlag(location);
    if (!flag) {
      container.dataset.flagAdded = 'failed';
      return;
    }

    const nameNode = container.querySelector('[data-testid="User-Name"]');
    if (nameNode && !nameNode.querySelector('.tf-flag')) {
      const span = document.createElement('span');
      span.className = 'tf-flag';
      span.title = location;
      
      const img = document.createElement('img');
      img.src = getTwemojiUrl(flag);
      img.alt = flag;
      img.title = location;
      span.appendChild(img);
      
      let target = nameNode;
      const handle = `@${screenName.toLowerCase()}`;
      const leafs = nameNode.querySelectorAll('*');
      for (const node of leafs) {
        if (node.children.length === 0 && node.textContent.toLowerCase().includes(handle)) {
          if (node.parentElement) { target = node.parentElement; break; }
        }
      }
      target.appendChild(span);
      container.dataset.flagAdded = 'true';
    }
  } catch (e) {
    container.dataset.flagAdded = 'failed';
  } finally {
    processingUsernames.delete(screenName);
  }
}

const viewportObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      viewportObserver.unobserve(entry.target);
      const user = extractUsername(entry.target);
      if (user) addFlagToUsername(entry.target, user);
    }
  });
}, { rootMargin: '1000px' });

function scan() {
  if (!extensionEnabled || isContextInvalid()) return;
  document.querySelectorAll(`${TARGET_SELECTORS}:not([data-observing])`).forEach(el => {
    el.dataset.observing = 'true';
    viewportObserver.observe(el);
  });
}

// --- Main Init ---

async function init() {
  await loadSettings();
  await loadCache();
  if (!extensionEnabled) return;

  if (!document.getElementById('tf-style')) {
    const s = document.createElement('style');
    s.id = 'tf-style';
    s.textContent = `.tf-flag { contain: layout style; margin: 0 4px; display: inline-flex; align-items: center; vertical-align: middle; height: 1.2em; } .tf-flag img { height: 1.2em; width: auto; display: block; }`;
    (document.head || document.documentElement).appendChild(s);
  }

  const link = document.createElement('link');
  link.rel = 'preconnect'; link.href = CLOUD_API_URL;
  document.head.appendChild(link);

  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('pageScript.js');
  script.setAttribute('data-extension-id', chrome.runtime.id);
  script.onload = () => script.remove();
  (document.head || document.documentElement).appendChild(script);

  observer = new MutationObserver(scan);
  observer.observe(document.body, { childList: true, subtree: true });
  
  window.addEventListener('message', (e) => {
    if (e.source === window && e.data?.type === '__rateLimitInfo') {
      rateLimitResetTime = e.data.resetTime;
    }
  });
  
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'extensionToggle') {
      extensionEnabled = request.enabled;
      if (extensionEnabled) {
        setTimeout(() => { scan(); }, 500);
      } else {
        document.querySelectorAll('.tf-flag').forEach(e => e.remove());
        document.querySelectorAll('[data-location-hidden]').forEach(e => {
          e.style.display = ''; delete e.dataset.locationHidden;
        });
        if (viewportObserver) viewportObserver.disconnect();
      }
    } else if (request.type === 'blockedCountriesUpdate') {
      updateBlockedCountries(request.countries);
    } else if (request.type === 'verifiedOnlyUpdate') {
      verifiedOnlyMode = request.enabled;
    } else if (request.type === 'autoBlockUpdate') {
      autoBlockMode = request.enabled;
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

  scan();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();

window.addEventListener('pagehide', () => {
  if (saveCacheTimer) clearTimeout(saveCacheTimer);
  flushCacheToDisk();
  flushWriteBuffer();
});