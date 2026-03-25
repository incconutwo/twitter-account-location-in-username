const CLOUD_API_URL = 'https://twitter-countries-api.tnemoroccan.workers.dev';
const CACHE_KEY = 'twitter_location_cache';
const CACHE_EXPIRY_DAYS = 30;
const CACHE_STALE_DAYS = 90;
const CACHE_EXPIRY_NO_LOC = 14;
const MAX_CACHE_SIZE = 5000;
const BATCH_SIZE = 50;

// Update: Aggressive prefetching range (was 1000px)
const PREFETCH_MARGIN = '4000px'; 

// State
let locationCache = new Map();
let submissionHistory = new Set();
let hasUnsavedChanges = false;
let saveCacheTimer = null;
let writeBuffer = [];
let writeTimer = null;
let cloudQueueTimer = null;

const cloudQueue = [];
const twitterQueue = [];
const queuedUsernames = new Set();
const submittedSessionCache = new Set();

let extensionEnabled = true;
let blockedCountries = [];
let verifiedOnlyMode = false;
let autoBlockMode = false;
let passportMode = true; // Toggle for discovery notifications
let devDataSource = 'auto';
let isProcessingCloud = false;
let isProcessingTwitter = false;
let rateLimitResetTime = 0;

// Stats tracking (now primarily managed in background.js)
const STATS_KEY = 'extension_stats';
const TOTAL_COUNTRIES = 195; // UN recognized countries

// Toast notification state
let toastStylesInjected = false;
let discoveryQueue = [];
let isToastActive = false;

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

// getTwemojiUrl is now in countryFlags.js with pre-cached URLs

// --- Init & Settings ---

async function loadSettings() {
  try {
    // Request settings from background.js (centralized, avoids redundant storage reads)
    const settings = await new Promise((resolve) => {
      if (isContextInvalid()) return resolve({});
      chrome.runtime.sendMessage({ type: 'getSettings' }, (response) => {
        if (chrome.runtime.lastError) {
          resolve({});
        } else {
          resolve(response || {});
        }
      });
    });
    
    extensionEnabled = settings.extension_enabled ?? true;
    verifiedOnlyMode = settings.verified_only_mode ?? false;
    autoBlockMode = settings.auto_block_mode ?? false;
    passportMode = settings.passport_mode ?? true;
    devDataSource = settings.dev_data_source || 'auto';
    if (settings.blocked_countries) {
      updateBlockedCountries(settings.blocked_countries);
    }
    
    
    // Still need to load submission_history from local storage (per-tab data)
    const localData = await storage.get(['submission_history']);
    submissionHistory = new Set(localData.submission_history || []);
  } catch (e) {}
}

function incrementStat(statType) {
  if (isContextInvalid()) return;
  chrome.runtime.sendMessage({ type: 'incrementStat', statType });
}

function trackCountry(countryName, flag) {
  if (!countryName || !flag || isContextInvalid()) return;
  chrome.runtime.sendMessage({ type: 'countrySpotted', country: countryName, flag });
}

function injectToastStyles() {
  if (toastStylesInjected) return;
  toastStylesInjected = true;
  
  const style = document.createElement('style');
  style.textContent = `
    @keyframes tf-toast-slide-in {
      from { transform: translateY(-120%); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    @keyframes tf-toast-slide-out {
      from { transform: translateY(0); opacity: 1; }
      to { transform: translateY(-120%); opacity: 0; }
    }
    .tf-discovery-toast {
      position: fixed;
      top: 24px;
      right: 24px;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      border: 1px solid rgba(29, 155, 240, 0.3);
      border-radius: 16px;
      padding: 16px 20px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.05);
      z-index: 9999999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      animation: tf-toast-slide-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
      backdrop-filter: blur(12px);
      min-width: 280px;
    }
    .tf-discovery-toast.tf-toast-exit {
      animation: tf-toast-slide-out 0.3s ease-in forwards;
    }
    .tf-toast-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
      color: #1d9bf0;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .tf-toast-sparkle {
      font-size: 14px;
    }
    .tf-toast-country {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 10px;
    }
    .tf-toast-flag {
      font-size: 36px;
      line-height: 1;
      filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
    }
    .tf-toast-name {
      color: #e7e9ea;
      font-size: 18px;
      font-weight: 700;
      letter-spacing: -0.2px;
    }
    .tf-toast-progress {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .tf-toast-progress-bar {
      flex: 1;
      height: 6px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 3px;
      overflow: hidden;
    }
    .tf-toast-progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #1d9bf0, #1da1f2);
      border-radius: 3px;
      transition: width 0.3s ease;
    }
    .tf-toast-progress-text {
      color: #71767b;
      font-size: 13px;
      font-weight: 500;
      min-width: 55px;
      text-align: right;
    }
  `;
  document.head.appendChild(style);
}

function processDiscoveryQueue() {
  if (isToastActive || discoveryQueue.length === 0) return;
  
  isToastActive = true;
  const item = discoveryQueue.shift();
  showDiscoveryToast(item.countryName, item.flag, item.discoveredCount, item.total);
}

function showDiscoveryToast(countryName, flag, current, total) {
  injectToastStyles();
  
  // Remove any existing toast
  const existing = document.querySelector('.tf-discovery-toast');
  if (existing) existing.remove();
  
  const percentage = Math.round((current / total) * 100);
  const flagUrl = typeof getTwemojiUrl === 'function' ? getTwemojiUrl(flag) : null;
  
  const toast = document.createElement('div');
  toast.className = 'tf-discovery-toast';
  toast.innerHTML = `
    <div class="tf-toast-header">
      <span class="tf-toast-sparkle">✨</span>
      <span>New Country Discovered!</span>
    </div>
    <div class="tf-toast-country">
      <div class="tf-toast-flag">
        ${flagUrl ? `<img src="${flagUrl}" alt="${flag}" style="width:1em; height:1em; display:block;">` : flag}
      </div>
      <span class="tf-toast-name">${countryName}</span>
    </div>
    <div class="tf-toast-progress">
      <div class="tf-toast-progress-bar">
        <div class="tf-toast-progress-fill" style="width: ${percentage}%"></div>
      </div>
      <span class="tf-toast-progress-text">${current}/${total}</span>
    </div>
  `;
  
  document.body.appendChild(toast);
  
  // Auto-dismiss after 4 seconds, then wait 1s before next one (total 5s minimum per discovery)
  setTimeout(() => {
    toast.classList.add('tf-toast-exit');
    setTimeout(() => {
      toast.remove();
      isToastActive = false;
      // Small delay before next toast to feel less frantic
      setTimeout(processDiscoveryQueue, 1000);
    }, 300);
  }, 4000);
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
        if (devDataSource === 'cloudflare_only') {
          req.resolve({ location, verified: false });
          queuedUsernames.delete(req.screenName);
        } else {
          retryList.push(req);
        }
      } else {
        saveCacheEntry(req.screenName, location, verified);
        req.resolve({ location, verified });
        queuedUsernames.delete(req.screenName);
      }
    } else {
      if (devDataSource === 'cloudflare_only') {
         req.resolve({ location: null, verified: false });
         queuedUsernames.delete(req.screenName);
      } else {
         retryList.push(req);
      }
    }
  });

  if (retryList.length > 0) {
    retryList.forEach(req => twitterQueue.push(req));
    processTwitterQueue();
  }

  isProcessingCloud = false;
  if (cloudQueue.length > 0) queueMicrotask(processCloudQueue); // Immediate (was 50ms)
}

async function processTwitterQueue() {
  if (isProcessingTwitter || twitterQueue.length === 0 || isContextInvalid()) return;

  const now = Math.floor(Date.now() / 1000);
  if (rateLimitResetTime > now) {
    setTimeout(processTwitterQueue, Math.min((rateLimitResetTime - now) * 1000, 30000));
    return;
  }

  isProcessingTwitter = true;
  
  // Optimization: Increase parallelism to 6 (was 5) and reduce delay
  const PARALLEL_LIMIT = 6;
  const batch = [];
  while (twitterQueue.length > 0 && batch.length < PARALLEL_LIMIT) {
    batch.push(twitterQueue.shift());
  }
  
  if (batch.length === 0) { isProcessingTwitter = false; return; }

  const fetchUser = (req) => new Promise((resolve) => {
    // Optimization: Check cache again immediately before fetching
    // (Passive data might have arrived while in queue)
    const freshCache = locationCache.get(req.screenName);
    if (freshCache && freshCache.expiry > Date.now()) {
      req.resolve({ location: freshCache.location, verified: freshCache.verified });
      queuedUsernames.delete(req.screenName);
      return resolve();
    }

    const id = Date.now() + Math.random();
    let responded = false;
    
    const handler = (e) => {
      if (e.source !== window || !e.data || e.data.type !== '__userDataResponse' || e.data.requestId !== id) return;
      window.removeEventListener('message', handler);
      
      if (responded) return;
      responded = true;

      if (!e.data.isRateLimited) {
        saveCacheEntry(req.screenName, e.data.location, e.data.verified);
      }
      const userData = { location: e.data.location, verified: e.data.verified ?? false };
      req.resolve(userData);
      queuedUsernames.delete(req.screenName);
      if (userData.location) submitToCloud(req.screenName, userData.location, userData.verified);
      resolve();
    };
    
    window.addEventListener('message', handler);
    window.postMessage({ type: '__fetchUserData', screenName: req.screenName, requestId: id, target: 'pageScript' }, '*');
    
    // Optimization: Reduced timeout to 4s (was 5s) to fail fast and retry later
    setTimeout(() => { 
      if (responded) return;
      responded = true;
      setTimeout(() => {
        window.removeEventListener('message', handler);
        queuedUsernames.delete(req.screenName);
      }, 5000);
      req.resolve({ location: null, verified: false }); 
      resolve(); 
    }, 4000);
  });

  try {
    await Promise.all(batch.map(fetchUser));
    // Optimization: Reduced inter-batch delay to 100ms (was 250ms)
    setTimeout(() => { isProcessingTwitter = false; processTwitterQueue(); }, 100);
  } catch (e) {
    isProcessingTwitter = false;
    processTwitterQueue();
  }
}

async function getUserData(screenName) {
  if (devDataSource === 'twitter_only') {
    return new Promise((resolve, reject) => {
      queuedUsernames.add(screenName);
      twitterQueue.push({ screenName, resolve, reject });
      processTwitterQueue();
    });
  }

  if (locationCache.has(screenName)) {
    const data = locationCache.get(screenName);
    if (Date.now() < data.expiry) {
      return { location: data.location, verified: data.verified ?? false };
    }
    locationCache.delete(screenName);
  }

  if (devDataSource === 'cache_only') {
    return { location: null, verified: false };
  }

  if (queuedUsernames.has(screenName)) return { location: null, verified: false };

  return new Promise((resolve, reject) => {
    queuedUsernames.add(screenName);
    cloudQueue.push({ screenName, resolve, reject });
    // Accumulate for 50ms window then fire one batch
    if (!isProcessingCloud && !cloudQueueTimer) {
      cloudQueueTimer = setTimeout(() => {
        cloudQueueTimer = null;
        processCloudQueue();
      }, 50);
    }
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
          incrementStat('hidden'); // Track hidden posts
          
          // If auto-block is enabled, send block request
          if (autoBlockMode) {
            window.postMessage({ type: '__blockUser', screenName, target: 'pageScript' }, '*');
            incrementStat('blocked'); // Track blocked accounts
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
    
    // Track this country for the dashboard (non-blocking)
    // Pass resolved country name + flag directly to avoid duplicate lookup
    try {
      const countryName = resolveCountryName(location);
      if (countryName) trackCountry(countryName, COUNTRY_FLAGS[countryName]);
    } catch (e) {
      // Silently fail - tracking shouldn't break flag display
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
      if (user) {
        // Optimization: Immediate check vs Async check to render faster if cached
        if (locationCache.has(user)) {
           addFlagToUsername(entry.target, user);
        } else {
           // Queue microtask to avoid blocking scroll thread
           queueMicrotask(() => addFlagToUsername(entry.target, user));
        }
      }
    }
  });
}, { rootMargin: PREFETCH_MARGIN });

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

  // Preconnect to Cloud API and Twemoji CDN for faster loading
  const preconnectCloud = document.createElement('link');
  preconnectCloud.rel = 'preconnect'; preconnectCloud.href = CLOUD_API_URL;
  document.head.appendChild(preconnectCloud);
  
  const preconnectTwemoji = document.createElement('link');
  preconnectTwemoji.rel = 'preconnect'; preconnectTwemoji.href = 'https://abs-0.twimg.com';
  preconnectTwemoji.crossOrigin = 'anonymous';
  document.head.appendChild(preconnectTwemoji);

  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('pageScript.js');
  script.setAttribute('data-extension-id', chrome.runtime.id);
  script.onload = () => script.remove();
  (document.head || document.documentElement).appendChild(script);

  // Debounced MutationObserver to prevent excessive scan() calls during rapid scrolling
  let scanTimer = null;
  observer = new MutationObserver(() => {
    if (scanTimer) return;
    scanTimer = requestAnimationFrame(() => {
      scan();
      scanTimer = null;
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
  
  window.addEventListener('message', (e) => {
    if (e.source !== window) return;

    if (e.data?.type === '__passiveData' && Array.isArray(e.data.users)) {
      // Bulk cache update from timeline data
      e.data.users.forEach(u => {
        if (u && u.screen_name) {
          // Only save if verified or has location (optimization)
          if (u.location || u.verified) {
            saveCacheEntry(u.screen_name, u.location || null, u.verified);
            // If we have a location, optimistically send to cloud
            if (u.location) submitToCloud(u.screen_name, u.location, u.verified);
          }
        }
      });
      return;
    }

    if (e.data?.type === '__rateLimitInfo') {
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
    } else if (request.type === 'settingsUpdate') {
      // Handle centralized settings broadcast from background.js
      const settings = request.settings;
      extensionEnabled = settings.extension_enabled ?? extensionEnabled;
      verifiedOnlyMode = settings.verified_only_mode ?? verifiedOnlyMode;
      autoBlockMode = settings.auto_block_mode ?? autoBlockMode;
      passportMode = settings.passport_mode ?? passportMode;
      devDataSource = settings.dev_data_source || devDataSource;
      if (settings.blocked_countries) {
        updateBlockedCountries(settings.blocked_countries);
      }
    } else if (request.type === 'devDataSourceUpdate') {
      devDataSource = request.source;
    } else if (request.type === 'showDiscoveryToast' && passportMode) {
      const { countryName, flag, discoveredCount, total } = request;
      discoveryQueue.push({ countryName, flag, discoveredCount, total });
      processDiscoveryQueue();
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