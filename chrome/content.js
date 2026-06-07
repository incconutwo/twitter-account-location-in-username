// ─────────────────────────────────────────────────────────────
//  Config
// ─────────────────────────────────────────────────────────────
const API_ENDPOINT = 'https://twitter-countries-api.tnemoroccan.workers.dev';
const EXPIRY_DAYS       = 30;
const STALE_WINDOW_DAYS = 90;
const EXPIRY_EMPTY_DAYS = 14;
const STORE_LIMIT       = 5000;
const MEMORY_CACHE_LIMIT = 500;
const CLOUD_BATCH_MAX   = 50;
const MISS_TTL          = 1800_000;      // 30 min cooldown for failed/not found users
const DRAIN_INTERVAL    = 60;            // ms – micro-batch MutationObserver events
const TWITTER_PARALLEL  = 1;
const TWITTER_STAGGER_MS = 3000; // Paced delay between Twitter lookup batches to prevent 429 rate limits
const LAZY_DELAY_MS     = 400;  // Debounce: ignore elements scrolled past quickly
const SUBMIT_FLUSH_MS   = 30_000;        // auto-flush cloud submissions
const CLOCK_TICK_MS     = 60_000;        // local-time refresh interval
const COUNTRY_TOTAL     = 195;
const NEGATIVE_MAP_CAP  = 2000;          // max negative cache entries
const CLOUD_BACKOFF_BASE = 1000;         // base backoff ms for cloud failures
const CLOUD_BACKOFF_MAX  = 60_000;       // max backoff ms

const ELEMENT_SELECTORS =
  'article[data-testid="tweet"], [data-testid="UserCell"], [data-testid="User-Names"], [data-testid="User-Name"]';

// ─────────────────────────────────────────────────────────────
//  State
// ─────────────────────────────────────────────────────────────
let enabled         = true;
let filteredRegions = [];
let onlyVerified    = false;
let autoFilter      = false;
let discoveryOn     = true;
let devDataSource   = 'auto';
let devShowSourceBanner = false;
let alwaysLoadComments = false;
let rateLimitUntil  = 0;

// Queues / flags
let cloudBusy       = false;
let twitterBusy     = false;
let cloudBatchTimer = null;
let cloudFailCount  = 0;               // consecutive cloud failures for backoff
let cloudBackoffUntil = 0;             // timestamp until which cloud requests are paused

const dataMap          = new Map();  // screenName → { location, verified, timezone, expiry }
const negativeMap      = new Map();  // screenName → expiryTs
const flightMap        = new Map();  // screenName → Promise  (dedup concurrent fetches)
const cloudPending     = [];         // { screenName, resolve, reject }
const twitterPending   = [];         // { screenName, resolve, reject }
const submitBuffer     = [];
let   submitTimer      = null;
const submittedSession = new Set();
let   submittedHistory = new Set();
let   watcherRef       = null;       // MutationObserver handle

// Visibility queue
let   watched    = new WeakSet();
const lazyTimers = new WeakMap();  // element → setTimeout id (scroll debounce)
const viewport   = new IntersectionObserver(onVisible, { rootMargin: '50px 0px 200px 0px' });

// Toast
let toastCSSReady = false;
let toastQueue    = [];
let toastBusy     = false;

let milestoneToastQueue = [];
let milestoneToastBusy  = false;

// Tooltip
let tip = null;

// ─────────────────────────────────────────────────────────────
//  Storage adapter (Chrome / Firefox)
// ─────────────────────────────────────────────────────────────
function gone() { return !chrome.runtime?.id; }

async function fetchWithTimeout(resource, options = {}) {
  const { timeout = 8000, ...rest } = options;
  return fetch(resource, { ...rest, signal: AbortSignal.timeout(timeout) });
}

const storage = typeof browser !== 'undefined' ? browser.storage.local : chrome.storage.local;
const disk = {
  read: async (keys) => gone() ? {} : storage.get(keys),
  write: async (obj) => { if (!gone()) await storage.set(obj); }
};

// ─────────────────────────────────────────────────────────────
//  DataStore — cache, eviction, disk flush, cloud submit
// ─────────────────────────────────────────────────────────────
// IndexedDB Cache Wrapper
const DB_NAME = 'TwitterLocationCacheDB';
const STORE_NAME = 'locations';
const DB_VERSION = 1;

let dbInstance = null;

function getDB() {
  if (dbInstance) return Promise.resolve(dbInstance);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'username' });
      }
    };
    request.onsuccess = (e) => {
      dbInstance = e.target.result;
      resolve(dbInstance);
    };
    request.onerror = (e) => {
      reject(e.target.error);
    };
  });
}

async function dbGet(username) {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const txn = db.transaction(STORE_NAME, 'readonly');
      const store = txn.objectStore(STORE_NAME);
      const req = store.get(username.toLowerCase());
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch (_) {
    return null;
  }
}

async function dbSet(username, data) {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const txn = db.transaction(STORE_NAME, 'readwrite');
      const store = txn.objectStore(STORE_NAME);
      const req = store.put({ username: username.toLowerCase(), ...data });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (_) {}
}


async function dbDeleteBatch(usernames) {
  if (!usernames || usernames.length === 0) return;
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const txn = db.transaction(STORE_NAME, 'readwrite');
      const store = txn.objectStore(STORE_NAME);
      for (const u of usernames) {
        store.delete(u.toLowerCase());
      }
      txn.oncomplete = () => resolve();
      txn.onerror = () => reject(txn.error);
    });
  } catch (_) {}
}

async function dbClear() {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const txn = db.transaction(STORE_NAME, 'readwrite');
      const store = txn.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (_) {}
}

async function hydrate() {
  try {
    const db = await getDB();
    const now = Date.now();
    const staleEdge = now - STALE_WINDOW_DAYS * 86_400_000;
    const toDelete = [];
    
    return new Promise((resolve) => {
      const txn = db.transaction(STORE_NAME, 'readonly');
      const store = txn.objectStore(STORE_NAME);
      const request = store.openCursor();
      
      request.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          const entry = cursor.value;
          if (entry.expiry <= staleEdge) {
            toDelete.push(entry.username);
          }
          cursor.continue();
        } else {
          if (toDelete.length > 0) {
            dbDeleteBatch(toDelete).then(() => resolve());
          } else {
            resolve();
          }
        }
      };
      request.onerror = () => resolve();
    });
  } catch (_) {}
}

function record(username, location, verified = false, apiTz = null, isRegion = false) {
  if (gone()) return;
  const userKey = username.toLowerCase();
  const existing = dataMap.get(userKey);

  let finalLocation = location;
  let finalVerified = verified;
  let finalIsRegion = isRegion;
  let finalTz = apiTz;

  if (existing) {
    const newIsInvalid = location && !getCountryFlag(location);
    const existingIsValid = existing.location && getCountryFlag(existing.location);
    const existingIsNull = existing.location === null;

    if (newIsInvalid && (existingIsValid || existingIsNull)) {
      finalLocation = existing.location;
      finalIsRegion = existing.isRegion;
      if (!finalTz) finalTz = existing.timezone;
    }
    finalVerified = verified || existing.verified;
  }

  const days = finalLocation === null ? EXPIRY_EMPTY_DAYS : EXPIRY_DAYS;
  const tz   = (finalLocation ? resolveTimezone(finalLocation) : null) || finalTz || null;
  const entry = { location: finalLocation, verified: finalVerified, timezone: tz, isRegion: finalIsRegion, expiry: Date.now() + days * 86_400_000 };
  
  dataMap.set(userKey, entry);
  dbSet(userKey, entry);
  
  evict();
}

function evict() {
  // Prune the in-memory Map cache only (does not delete from persistent IndexedDB)
  const now = Date.now();
  for (const [k, v] of dataMap) {
    if (v.expiry <= now) {
      dataMap.delete(k);
    }
  }
  if (dataMap.size > MEMORY_CACHE_LIMIT) {
    let drop = dataMap.size - MEMORY_CACHE_LIMIT;
    for (const k of dataMap.keys()) {
      if (drop-- <= 0) break;
      dataMap.delete(k);
    }
  }
}

// Cloud submission batching
function enqueueSubmission(username, location, verified = false) {
  if (!location || submittedSession.has(username) || submittedHistory.has(username)) return;
  const cached = dataMap.get(username);
  if (cached && cached.location === location && cached.verified === verified) {
    submittedSession.add(username);
    return;
  }
  submittedSession.add(username);
  submittedHistory.add(username);
  if (submittedHistory.size > 2000) {
    const it = submittedHistory.values();
    for (let i = 0; i < 500; i++) submittedHistory.delete(it.next().value);
  }
  disk.write({ submission_history: Array.from(submittedHistory) });
  submitBuffer.push({ username, location, verified });
  if (submitBuffer.length >= CLOUD_BATCH_MAX) drainSubmissions();
  else if (!submitTimer) submitTimer = setTimeout(drainSubmissions, SUBMIT_FLUSH_MS);
}

function drainSubmissions() {
  if (submitTimer) clearTimeout(submitTimer);
  submitTimer = null;
  if (submitBuffer.length === 0) return;
  const chunk = submitBuffer.splice(0);
  fetch(`${API_ENDPOINT}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(chunk),
    keepalive: true
  }).catch(() => {});
}

// ─────────────────────────────────────────────────────────────
//  FetchPipeline — cloud-first, Twitter fallback, promise-sharing
// ─────────────────────────────────────────────────────────────
async function fetchLocation(screenName, cacheOnly = false) {
  const userKey = screenName.toLowerCase();
  
  // Hot cache hit
  const hot = dataMap.get(userKey);
  if (hot && Date.now() < hot.expiry) {
    if (hot.location && !getCountryFlag(hot.location)) {
      // Bypass invalid manual location in hot cache
    } else {
      return { location: hot.location, verified: hot.verified ?? false, timezone: hot.timezone ?? null, isRegion: hot.isRegion ?? false, source: 'cache' };
    }
  }
  if (hot) dataMap.delete(userKey);

  if (cacheOnly || devDataSource === 'cache_only') {
    const dbVal = await dbGet(userKey);
    if (dbVal && Date.now() < dbVal.expiry) {
      if (dbVal.location && !getCountryFlag(dbVal.location)) {
        // Bypass invalid manual location in cold cache
      } else {
        if (!dbVal.timezone && dbVal.location) {
          dbVal.timezone = resolveTimezone(dbVal.location);
        }
        dataMap.set(userKey, dbVal);
        if (dataMap.size > MEMORY_CACHE_LIMIT) {
          dataMap.delete(dataMap.keys().next().value);
        }
        return { location: dbVal.location, verified: dbVal.verified ?? false, timezone: dbVal.timezone ?? null, isRegion: dbVal.isRegion ?? false, source: 'cache' };
      }
    }
    return { location: null, verified: false, timezone: null };
  }

  // Cold IndexedDB cache hit
  const dbVal = await dbGet(userKey);
  if (dbVal && Date.now() < dbVal.expiry) {
    if (dbVal.location && !getCountryFlag(dbVal.location)) {
      // Bypass invalid manual location in cold cache
    } else {
      if (!dbVal.timezone && dbVal.location) {
        dbVal.timezone = resolveTimezone(dbVal.location);
      }
      dataMap.set(userKey, dbVal);
      if (dataMap.size > MEMORY_CACHE_LIMIT) {
        dataMap.delete(dataMap.keys().next().value);
      }
      return { location: dbVal.location, verified: dbVal.verified ?? false, timezone: dbVal.timezone ?? null, isRegion: dbVal.isRegion ?? false, source: 'cache' };
    }
  }

  // Negative guard
  const neg = negativeMap.get(userKey);
  if (neg && Date.now() < neg) return { location: null, verified: false, timezone: null };

  // Dedup – piggyback on in-flight request
  if (flightMap.has(userKey)) return flightMap.get(userKey);

  if (devDataSource === 'twitter_only') {
    const ticket = new Promise((resolve, reject) => {
      twitterPending.push({ screenName: userKey, resolve, reject });
      drainTwitter();
    }).then(result => {
      if (!result?.location) negativeMap.set(userKey, Date.now() + MISS_TTL);
      flightMap.delete(userKey);
      return result;
    });
    flightMap.set(userKey, ticket);
    return ticket;
  }

  const ticket = new Promise((resolve, reject) => {
    cloudPending.push({ screenName: userKey, resolve, reject });
    if (!cloudBusy && !cloudBatchTimer) {
      cloudBatchTimer = setTimeout(() => { cloudBatchTimer = null; drainCloud(); }, 50);
    }
  }).then(result => {
    if (!result?.location) negativeMap.set(userKey, Date.now() + MISS_TTL);
    flightMap.delete(userKey);
    return result;
  });

  flightMap.set(userKey, ticket);
  return ticket;
}

async function drainCloud() {
  if (cloudBusy || cloudPending.length === 0 || gone()) return;

  // Respect backoff timer
  const now = Date.now();
  if (cloudBackoffUntil > now) {
    setTimeout(drainCloud, Math.min(cloudBackoffUntil - now, CLOUD_BACKOFF_MAX));
    return;
  }

  cloudBusy = true;
  const batch = cloudPending.splice(0, CLOUD_BATCH_MAX);
  const names = batch.map(r => r.screenName);
  let results = {};
  let cloudOk = false;

  try {
    const res = await fetchWithTimeout(`${API_ENDPOINT}/lookup?users=${encodeURIComponent(names.join(','))}`, {
      method: 'GET',
      timeout: 6000
    });
    if (res.ok) {
      results = await res.json();
      cloudOk = true;
      cloudFailCount = 0; // Reset backoff on success
    } else if (res.status === 429) {
      // Cloudflare rate limited — pause for Retry-After or 60s
      const retryAfter = parseInt(res.headers.get('Retry-After') || '60', 10);
      cloudBackoffUntil = Date.now() + retryAfter * 1000;
      cloudFailCount++;
    } else {
      cloudFailCount++;
    }
  } catch (_) {
    cloudFailCount++;
  }

  // If cloud failed entirely, apply exponential backoff and fall through to Twitter
  if (!cloudOk && cloudFailCount > 0) {
    const backoff = Math.min(CLOUD_BACKOFF_BASE * Math.pow(2, cloudFailCount - 1), CLOUD_BACKOFF_MAX);
    cloudBackoffUntil = Math.max(cloudBackoffUntil, Date.now() + backoff);
  }

  const retry = [];
  for (const req of batch) {
    const payload = results[req.screenName.toLowerCase()];
    if (payload !== undefined) {
      const loc  = typeof payload === 'object' ? payload.location : payload;
      
      // Check if the location resolved from Cloud is invalid (cannot be mapped to a country flag)
      const isInvalidLoc = loc && !getCountryFlag(loc);

      if (isInvalidLoc) {
        if (devDataSource === 'cloudflare_only') {
          req.resolve({ location: null, verified: false });
        } else {
          retry.push(req);
        }
      } else {
        // Cloud D1 doesn't reliably store verified — preserve any true from passive snooping
        const cloudVer = typeof payload === 'object' ? payload.verified : false;
        const cachedVer = dataMap.get(req.screenName)?.verified ?? false;
        const ver  = cloudVer || cachedVer;
        const aTz  = typeof payload === 'object' ? payload.timezone : null;
        if (onlyVerified && typeof payload !== 'object') {
          if (devDataSource === 'cloudflare_only') {
            const storedTz = dataMap.get(req.screenName)?.timezone ?? null;
            req.resolve({ location: loc, verified: false, timezone: storedTz, isRegion: false, source: 'cloudflare' });
          } else {
            retry.push(req);
          }
        } else {
          record(req.screenName, loc, ver, aTz);
          const storedTz = dataMap.get(req.screenName)?.timezone ?? null;
          req.resolve({ location: loc, verified: ver, timezone: storedTz, isRegion: false, source: 'cloudflare' });
        }
      }
    } else {
      if (devDataSource === 'cloudflare_only') {
        req.resolve({ location: null, verified: false });
      } else {
        retry.push(req);
      }
    }
  }

  if (retry.length > 0) {
    for (const r of retry) twitterPending.push(r);
    drainTwitter();
  }
  cloudBusy = false;
  if (cloudPending.length > 0) queueMicrotask(drainCloud);
}

async function drainTwitter() {
  if (twitterBusy || twitterPending.length === 0 || gone()) return;
  const now = Math.floor(Date.now() / 1000);
  if (rateLimitUntil > now) {
    setTimeout(drainTwitter, Math.min((rateLimitUntil - now) * 1000, 30_000));
    return;
  }
  twitterBusy = true;
  const batch = twitterPending.splice(0, TWITTER_PARALLEL);
  if (batch.length === 0) { twitterBusy = false; return; }

  const fetchOne = (req) => new Promise(done => {
    // Re-check cache (passive data may have arrived while queued)
    const fresh = dataMap.get(req.screenName);
    if (fresh && fresh.expiry > Date.now()) {
      if (fresh.location && !getCountryFlag(fresh.location)) {
        // Bypass invalid manual location in re-check
      } else {
        req.resolve({ location: fresh.location, verified: fresh.verified, timezone: fresh.timezone ?? null, isRegion: fresh.isRegion ?? false, source: 'cache' });
        flightMap.delete(req.screenName);
        return done();
      }
    }
    const rid = Date.now() + Math.random();
    let settled = false;
    const onReply = (e) => {
      if (e.source !== window || e.data?.type !== '__userDataResponse' || e.data.requestId !== rid) return;
      window.removeEventListener('message', onReply);
      if (settled) return;
      settled = true;
      if (!e.data.isRateLimited) record(req.screenName, e.data.location, e.data.verified, null, e.data.is_region);
      const tz = dataMap.get(req.screenName)?.timezone ?? null;
      const result = { location: e.data.location, verified: e.data.verified ?? false, timezone: tz, isRegion: e.data.is_region, source: 'twitter' };
      req.resolve(result);
      flightMap.delete(req.screenName);
      if (result.location) enqueueSubmission(req.screenName, result.location, result.verified);
      done();
    };
    window.addEventListener('message', onReply);
    window.postMessage({ type: '__fetchUserData', screenName: req.screenName, requestId: rid, target: 'pageScript' }, window.location.origin);
    setTimeout(() => {
      if (settled) return;
      settled = true;
      setTimeout(() => { window.removeEventListener('message', onReply); flightMap.delete(req.screenName); }, 5000);
      req.resolve({ location: null, verified: false });
      done();
    }, 4000);
  });

  try {
    await Promise.all(batch.map(fetchOne));
    // 300ms gap between batches to prevent hammering the local twitter API
    setTimeout(() => { twitterBusy = false; drainTwitter(); }, TWITTER_STAGGER_MS);
  } catch (_) {
    twitterBusy = false;
    setTimeout(drainTwitter, TWITTER_STAGGER_MS);
  }
}

// ─────────────────────────────────────────────────────────────
//  Renderer — flag injection, sync path, pending queue
// ─────────────────────────────────────────────────────────────
function findHandle(container) {
  const nameWrap = container.querySelector('[data-testid="User-Name"]');
  if (!nameWrap) return null;
  for (const a of nameWrap.querySelectorAll('a[href^="/"]')) {
    const m = a.getAttribute('href').match(/^\/([^\/\?]+)$/);
    if (m && !['home','explore','notifications','messages','search'].includes(m[1])) return m[1];
  }
  // Fallback: search for text containing "@username"
  const text = nameWrap.textContent;
  const match = text.match(/@([a-zA-Z0-9_]{1,15})/);
  if (match) return match[1];
  return null;
}

async function processNode(container, screenName) {
  const currentHandle = container.dataset.tfHandle;
  if (currentHandle && currentHandle !== screenName) {
    // DOM Node Recycled! Clean up previous state to prevent visual leaks
    container.querySelectorAll('.tf-flag').forEach(el => el.remove());
    const article = container.closest('article[data-testid="tweet"]');
    if (article) {
      article.style.display = '';
      delete article.dataset.locationHidden;
    }
    delete container.dataset.tfDone;
  }
  
  container.dataset.tfHandle = screenName;

  if (container.dataset.tfDone === '1') return;
  container.dataset.tfDone = 'working';

  try {
    const isStatusPage = window.location.pathname.includes('/status/');
    const isMainAuthor = isStatusPage && window.location.pathname.toLowerCase().startsWith('/' + screenName.toLowerCase() + '/status/');
    const cacheOnly = isStatusPage && !isMainAuthor && !alwaysLoadComments;

    const data = await fetchLocation(screenName, cacheOnly);
    
    // Ensure the node hasn't been recycled while fetch was in-flight
    if (container.dataset.tfHandle !== screenName) return;

    const loc  = data?.location;
    const ver  = data?.verified ?? false;
    const tz   = data?.timezone ?? null;
    const reg  = data?.isRegion ?? false;

    // Blocked-region filter
    if (filteredRegions.length && loc) {
      const lc = loc.toLowerCase();
      const blocked  = filteredRegions.some(r => lc.includes(r));
      const doFilter = blocked && (!onlyVerified || ver);
      if (doFilter) {
        const article = container.closest('article[data-testid="tweet"]');
        if (article) {
          article.style.display = 'none';
          article.dataset.locationHidden = 'true';
          container.dataset.tfDone = '1';
          bumpStat('hidden');
          if (autoFilter) {
            window.postMessage({ type: '__blockUser', screenName, target: 'pageScript' }, window.location.origin);
            bumpStat('blocked');
          }
          return;
        }
      }
    }

    const emoji = getCountryFlag(loc);
    if (!emoji) { container.dataset.tfDone = 'miss'; return; }

    // Track country for dashboard
    try {
      const cName = resolveCountryName(loc);
      if (cName) spotCountry(cName, COUNTRY_FLAGS[cName]);
    } catch (_) {}

    const nameWrap = container.querySelector('[data-testid="User-Name"]');
    if (!nameWrap || nameWrap.querySelector('.tf-flag')) { container.dataset.tfDone = '1'; return; }

    const badge = document.createElement('span');
    badge.className = 'tf-flag';
    badge.setAttribute('data-tf-tip', loc);

    const img = document.createElement('img');
    img.src = getTwemojiUrl(emoji);
    img.alt = emoji;
    badge.appendChild(img);

    if (tz) {
      const ts = getLocalTimeString(tz);
      if (ts) {
        const clock = document.createElement('span');
        clock.className = 'tf-time';
        clock.dataset.tz = tz;
        const h = getLocalHour(tz);
        clock.textContent = (h !== null && (h >= 22 || h < 6) ? '🌙 ' : '') + ts;
        badge.appendChild(clock);
        badge.setAttribute('data-tf-tip', `${loc} (${tz} • ${ts})`);
      }
    }

    if (reg) {
      const warn = document.createElement('span');
      warn.textContent = ' ⚠️';
      warn.style.fontSize = '0.8em';
      warn.style.cursor = 'help';
      badge.appendChild(warn);
      const currentTip = badge.getAttribute('data-tf-tip');
      badge.setAttribute('data-tf-tip', `${currentTip} (Approximate)`);
    }

    if (devShowSourceBanner && data?.source) {
      const srcTag = document.createElement('span');
      srcTag.className = 'tf-source-tag';
      srcTag.textContent = data.source;
      if (data.source === 'cache') srcTag.style.background = '#666';
      else if (data.source === 'cloudflare') srcTag.style.background = '#f6821f';
      else if (data.source === 'twitter') srcTag.style.background = '#1d9bf0';
      badge.appendChild(srcTag);
    }

    // Find insertion point — next to the @handle
    let anchor = nameWrap;
    const handle = `@${screenName.toLowerCase()}`;
    for (const leaf of nameWrap.querySelectorAll('*')) {
      if (leaf.children.length === 0 && leaf.textContent.toLowerCase().includes(handle)) {
        if (leaf.parentElement) { anchor = leaf.parentElement; break; }
      }
    }
    anchor.appendChild(badge);
    container.dataset.tfDone = '1';
  } catch (_) {
    container.dataset.tfDone = 'miss';
  }
}

// ─────────────────────────────────────────────────────────────
//  Tooltip — single delegated listener
// ─────────────────────────────────────────────────────────────
function attachTooltip() {
  document.body.addEventListener('mouseover', (e) => {
    const flag = e.target.closest?.('.tf-flag');
    if (!flag) return;
    const text = (flag.getAttribute('data-tf-tip') || '').trim();
    if (!text) return;
    if (!tip) { tip = document.createElement('div'); tip.id = 'tf-tooltip'; document.body.appendChild(tip); }
    tip.textContent = text;
    tip.style.opacity = '0';
    tip.style.display = 'block';
    const fr = flag.getBoundingClientRect();
    const tr = tip.getBoundingClientRect();
    let left = fr.left + fr.width / 2 - tr.width / 2;
    let top  = fr.top - tr.height - 8;
    if (left < 10) left = 10;
    if (left + tr.width > window.innerWidth - 10) left = window.innerWidth - tr.width - 10;
    if (top < 10) top = fr.bottom + 8;
    tip.style.left = `${left}px`;
    tip.style.top  = `${top}px`;
    tip.style.opacity = '1';
  });
  document.body.addEventListener('mouseout', (e) => {
    if (e.target.closest?.('.tf-flag') && tip) tip.style.opacity = '0';
  });
  document.body.addEventListener('click', () => {
    if (tip) tip.style.opacity = '0';
  });
}

// ─────────────────────────────────────────────────────────────
//  Toasts — discovery notifications
// ─────────────────────────────────────────────────────────────
function ensureToastCSS() {
  if (toastCSSReady) return;
  toastCSSReady = true;
  const s = document.createElement('style');
  s.textContent = `
    @keyframes tf-toast-slide-in {
      from { transform: translateY(-120%); opacity: 0; }
      to   { transform: translateY(0);    opacity: 1; }
    }
    @keyframes tf-toast-slide-out {
      from { transform: translateY(0);    opacity: 1; }
      to   { transform: translateY(-120%); opacity: 0; }
    }
    .tf-discovery-toast {
      position: fixed; top: 24px; right: 24px;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      border: 1px solid rgba(29,155,240,0.3);
      border-radius: 16px; padding: 16px 20px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05);
      z-index: 9999999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      animation: tf-toast-slide-in 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards;
      backdrop-filter: blur(12px); min-width: 280px;
    }
    .tf-discovery-toast.tf-toast-exit { animation: tf-toast-slide-out 0.3s ease-in forwards; }
    .tf-toast-header { display:flex; align-items:center; gap:8px; margin-bottom:8px; color:#1d9bf0; font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; }
    .tf-toast-sparkle { font-size: 14px; }
    .tf-toast-country { display:flex; align-items:center; gap:12px; margin-bottom:10px; }
    .tf-toast-flag { font-size:36px; line-height:1; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3)); }
    .tf-toast-name { color:#e7e9ea; font-size:18px; font-weight:700; letter-spacing:-0.2px; }
    .tf-toast-progress { display:flex; align-items:center; gap:8px; }
    .tf-toast-progress-bar { flex:1; height:6px; background:rgba(255,255,255,0.1); border-radius:3px; overflow:hidden; }
    .tf-toast-progress-fill { height:100%; background:linear-gradient(90deg,#1d9bf0,#1da1f2); border-radius:3px; transition:width 0.3s ease; }
    .tf-toast-progress-text { color:#71767b; font-size:13px; font-weight:500; min-width:55px; text-align:right; }
    
    .tf-milestone-toast {
      position: fixed; top: 32px; left: 50%; transform: translateX(-50%) translateY(-150%);
      background: rgba(255, 255, 255, 0.85);
      border: 1px solid rgba(207, 217, 222, 0.5);
      border-radius: 16px; padding: 20px 24px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.1);
      z-index: 9999999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      animation: tf-milestone-slide-in 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards;
      min-width: 320px; text-align: center;
      color: #0f1419;
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
    }
    @media (prefers-color-scheme: dark) {
      .tf-milestone-toast {
        background: rgba(21, 32, 43, 0.85);
        border-color: rgba(56, 68, 77, 0.5);
        color: #f7f9f9;
        box-shadow: 0 8px 32px rgba(0,0,0,0.3);
      }
    }
    @keyframes tf-milestone-slide-in {
      0% { transform: translateX(-50%) translateY(-150%) scale(0.95); opacity: 0; }
      70% { transform: translateX(-50%) translateY(8px) scale(1.01); opacity: 1; }
      100% { transform: translateX(-50%) translateY(0) scale(1); opacity: 1; }
    }
    @keyframes tf-milestone-slide-out {
      from { transform: translateX(-50%) translateY(0) scale(1); opacity: 1; }
      to   { transform: translateX(-50%) translateY(-150%) scale(0.95); opacity: 0; }
    }
    .tf-milestone-toast.tf-toast-exit { animation: tf-milestone-slide-out 0.4s ease-in forwards; }
    .tf-source-brand {
      font-size: 11px; font-weight: 700; color: #536471; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;
    }
    @media (prefers-color-scheme: dark) { .tf-source-brand { color: #8b98a5; } }
    .tf-toast-header { display:flex; align-items:center; gap:8px; margin-bottom:10px; color:#1d9bf0; font-size:15px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; }
    .tf-milestone-message { color:inherit; font-size:15px; font-weight:500; line-height: 1.4; margin-bottom: 20px; margin-top: 4px; white-space: pre-wrap; }
    .tf-milestone-btn { 
      display: inline-block; background: #0f1419; color: #fff; text-decoration: none; 
      padding: 10px 24px; border-radius: 9999px; font-weight: 700; font-size: 14px; 
      transition: all 0.2s; border: none; cursor: pointer;
    }
    .tf-milestone-btn:hover { background: #272c30; }
    @media (prefers-color-scheme: dark) {
      .tf-milestone-btn { background: #eff3f4; color: #0f1419; }
      .tf-milestone-btn:hover { background: #d7dbdc; }
    }
    .tf-confetti-piece {
      position: absolute;
      width: 8px; height: 16px;
      top: 50%; left: 50%;
      pointer-events: none;
      opacity: 0;
      animation: tf-confetti-burst 2s ease-out forwards;
      z-index: 10;
    }
    @keyframes tf-confetti-burst {
      0% { transform: translate(-50%, -50%) rotate(0deg) scale(0); opacity: 1; }
      20% { opacity: 1; }
      100% { transform: translate(var(--tx), var(--ty)) rotate(var(--rot)) scale(1.2); opacity: 0; }
    }
  `;
  document.head.appendChild(s);
}

function pumpToast() {
  if (toastBusy || toastQueue.length === 0) return;
  toastBusy = true;
  const { countryName, flag, discoveredCount, total } = toastQueue.shift();
  ensureToastCSS();
  const old = document.querySelector('.tf-discovery-toast');
  if (old) old.remove();
  const pct = Math.round((discoveredCount / total) * 100);
  const flagUrl = typeof getTwemojiUrl === 'function' ? getTwemojiUrl(flag) : null;
  const el = document.createElement('div');
  el.className = 'tf-discovery-toast';
  el.innerHTML = `
    <div class="tf-toast-header"><span class="tf-toast-sparkle">✨</span><span>New Country Discovered!</span></div>
    <div class="tf-toast-country">
      <div class="tf-toast-flag">${flagUrl ? `<img src="${flagUrl}" alt="${flag}" style="width:1em;height:1em;display:block;">` : flag}</div>
      <span class="tf-toast-name">${countryName}</span>
    </div>
    <div class="tf-toast-progress">
      <div class="tf-toast-progress-bar"><div class="tf-toast-progress-fill" style="width:${pct}%"></div></div>
      <span class="tf-toast-progress-text">${discoveredCount}/${total}</span>
    </div>`;
  document.body.appendChild(el);
  setTimeout(() => {
    el.classList.add('tf-toast-exit');
    setTimeout(() => { el.remove(); toastBusy = false; setTimeout(pumpToast, 1000); }, 300);
  }, 4000);
}

function showMilestoneToast(data) {
  milestoneToastQueue.push(data);
  pumpMilestoneToast();
}

function pumpMilestoneToast() {
  if (milestoneToastBusy || milestoneToastQueue.length === 0) return;
  milestoneToastBusy = true;
  const { count, message, buttonText, url } = milestoneToastQueue.shift();
  ensureToastCSS();
  const old = document.querySelector('.tf-milestone-toast');
  if (old) old.remove();
  let confettiHTML = '';
  if (count >= 500) {
    const colors = ['#1d9bf0', '#00ba7c', '#f91880', '#ffd400', '#ff7a00'];
    for(let i=0; i<40; i++) {
      const color = colors[Math.floor(Math.random() * colors.length)];
      const tx = (Math.random() - 0.5) * 400 + 'px';
      const ty = (Math.random() - 0.5) * 300 + 'px';
      const rot = Math.random() * 720 + 'deg';
      const delay = Math.random() * 0.2 + 's';
      confettiHTML += `<div class="tf-confetti-piece" style="background:${color}; --tx:${tx}; --ty:${ty}; --rot:${rot}; animation-delay:${delay};"></div>`;
    }
  }

  const el = document.createElement('div');
  el.className = 'tf-milestone-toast';
  el.innerHTML = `
    ${confettiHTML}
    <div class="tf-source-brand" style="position:relative; z-index:1;">Location Flag & Blocker</div>
    <div class="tf-toast-header" style="justify-content: center; position:relative; z-index:1;"><span class="tf-toast-sparkle">🏆</span><span>Milestone Reached!</span></div>
    <div class="tf-milestone-message" style="position:relative; z-index:1;">${message}</div>
    <a href="${url}" target="_blank" class="tf-milestone-btn" style="position:relative; z-index:1;">${buttonText}</a>`;
  document.body.appendChild(el);
  setTimeout(() => {
    el.classList.add('tf-toast-exit');
    setTimeout(() => { el.remove(); milestoneToastBusy = false; setTimeout(pumpMilestoneToast, 1000); }, 400);
  }, 10000);
}

// ─────────────────────────────────────────────────────────────
//  Lifecycle — MutationObserver, IntersectionObserver, messages
// ─────────────────────────────────────────────────────────────
function onVisible(entries) {
  for (const e of entries) {
    if (e.isIntersecting) {
      // Schedule a lazy fetch — if the user scrolls past within LAZY_DELAY_MS, it's cancelled
      if (!lazyTimers.has(e.target)) {
        const el = e.target;
        const tid = setTimeout(() => {
          lazyTimers.delete(el);
          viewport.unobserve(el);
          watched.delete(el);
          const user = findHandle(el);
          if (user) processNode(el, user);
        }, LAZY_DELAY_MS);
        lazyTimers.set(el, tid);
      }
    } else {
      // Element left the viewport before the lazy timer fired — cancel
      const tid = lazyTimers.get(e.target);
      if (tid) { clearTimeout(tid); lazyTimers.delete(e.target); }
    }
  }
}

function trackElement(el) {
  if (el.dataset.tfWatch) return;
  el.dataset.tfWatch = '1';
  watched.add(el);
  viewport.observe(el);
}

function initialSweep() {
  if (!enabled || gone()) return;
  for (const el of document.querySelectorAll(ELEMENT_SELECTORS)) {
    if (!el.dataset.tfWatch) trackElement(el);
  }
}

function parseRegions(input) {
  if (!input) filteredRegions = [];
  else if (Array.isArray(input)) filteredRegions = input.map(s => s.toLowerCase());
  else filteredRegions = input.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
}

// Stats / tracking helpers
function bumpStat(kind) { if (!gone()) chrome.runtime.sendMessage({ type: 'incrementStat', statType: kind }); }
function spotCountry(name, flag) { if (!name || !flag || gone()) return; chrome.runtime.sendMessage({ type: 'countrySpotted', country: name, flag }); }

// ─────────────────────────────────────────────────────────────
//  Boot
// ─────────────────────────────────────────────────────────────
async function boot() {
  let cachedQueryId = '';
  // 1. Settings
  try {
    const cfg = await new Promise(r => {
      if (gone()) return r({});
      chrome.runtime.sendMessage({ type: 'getSettings' }, resp => {
        if (chrome.runtime.lastError) r({}); else r(resp || {});
      });
    });
    enabled      = cfg.extension_enabled ?? true;
    onlyVerified = cfg.verified_only_mode ?? false;
    autoFilter   = cfg.auto_block_mode ?? false;
    discoveryOn  = cfg.passport_mode ?? true;
    devDataSource = cfg.dev_data_source || 'auto';
    alwaysLoadComments = cfg.always_load_comments ?? false;
    if (cfg.blocked_countries) parseRegions(cfg.blocked_countries);
    const local = await disk.read(['submission_history', 'dev_show_source_banner', '_tf_query_id']);
    submittedHistory = new Set(local.submission_history || []);
    devShowSourceBanner = local.dev_show_source_banner ?? false;
    cachedQueryId = local._tf_query_id || '';
    if (cachedQueryId) {
      window.postMessage({ target: 'pageScript', type: '__setCachedQueryId', queryId: cachedQueryId }, window.location.origin);
    }
  } catch (_) {}

  // 2. Cache
  await hydrate();
  if (!enabled) return;

  // 3. Styles
  if (!document.getElementById('tf-style')) {
    const s = document.createElement('style');
    s.id = 'tf-style';
    s.textContent = `
      .tf-flag { contain: layout style; margin: 0 4px; display: inline-flex; align-items: center; vertical-align: middle; height: 1.2em; gap: 3px; cursor: help; }
      .tf-flag img { height: 1.2em; width: auto; display: block; pointer-events: none; }
      .tf-time { font-size: 11px; color: #71767b; font-variant-numeric: tabular-nums; white-space: nowrap; line-height: 1.2em; pointer-events: none; }
      #tf-tooltip {
        position: fixed; z-index: 100000;
        background: #1d9bf0; color: #fff;
        padding: 4px 8px; border-radius: 4px;
        font-size: 12px; font-weight: 600;
        pointer-events: none;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        opacity: 0; transition: opacity 0.15s;
        white-space: nowrap;
      }
      .tf-source-tag { font-size: 9px; padding: 2px 4px; border-radius: 4px; background: #333; color: #fff; line-height: 1; vertical-align: middle; margin-left: 4px; text-transform: uppercase; font-weight: bold; pointer-events: none; }
      @media (prefers-color-scheme: dark) { #tf-tooltip { background: #fff; color: #000; } }
      [data-tw-theme="dark"] #tf-tooltip { background: #fff; color: #000; }
    `;
    (document.head || document.documentElement).appendChild(s);
  }

  // 4. Clock — refresh .tf-time elements + sweep expired negatives
  setInterval(() => {
    // Skip clock updates when tab is not visible to save CPU
    if (document.hidden) return;
    for (const el of document.querySelectorAll('.tf-time[data-tz]')) {
      const tz = el.dataset.tz;
      const ts = getLocalTimeString(tz);
      if (ts) {
        const h = getLocalHour(tz);
        el.textContent = (h !== null && (h >= 22 || h < 6) ? '🌙 ' : '') + ts;
      }
    }
    // Sweep expired negative-cache entries and enforce cap
    const now = Date.now();
    for (const [k, exp] of negativeMap) { if (exp <= now) negativeMap.delete(k); }
    if (negativeMap.size > NEGATIVE_MAP_CAP) {
      let drop = negativeMap.size - Math.floor(NEGATIVE_MAP_CAP / 2);
      for (const k of negativeMap.keys()) { if (drop-- <= 0) break; negativeMap.delete(k); }
    }
  }, CLOCK_TICK_MS);

  // 5. Preconnect
  for (const [href, co] of [[API_ENDPOINT, false], ['https://abs-0.twimg.com', true]]) {
    const link = document.createElement('link');
    link.rel = 'preconnect'; link.href = href;
    if (co) link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  }

  // 6. Inject pageScript (Now handled via manifest.json MAIN world content_scripts)

  // 7. Delegated tooltip
  attachTooltip();

  // 8. Targeted MutationObserver — addedNodes only, micro-batched
  let pending = new Set();
  let drainTimer = null;
  const IGNORED_TAGS = new Set(['IMG', 'SPAN', 'SVG', 'PATH', 'BUTTON', 'CANVAS', 'STYLE', 'SCRIPT', 'LINK', 'BR', 'HR', 'INPUT', 'TEXTAREA', 'SELECT', 'OPTION', 'A', 'I', 'B', 'EM', 'STRONG', 'LABEL']);
  const flush = () => {
    if (pending.size === 0) return;
    const nodes = Array.from(pending);
    pending = new Set();
    for (const n of nodes) trackElement(n);
  };
  const scheduleFlush = () => { if (!drainTimer) drainTimer = setTimeout(() => { drainTimer = null; flush(); }, DRAIN_INTERVAL); };

  watcherRef = new MutationObserver(mutations => {
    if (!enabled) return;
    for (const mu of mutations) {
      for (const node of mu.addedNodes) {
        if (node.nodeType !== 1) continue;
        
        // Fast test-id pre-filter: Skip subtree query if no data-testid attributes exist anywhere in the hierarchy
        const hasTestId = node.hasAttribute('data-testid') || (node.querySelector && node.querySelector('[data-testid]'));
        if (!hasTestId) continue;

        if (node.matches?.(ELEMENT_SELECTORS) && !node.dataset.tfWatch) pending.add(node);
        if (!IGNORED_TAGS.has(node.tagName) && node.querySelectorAll) {
          for (const c of node.querySelectorAll(ELEMENT_SELECTORS)) {
            if (!c.dataset.tfWatch) pending.add(c);
          }
        }
      }
    }
    if (pending.size > 0) scheduleFlush();
  });
  watcherRef.observe(document.body, { childList: true, subtree: true });

  // 9. Passive data from pageScript.js
  window.addEventListener('message', (e) => {
    if (e.source !== window) return;
    if (e.data?.type === '__passiveData' && Array.isArray(e.data.users)) {
      for (const u of e.data.users) {
        if (u?.screen_name && (u.location || u.verified || u.is_region)) {
          record(u.screen_name, u.location || null, u.verified, null, u.is_region);
          if (u.location) enqueueSubmission(u.screen_name, u.location, u.verified);
        }
      }
      return;
    }
    if (e.data?.type === '__rateLimitInfo') rateLimitUntil = e.data.resetTime;
    // Persist discovered query ID for faster subsequent page loads
    if (e.data?.type === '__queryIdDiscovered' && e.data.queryId) {
      disk.write({ _tf_query_id: e.data.queryId });
    }
  });

  // 10. Chrome runtime messages
  chrome.runtime.onMessage.addListener((msg, _sender, respond) => {
    if (msg.type === 'extensionToggle') {
      enabled = msg.enabled;
      if (enabled) {
        setTimeout(initialSweep, 500);
        if (watcherRef) watcherRef.observe(document.body, { childList: true, subtree: true });
      } else {
        document.querySelectorAll('.tf-flag').forEach(f => f.remove());
        document.querySelectorAll('[data-location-hidden]').forEach(el => {
          el.style.display = ''; delete el.dataset.locationHidden;
        });
        viewport.disconnect();
        watched = new WeakSet();
        if (watcherRef) watcherRef.disconnect();
      }
    } else if (msg.type === 'settingsUpdate') {
      const s = msg.settings;
      enabled      = s.extension_enabled ?? enabled;
      onlyVerified = s.verified_only_mode ?? onlyVerified;
      autoFilter   = s.auto_block_mode ?? autoFilter;
      discoveryOn  = s.passport_mode ?? discoveryOn;
      devDataSource = s.dev_data_source || devDataSource;
      alwaysLoadComments = s.always_load_comments ?? alwaysLoadComments;
      if (s.blocked_countries) parseRegions(s.blocked_countries);
    } else if (msg.type === 'alwaysLoadCommentsUpdate') {
      alwaysLoadComments = msg.enabled;
    } else if (msg.type === 'devDataSourceUpdate') {
      devDataSource = msg.source;
    } else if (msg.type === 'devBannerUpdate') {
      devShowSourceBanner = msg.enabled;
    } else if (msg.type === 'showDiscoveryToast' && discoveryOn) {
      toastQueue.push({ countryName: msg.countryName, flag: msg.flag, discoveredCount: msg.discoveredCount, total: msg.total });
      pumpToast();
    } else if (msg.type === 'showMilestoneToast') {
      showMilestoneToast({ count: msg.count, message: msg.message, buttonText: msg.buttonText, url: msg.url });
    } else if (msg.type === 'blockedCountriesUpdate') {
      parseRegions(msg.countries);
    } else if (msg.type === 'verifiedOnlyUpdate') {
      onlyVerified = msg.enabled;
    } else if (msg.type === 'autoBlockUpdate') {
      autoFilter = msg.enabled;
    } else if (msg.type === 'getStatus') {
      const now = Math.floor(Date.now() / 1000);
      respond({ rateLimited: rateLimitUntil > now, resetTime: rateLimitUntil, queueLength: cloudPending.length + twitterPending.length });
    } else if (msg.type === 'cacheCleared') {
      dataMap.clear();
      negativeMap.clear();
      dbClear();
      initialSweep();
    }
  });

  // 11. Initial sweep
  initialSweep();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

window.addEventListener('pagehide', () => {
  drainSubmissions();
});