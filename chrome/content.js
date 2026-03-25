// ─────────────────────────────────────────────────────────────
//  Config
// ─────────────────────────────────────────────────────────────
const API_ENDPOINT = 'https://twitter-countries-api.tnemoroccan.workers.dev';
const STORE_KEY    = 'twitter_location_cache_v4';
const EXPIRY_DAYS       = 30;
const STALE_WINDOW_DAYS = 90;
const EXPIRY_EMPTY_DAYS = 14;
const STORE_LIMIT       = 5000;
const CLOUD_BATCH_MAX   = 50;
const MISS_TTL          = 300_000;       // 5 min cooldown for "not found" users
const DRAIN_INTERVAL    = 60;            // ms – micro-batch MutationObserver events
const TWITTER_PARALLEL  = 5;
const TWITTER_STAGGER_MS = 300; // Paced delay between Twitter lookup batches
const LAZY_DELAY_MS     = 150;  // Debounce: ignore elements scrolled past quickly
const VISIBILITY_CAP    = 600;           // max elements tracked by IntersectionObserver
const SUBMIT_FLUSH_MS   = 30_000;        // auto-flush cloud submissions
const CLOCK_TICK_MS     = 60_000;        // local-time refresh interval
const COUNTRY_TOTAL     = 195;

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
let rateLimitUntil  = 0;

// Queues / flags
let cloudBusy       = false;
let twitterBusy     = false;
let cloudBatchTimer = null;
let cacheTimer      = null;
let dirtyCache      = false;

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
const watched    = new Set();
const lazyTimers = new Map();  // element → setTimeout id (scroll debounce)
const viewport   = new IntersectionObserver(onVisible, { rootMargin: '100px 0px 800px 0px' });

// Toast
let toastCSSReady = false;
let toastQueue    = [];
let toastBusy     = false;

// Tooltip
let tip = null;

// ─────────────────────────────────────────────────────────────
//  Storage adapter (Chrome / Firefox)
// ─────────────────────────────────────────────────────────────
function gone() { return !chrome.runtime?.id; }

const disk = {
  read: (keys) => new Promise(r => {
    if (gone()) return r({});
    typeof browser !== 'undefined' && browser.storage
      ? browser.storage.local.get(keys).then(r)
      : chrome.storage.local.get(keys, r);
  }),
  write: (obj) => new Promise(r => {
    if (gone()) return r();
    typeof browser !== 'undefined' && browser.storage
      ? browser.storage.local.set(obj).then(r)
      : chrome.storage.local.set(obj, r);
  })
};

// ─────────────────────────────────────────────────────────────
//  DataStore — cache, eviction, disk flush, cloud submit
// ─────────────────────────────────────────────────────────────
async function hydrate() {
  try {
    const raw = await disk.read(STORE_KEY);
    if (!raw[STORE_KEY]) return;
    const now = Date.now();
    const staleEdge = now - STALE_WINDOW_DAYS * 86_400_000;
    for (const [user, entry] of Object.entries(raw[STORE_KEY])) {
      const rec = typeof entry === 'object'
        ? entry
        : { location: entry, expiry: now + EXPIRY_DAYS * 86_400_000 };
      if (typeof entry === 'string') rec.expiry = now + EXPIRY_DAYS * 86_400_000;
      if (rec.expiry > staleEdge) {
        if (!rec.timezone && rec.location) rec.timezone = resolveTimezone(rec.location);
        dataMap.set(user, rec);
      }
    }
    if (dataMap.size > STORE_LIMIT) evict();
  } catch (_) {}
}

function record(username, location, verified = false, apiTz = null, isRegion = false) {
  if (gone()) return;
  const days = location === null ? EXPIRY_EMPTY_DAYS : EXPIRY_DAYS;
  const tz   = (location ? resolveTimezone(location) : null) || apiTz || null;
  dataMap.set(username, { location, verified, timezone: tz, isRegion, expiry: Date.now() + days * 86_400_000 });
  dirtyCache = true;
  if (dataMap.size > STORE_LIMIT + 100) evict();
  if (cacheTimer) clearTimeout(cacheTimer);
  cacheTimer = setTimeout(persist, 2000);
}

async function persist() {
  if (!dirtyCache || gone()) return;
  const out = {};
  const now = Date.now();
  for (const [k, v] of dataMap) { if (v.expiry > now) out[k] = v; }
  await disk.write({ [STORE_KEY]: out });
  dirtyCache = false;
}

function evict() {
  const now = Date.now();
  for (const [k, v] of dataMap) { if (v.expiry <= now) dataMap.delete(k); }
  if (dataMap.size > STORE_LIMIT) {
    let drop = dataMap.size - STORE_LIMIT;
    for (const k of dataMap.keys()) { if (drop-- <= 0) break; dataMap.delete(k); }
  }
  dirtyCache = true;
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
function fetchLocation(screenName) {
  // Hot cache hit
  const hot = dataMap.get(screenName);
  if (hot && Date.now() < hot.expiry) {
    return Promise.resolve({ location: hot.location, verified: hot.verified ?? false, timezone: hot.timezone ?? null, isRegion: hot.isRegion ?? false });
  }
  if (hot) dataMap.delete(screenName);

  if (devDataSource === 'cache_only') {
    return Promise.resolve({ location: null, verified: false, timezone: null });
  }

  // Negative guard
  const neg = negativeMap.get(screenName);
  if (neg && Date.now() < neg) return Promise.resolve({ location: null, verified: false, timezone: null });

  // Dedup – piggyback on in-flight request
  if (flightMap.has(screenName)) return flightMap.get(screenName);

  if (devDataSource === 'twitter_only') {
    const ticket = new Promise((resolve, reject) => {
      twitterPending.push({ screenName, resolve, reject });
      drainTwitter();
    }).then(result => {
      if (!result?.location) negativeMap.set(screenName, Date.now() + MISS_TTL);
      flightMap.delete(screenName);
      return result;
    });
    flightMap.set(screenName, ticket);
    return ticket;
  }

  const ticket = new Promise((resolve, reject) => {
    cloudPending.push({ screenName, resolve, reject });
    if (!cloudBusy && !cloudBatchTimer) {
      cloudBatchTimer = setTimeout(() => { cloudBatchTimer = null; drainCloud(); }, 50);
    }
  }).then(result => {
    if (!result?.location) negativeMap.set(screenName, Date.now() + MISS_TTL);
    flightMap.delete(screenName);
    return result;
  });

  flightMap.set(screenName, ticket);
  return ticket;
}

async function drainCloud() {
  if (cloudBusy || cloudPending.length === 0 || gone()) return;
  cloudBusy = true;
  const batch = cloudPending.splice(0, CLOUD_BATCH_MAX);
  const names = batch.map(r => r.screenName);
  let results = {};

  try {
    const res = await fetch(`${API_ENDPOINT}/lookup?users=${encodeURIComponent(names.join(','))}`);
    if (res.ok) results = await res.json();
  } catch (_) {}

  const retry = [];
  for (const req of batch) {
    const payload = results[req.screenName.toLowerCase()];
    if (payload !== undefined) {
      const loc  = typeof payload === 'object' ? payload.location : payload;
      // Cloud D1 doesn't reliably store verified — preserve any true from passive snooping
      const cloudVer = typeof payload === 'object' ? payload.verified : false;
      const cachedVer = dataMap.get(req.screenName)?.verified ?? false;
      const ver  = cloudVer || cachedVer;
      const aTz  = typeof payload === 'object' ? payload.timezone : null;
      if (onlyVerified && typeof payload !== 'object') {
        if (devDataSource === 'cloudflare_only') {
          const storedTz = dataMap.get(req.screenName)?.timezone ?? null;
          req.resolve({ location: loc, verified: false, timezone: storedTz, isRegion: false });
        } else {
          retry.push(req);
        }
      } else {
        record(req.screenName, loc, ver, aTz);
        const storedTz = dataMap.get(req.screenName)?.timezone ?? null;
        req.resolve({ location: loc, verified: ver, timezone: storedTz, isRegion: false });
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
      req.resolve({ location: fresh.location, verified: fresh.verified, timezone: fresh.timezone ?? null, isRegion: fresh.isRegion ?? false });
      flightMap.delete(req.screenName);
      return done();
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
      const result = { location: e.data.location, verified: e.data.verified ?? false, timezone: tz, isRegion: e.data.is_region };
      req.resolve(result);
      flightMap.delete(req.screenName);
      if (result.location) enqueueSubmission(req.screenName, result.location, result.verified);
      done();
    };
    window.addEventListener('message', onReply);
    window.postMessage({ type: '__fetchUserData', screenName: req.screenName, requestId: rid, target: 'pageScript' }, '*');
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
  return null;
}

async function processNode(container, screenName) {
  if (container.dataset.tfDone === '1') return;
  container.dataset.tfDone = 'working';

  try {
    const data = await fetchLocation(screenName);
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
            window.postMessage({ type: '__blockUser', screenName, target: 'pageScript' }, '*');
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
  if (watched.size >= VISIBILITY_CAP) {
    const first = watched.values().next().value;
    viewport.unobserve(first);
    delete first.dataset.tfWatch;
    watched.delete(first);
  }
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
    if (cfg.blocked_countries) parseRegions(cfg.blocked_countries);
    const local = await disk.read(['submission_history']);
    submittedHistory = new Set(local.submission_history || []);
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
      @media (prefers-color-scheme: dark) { #tf-tooltip { background: #fff; color: #000; } }
      [data-tw-theme="dark"] #tf-tooltip { background: #fff; color: #000; }
    `;
    (document.head || document.documentElement).appendChild(s);
  }

  // 4. Clock — refresh .tf-time elements + sweep expired negatives
  setInterval(() => {
    for (const el of document.querySelectorAll('.tf-time[data-tz]')) {
      const tz = el.dataset.tz;
      const ts = getLocalTimeString(tz);
      if (ts) {
        const h = getLocalHour(tz);
        el.textContent = (h !== null && (h >= 22 || h < 6) ? '🌙 ' : '') + ts;
      }
    }
    // Sweep expired negative-cache entries
    const now = Date.now();
    for (const [k, exp] of negativeMap) { if (exp <= now) negativeMap.delete(k); }
  }, CLOCK_TICK_MS);

  // 5. Preconnect
  for (const [href, co] of [[API_ENDPOINT, false], ['https://abs-0.twimg.com', true]]) {
    const link = document.createElement('link');
    link.rel = 'preconnect'; link.href = href;
    if (co) link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  }

  // 6. Inject pageScript
  const ps = document.createElement('script');
  ps.src = chrome.runtime.getURL('pageScript.js');
  ps.setAttribute('data-extension-id', chrome.runtime.id);
  ps.onload = () => ps.remove();
  (document.head || document.documentElement).appendChild(ps);

  // 7. Delegated tooltip
  attachTooltip();

  // 8. Targeted MutationObserver — addedNodes only, micro-batched
  let pending = new Set();
  let drainTimer = null;
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
        if (node.matches?.(ELEMENT_SELECTORS) && !node.dataset.tfWatch) pending.add(node);
        if (node.querySelectorAll) {
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
  });

  // 10. Chrome runtime messages
  chrome.runtime.onMessage.addListener((msg, _sender, respond) => {
    if (msg.type === 'extensionToggle') {
      enabled = msg.enabled;
      if (enabled) { setTimeout(initialSweep, 500); }
      else {
        document.querySelectorAll('.tf-flag').forEach(f => f.remove());
        document.querySelectorAll('[data-location-hidden]').forEach(el => {
          el.style.display = ''; delete el.dataset.locationHidden;
        });
        viewport.disconnect(); watched.clear();
      }
    } else if (msg.type === 'settingsUpdate') {
      const s = msg.settings;
      enabled      = s.extension_enabled ?? enabled;
      onlyVerified = s.verified_only_mode ?? onlyVerified;
      autoFilter   = s.auto_block_mode ?? autoFilter;
      discoveryOn  = s.passport_mode ?? discoveryOn;
      devDataSource = s.dev_data_source || devDataSource;
      if (s.blocked_countries) parseRegions(s.blocked_countries);
    } else if (msg.type === 'devDataSourceUpdate') {
      devDataSource = msg.source;
    } else if (msg.type === 'showDiscoveryToast' && discoveryOn) {
      toastQueue.push({ countryName: msg.countryName, flag: msg.flag, discoveredCount: msg.discoveredCount, total: msg.total });
      pumpToast();
    } else if (msg.type === 'blockedCountriesUpdate') {
      parseRegions(msg.countries);
    } else if (msg.type === 'verifiedOnlyUpdate') {
      onlyVerified = msg.enabled;
    } else if (msg.type === 'autoBlockUpdate') {
      autoFilter = msg.enabled;
    } else if (msg.type === 'getStatus') {
      const now = Math.floor(Date.now() / 1000);
      respond({ rateLimited: rateLimitUntil > now, resetTime: rateLimitUntil, queueLength: cloudPending.length + twitterPending.length });
    }
  });

  // 11. Initial sweep
  initialSweep();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

window.addEventListener('pagehide', () => {
  if (cacheTimer) clearTimeout(cacheTimer);
  persist();
  drainSubmissions();
});