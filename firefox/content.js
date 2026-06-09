// ─────────────────────────────────────────────────────────────
// Ultra-Fast Content Script
// ─────────────────────────────────────────────────────────────

const API_ENDPOINT = 'https://twitter-countries-api.tnemoroccan.workers.dev';
const CACHE_KEY = 'tf_cache';
const CACHE_EXPIRY_DAYS = 30;
const CACHE_EXPIRY_EMPTY = 14;

let dataMap = new Map();
let memoryQueue = [];
let queueTimer = null;
let enabled = true;
let isBooting = true;
let flightMap = new Map();
let isRateLimited = false;
let rateLimitResetTime = 0;
let alwaysLoadComments = false;
let devShowSourceBanner = false;

// 1. Storage
async function loadCache() {
  const res = await chrome.storage.local.get([CACHE_KEY, 'always_load_comments', 'dev_show_source_banner']);
  if (res.always_load_comments) alwaysLoadComments = res.always_load_comments;
  if (res.dev_show_source_banner) devShowSourceBanner = res.dev_show_source_banner;
  if (res[CACHE_KEY]) {
    const now = Date.now();
    for (const [k, v] of Object.entries(res[CACHE_KEY])) {
      if (v.expiry > now) {
        dataMap.set(k, v);
      }
    }
  }
  isBooting = false;
  scan();
}

let saveTimer = null;
function persistCache() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const exportObj = {};
    const now = Date.now();
    let count = 0;
    for (const [k, v] of dataMap) {
      if (v.expiry > now) {
        exportObj[k] = v;
        if (++count > 10000) break;
      }
    }
    chrome.storage.local.set({ [CACHE_KEY]: exportObj });
  }, 2000);
}

function setCache(screenName, location, verified) {
  const days = location ? CACHE_EXPIRY_DAYS : CACHE_EXPIRY_EMPTY;
  dataMap.set(screenName.toLowerCase(), {
    location,
    verified,
    expiry: Date.now() + (days * 86400000)
  });
  persistCache();
}

// 2. Fetch Logic
function getTwemojiUrl(emoji) {
  const hex = Array.from(emoji).map(c => c.codePointAt(0).toString(16)).join('-');
  return `https://abs-0.twimg.com/emoji/v2/svg/${hex}.svg`;
}

async function fetchMissing(batch) {
  const usernames = batch.map(b => b.screenName);
  try {
    const res = await fetch(`${API_ENDPOINT}/lookup?users=${encodeURIComponent(usernames.join(','))}`);
    const results = res.ok ? await res.json() : {};
    
    const missingFromCloud = [];
    
    for (const req of batch) {
      const u = req.screenName.toLowerCase();
      const data = results[u];
      if (data) {
        const loc = typeof data === 'object' ? data.location : data;
        const ver = typeof data === 'object' ? data.verified : false;
        setCache(u, loc, ver);
        req.resolve({ location: loc, verified: ver, source: 'cloudflare' });
      } else {
        missingFromCloud.push(req);
      }
    }
    
    // Direct Twitter Fallback
    for (const req of missingFromCloud) {
      const u = req.screenName;
      const rid = Date.now() + Math.random();
      const onReply = (e) => {
        if (e.source !== window || e.data?.type !== '__userDataResponse' || e.data.requestId !== rid) return;
        window.removeEventListener('message', onReply);
        if (e.data.isRateLimited) {
          isRateLimited = true;
          if (!rateLimitResetTime) rateLimitResetTime = Math.floor(Date.now() / 1000) + 900;
        } else if (e.data.location) {
          setCache(u, e.data.location, e.data.verified);
        }
        req.resolve({ location: e.data.location, verified: e.data.verified ?? false, source: 'twitter' });
      };
      window.addEventListener('message', onReply);
      window.postMessage({ type: '__fetchUserData', screenName: u, requestId: rid, target: 'pageScript' }, '*');
      
      setTimeout(() => {
        window.removeEventListener('message', onReply);
        req.resolve({ location: null, verified: false });
      }, 5000);
    }
    
  } catch (e) {
    batch.forEach(b => b.resolve({ location: null, verified: false }));
  }
}

function flushQueue() {
  if (memoryQueue.length === 0) return;
  const batch = memoryQueue.splice(0, 50);
  fetchMissing(batch);
  if (memoryQueue.length > 0) {
    queueMicrotask(flushQueue);
  }
}

function getUserData(screenName, cacheOnly = false) {
  const u = screenName.toLowerCase();
  const cached = dataMap.get(u);
  if (cached && cached.expiry > Date.now()) {
    cached.source = 'cache';
    return Promise.resolve(cached);
  }
  
  if (cacheOnly) {
    return Promise.resolve({ location: null, verified: false });
  }

  if (flightMap.has(u)) {
    return flightMap.get(u);
  }
  
  const promise = new Promise(resolve => {
    memoryQueue.push({ screenName: u, resolve });
    if (!queueTimer) {
      queueTimer = setTimeout(() => { queueTimer = null; flushQueue(); }, 0);
    }
  }).then(res => {
    flightMap.delete(u);
    return res;
  });
  
  flightMap.set(u, promise);
  return promise;
}

// 3. DOM Logic
function findHandle(container) {
  const nameWrap = container.querySelector('[data-testid="User-Name"]');
  if (!nameWrap) return null;
  const links = nameWrap.getElementsByTagName('a');
  for (let i = 0; i < links.length; i++) {
    const href = links[i].getAttribute('href');
    if (href && href.startsWith('/')) {
      const handle = href.substring(1);
      if (/^[a-zA-Z0-9_]{1,15}$/.test(handle) && !['home','explore','notifications','messages','search'].includes(handle)) {
        return handle;
      }
    }
  }
  return null;
}

const processingUsernames = new Set();
async function processNode(container, screenName) {
  if (container.dataset.tfDone === '1' || processingUsernames.has(screenName)) return;
  processingUsernames.add(screenName);
  
  try {
    const isStatusPage = window.location.pathname.includes('/status/');
    const isMainAuthor = isStatusPage && window.location.pathname.toLowerCase().startsWith('/' + screenName.toLowerCase() + '/status/');
    const cacheOnly = isStatusPage && !isMainAuthor && !alwaysLoadComments;

    const data = await getUserData(screenName, cacheOnly);
    
    if (container.dataset.tfDone === '1') return;
    container.dataset.tfDone = '1';
    
    const loc = data?.location;
    if (!loc) {
      container.dataset.tfDone = 'miss';
      return;
    }
    
    let tz = data?.timezone;
    if (!tz && loc && typeof resolveTimezone === 'function') tz = resolveTimezone(loc);
    
    const flag = typeof getCountryFlag === 'function' ? getCountryFlag(loc) : null;
    if (!flag) return;
    
    const nameNode = container.querySelector('[data-testid="User-Name"]');
    if (!nameNode || nameNode.querySelector('.tf-flag')) return;
    
    const span = document.createElement('span');
    span.className = 'tf-flag';
    span.setAttribute('data-tf-tip', loc);
    
    const img = document.createElement('img');
    img.src = getTwemojiUrl(flag);
    img.alt = flag;
    img.title = loc;
    span.appendChild(img);
    
    if (tz && typeof getLocalTimeString === 'function') {
      const ts = getLocalTimeString(tz);
      if (ts) {
        const clock = document.createElement('span');
        clock.className = 'tf-time';
        clock.dataset.tz = tz;
        const h = typeof getLocalHour === 'function' ? getLocalHour(tz) : null;
        clock.textContent = (h !== null && (h >= 22 || h < 6) ? '🌙 ' : '') + ts;
        span.appendChild(clock);
        span.setAttribute('data-tf-tip', `${loc} (${tz} • ${ts})`);
      }
    }
    
    if (devShowSourceBanner && data?.source) {
      const srcTag = document.createElement('span');
      srcTag.className = 'tf-source-tag';
      srcTag.textContent = data.source;
      if (data.source === 'cache') srcTag.style.background = '#666';
      else if (data.source === 'cloudflare') srcTag.style.background = '#f6821f';
      else if (data.source === 'twitter') srcTag.style.background = '#1d9bf0';
      span.appendChild(srcTag);
    }
    
    let target = nameNode;
    const handle = `@${screenName.toLowerCase()}`;
    const spans = nameNode.getElementsByTagName('span');
    for (let i = 0; i < spans.length; i++) {
      if (spans[i].textContent.toLowerCase() === handle) {
        target = spans[i].parentElement || spans[i];
        break;
      }
    }
    
    target.appendChild(span);
    
  } finally {
    processingUsernames.delete(screenName);
  }
}

const ELEMENT_SELECTORS = 'article[data-testid="tweet"], [data-testid="UserCell"], [data-testid="User-Names"], [data-testid="User-Name"]';

const viewportObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      viewportObserver.unobserve(entry.target);
      const user = findHandle(entry.target);
      if (user) processNode(entry.target, user);
    }
  });
}, { rootMargin: '50px 0px 200px 0px' });

function scan() {
  if (!enabled || isBooting) return;
  document.querySelectorAll(`${ELEMENT_SELECTORS}:not([data-tf-watch])`).forEach(el => {
    el.dataset.tfWatch = '1';
    viewportObserver.observe(el);
  });
}

// Tooltip Logic
let tip = null;
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

// 4. Boot
const watcherRef = new MutationObserver(scan);

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'getStatus') {
    sendResponse({ rateLimited: isRateLimited, resetTime: rateLimitResetTime });
    return true;
  }
  if (msg.type === 'extensionToggle') {
    enabled = msg.enabled;
    if (enabled) {
      scan();
    } else {
      document.querySelectorAll('.tf-flag').forEach(f => f.remove());
      document.querySelectorAll('[data-tf-watch], [data-tf-done]').forEach(el => {
        delete el.dataset.tfWatch;
        delete el.dataset.tfDone;
      });
    }
  }
  if (msg.type === 'alwaysLoadCommentsUpdate') {
    alwaysLoadComments = msg.enabled;
    if (alwaysLoadComments) {
      document.querySelectorAll('[data-tf-done="miss"]').forEach(el => delete el.dataset.tfDone);
      scan();
    }
  }
  if (msg.type === 'devBannerUpdate') {
    devShowSourceBanner = msg.enabled;
  }
});

function boot() {
  if (!document.getElementById('tf-style')) {
    const s = document.createElement('style');
    s.id = 'tf-style';
    s.textContent = `
      .tf-flag { contain: layout style; margin: 0 4px; display: inline-flex; align-items: center; vertical-align: middle; height: 1.2em; cursor: pointer; }
      .tf-flag img { height: 1.2em; width: auto; display: block; }
      .tf-time { font-size: 11px; color: #71767b; font-variant-numeric: tabular-nums; white-space: nowrap; line-height: 1.2em; margin-left: 4px; }
      .tf-source-tag { font-size: 10px; color: white; padding: 1px 4px; border-radius: 4px; margin-left: 4px; font-weight: bold; line-height: 1.2em; }
      #tf-tooltip { position: fixed; background: rgba(0,0,0,0.8); color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; pointer-events: none; z-index: 999999; transition: opacity 0.1s; box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
    `;
    (document.head || document.documentElement).appendChild(s);
  }

  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('pageScript.js');
  script.setAttribute('data-extension-id', chrome.runtime.id);
  script.onload = () => script.remove();
  (document.head || document.documentElement).appendChild(script);

  window.addEventListener('message', (e) => {
    if (e.source === window && e.data?.type === '__rateLimitInfo') {
      isRateLimited = true;
      rateLimitResetTime = e.data.resetTime || (Math.floor(Date.now() / 1000) + 900);
      setTimeout(() => { isRateLimited = false; }, e.data.waitTime || 900000);
    }
  });

  attachTooltip();
  watcherRef.observe(document.body, { childList: true, subtree: true });
  loadCache();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}