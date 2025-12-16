// Popup script
const TOGGLE_KEY = 'extension_enabled';
const BLOCKED_COUNTRIES_KEY = 'blocked_countries';
const DEFAULT_ENABLED = true;
const REPO_URL = 'https://github.com/incconutwo/twitter-account-location-in-username';
const API_URL = 'https://twitter-countries-api.tnemoroccan.workers.dev';
const DEBUG_STORAGE_KEY = 'debug_mode_enabled';

// DOM Elements
const els = {
  toggle: document.getElementById('toggleSwitch'),
  list: document.getElementById('blockedList'),
  select: document.getElementById('customSelect'),
  options: document.getElementById('customOptions'),
  status: document.getElementById('apiStatus')
};

let blockedCountries = [];
let isDropdownLoaded = false;

// --- Helpers ---

function getTwemojiUrl(emoji) {
  if (!emoji) return '';
  const hex = Array.from(emoji).map(c => c.codePointAt(0).toString(16)).join('-');
  return `https://abs-0.twimg.com/emoji/v2/svg/${hex}.svg`;
}

function updateStatusUI(type, resetTime) {
  els.status.style.display = 'flex';
  els.status.className = 'api-status';
  els.status.innerHTML = '';
  
  const icon = document.createElement('span');
  icon.className = 'api-status-icon';
  const text = document.createElement('span');

  if (type === 'good') {
    els.status.classList.add('green');
    icon.textContent = '✅'; text.textContent = ' API Status: Good';
  } else if (type === 'limited') {
    els.status.classList.add('red');
    const min = Math.max(0, Math.ceil((resetTime - (Date.now()/1000)) / 60));
    icon.textContent = '⚠️'; text.textContent = ` Rate Limited (${min}m left)`;
  } else if (type === 'inactive') {
    els.status.style.color = '#536471';
    icon.textContent = 'ℹ️'; text.textContent = ' Go to X.com to use';
  } else {
    icon.textContent = '⚪'; text.textContent = ' Status: Unknown';
  }
  els.status.append(icon, text);
}

function checkRateLimitStatus() {
  const timeoutId = setTimeout(() => updateStatusUI('unknown'), 2000);

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0];
    if (activeTab && (activeTab.url.includes('twitter.com') || activeTab.url.includes('x.com'))) {
      chrome.tabs.sendMessage(activeTab.id, { type: 'getStatus' }, (response) => {
        clearTimeout(timeoutId);
        if (chrome.runtime.lastError) {
          updateStatusUI('inactive');
          return;
        }
        if (response) {
          updateStatusUI(response.rateLimited ? 'limited' : 'good', response.resetTime);
        } else {
          updateStatusUI('unknown');
        }
      });
    } else {
      clearTimeout(timeoutId);
      updateStatusUI('inactive');
    }
  });
}

// --- Core Logic ---

function updateToggle(isEnabled) {
  if (isEnabled) els.toggle.classList.add('enabled');
  else els.toggle.classList.remove('enabled');
}

function notifyContentScript(message) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, message).catch(() => {});
  });
}

function toggleCountry(country, add) {
  if (add) {
    if (!blockedCountries.includes(country)) blockedCountries.push(country);
  } else {
    blockedCountries = blockedCountries.filter(c => c !== country);
  }
  
  chrome.storage.local.set({ [BLOCKED_COUNTRIES_KEY]: blockedCountries }, () => {
    notifyContentScript({ type: 'blockedCountriesUpdate', countries: blockedCountries });
  });
  
  renderBlockedList();
  
  if (isDropdownLoaded) {
    const opt = els.options.querySelector(`.custom-option[data-value="${country}"]`);
    if (opt) {
      if (add) opt.classList.add('selected');
      else opt.classList.remove('selected');
    }
  }
}

function renderBlockedList() {
  els.list.innerHTML = '';
  if (blockedCountries.length === 0) {
    els.list.innerHTML = '<span class="empty-msg">No countries blocked</span>';
    return;
  }
  const fragment = document.createDocumentFragment();
  blockedCountries.forEach(country => {
    const chip = document.createElement('div');
    chip.className = 'chip';
    if (typeof COUNTRY_FLAGS !== 'undefined' && COUNTRY_FLAGS[country]) {
      const img = document.createElement('img');
      img.src = getTwemojiUrl(COUNTRY_FLAGS[country]);
      chip.appendChild(img);
    }
    chip.appendChild(document.createTextNode(country));
    
    const removeBtn = document.createElement('span');
    removeBtn.className = 'chip-remove';
    removeBtn.innerHTML = '×';
    removeBtn.title = 'Remove';
    removeBtn.onclick = (e) => {
      e.stopPropagation();
      toggleCountry(country, false);
    };
    chip.appendChild(removeBtn);
    fragment.appendChild(chip);
  });
  els.list.appendChild(fragment);
}

function populateDropdown() {
  if (isDropdownLoaded || typeof COUNTRY_FLAGS === 'undefined') return;
  
  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.className = 'country-search';
  searchInput.placeholder = 'Search countries...';
  searchInput.autocomplete = 'off';
  searchInput.onclick = (e) => e.stopPropagation();
  searchInput.oninput = (e) => {
    const term = e.target.value.toLowerCase();
    els.options.querySelectorAll('.custom-option').forEach(opt => {
      opt.style.display = opt.dataset.value.toLowerCase().includes(term) ? 'flex' : 'none';
    });
  };
  els.options.appendChild(searchInput);

  const fragment = document.createDocumentFragment();
  Object.keys(COUNTRY_FLAGS).sort().forEach(country => {
    const emoji = COUNTRY_FLAGS[country];
    const option = document.createElement('div');
    option.className = 'custom-option';
    option.dataset.value = country;
    if (blockedCountries.includes(country)) option.classList.add('selected');
    
    const img = document.createElement('img');
    img.loading = 'lazy'; 
    img.src = getTwemojiUrl(emoji);
    
    const text = document.createElement('span');
    text.textContent = country;
    
    option.append(img, text);
    option.onclick = () => {
      toggleCountry(country, true);
      els.select.classList.remove('open');
      searchInput.value = '';
      els.options.querySelectorAll('.custom-option').forEach(el => el.style.display = 'flex');
    };
    fragment.appendChild(option);
  });
  
  els.options.appendChild(fragment);
  isDropdownLoaded = true;
  setTimeout(() => searchInput.focus(), 50);
}

// --- Updates & Feedback ---

async function initUpdateCheck() {
  const manifest = chrome.runtime.getManifest();
  if (manifest.update_url) return; // Disables check for Store installs

  try {
    const res = await fetch('https://raw.githubusercontent.com/incconutwo/twitter-account-location-in-username/main/manifest.json');
    if (res.ok) {
      const data = await res.json();
      if (isNewerVersion(data.version, manifest.version)) {
        chrome.storage.local.get('dismissed_update_version', (result) => {
          if (result.dismissed_update_version === data.version) {
            showUpdateBanner(data.version);
          } else {
            showFullScreenUpdate(data.version);
          }
        });
      }
    }
  } catch (e) {}
}

function isNewerVersion(latest, current) {
  const l = latest.split('.').map(Number);
  const c = current.split('.').map(Number);
  for (let i = 0; i < Math.max(l.length, c.length); i++) {
    if ((l[i] || 0) > (c[i] || 0)) return true;
    if ((l[i] || 0) < (c[i] || 0)) return false;
  }
  return false;
}

function showUpdateBanner(version) {
  if (document.querySelector('.update-banner')) return;
  const banner = document.createElement('div');
  banner.className = 'update-banner';
  banner.innerHTML = `<span>🚀 Update ${version} available</span><a href="${REPO_URL}" target="_blank">Get it</a>`;
  
  // Inline styles for banner if not in CSS
  banner.style.cssText = `background:#e1f5fe;border:1px solid #b3e5fc;color:#0277bd;padding:10px;border-radius:8px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;animation:slideIn 0.3s;font-size:13px;`;
  const link = banner.querySelector('a');
  link.style.cssText = `color:#0277bd;font-weight:700;margin-left:8px;text-decoration:none;`;
  
  const header = document.querySelector('.header');
  if (header) header.parentNode.insertBefore(banner, header.nextSibling);
}

function showFullScreenUpdate(version) {
  if (document.querySelector('.update-modal')) return;
  const modal = document.createElement('div');
  modal.className = 'update-modal';
  modal.innerHTML = `<h2>Update Available</h2><p>A new version <b>${version}</b> is ready.</p><a href="${REPO_URL}" target="_blank" class="update-modal-btn">Get Update</a><button class="update-dismiss">Remind me later</button>`;
  
  // Inject modal CSS dynamically if needed or rely on provided CSS
  const style = document.createElement('style');
  style.textContent = `.update-modal{position:fixed;top:0;left:0;width:100%;height:100%;background:#fff;z-index:2000;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center;box-sizing:border-box}.update-modal h2{margin:0 0 12px;font-size:18px}.update-modal-btn{background:#1d9bf0;color:#fff;border:none;padding:10px 24px;border-radius:99px;font-weight:700;text-decoration:none;margin-bottom:16px;cursor:pointer}.update-dismiss{background:none;border:none;color:#536471;cursor:pointer;font-size:13px}@media(prefers-color-scheme:dark){.update-modal{background:#15202b;color:#f7f9f9}.update-dismiss{color:#8b98a5}}`;
  document.head.appendChild(style);

  modal.querySelector('.update-dismiss').onclick = () => {
    chrome.storage.local.set({ 'dismissed_update_version': version });
    modal.remove();
    showUpdateBanner(version);
  };
  document.body.appendChild(modal);
}

function initFeedbackUI() {
  const container = document.createElement('div');
  container.className = 'fb-section';
  container.innerHTML = `<div id="fbTrigger" class="fb-trigger">💬 Have feedback or found a bug?</div><div id="fbForm" class="fb-form"><span id="fbClose" class="fb-close" title="Dismiss">×</span><textarea id="fbText" class="fb-input" placeholder="Tell us what you think..."></textarea><button id="fbSend" class="fb-btn">Send Feedback</button></div><div id="fbSuccess" class="fb-success">✅ Thanks for your feedback!</div>`;
  
  // Inject Feedback CSS
  const style = document.createElement('style');
  style.textContent = `.fb-section{margin-top:12px;font-size:12px}.fb-trigger{cursor:pointer;color:#1d9bf0;padding:4px 0;font-weight:500}.fb-trigger:hover{text-decoration:underline}.fb-form{display:none;position:relative;margin-top:10px}.fb-close{position:absolute;right:0;top:-22px;cursor:pointer;font-size:18px;font-weight:bold;color:#536471}.fb-input{width:100%;height:60px;border:1px solid #cfd9de;border-radius:4px;padding:8px;font-family:inherit;margin-bottom:8px;resize:none;box-sizing:border-box}.fb-btn{width:100%;background:#0f1419;color:#fff;border:none;padding:8px;border-radius:99px;font-weight:700;cursor:pointer}.fb-success{display:none;color:#00ba7c;text-align:center;margin-top:8px;font-weight:500}@media(prefers-color-scheme:dark){.fb-input{background:#15202b;border-color:#38444d;color:#fff}.fb-btn{background:#eff3f4;color:#0f1419}}`;
  document.head.appendChild(style);
  document.body.appendChild(container);

  const trigger = container.querySelector('#fbTrigger');
  const form = container.querySelector('#fbForm');
  const text = container.querySelector('#fbText');
  const send = container.querySelector('#fbSend');
  const success = container.querySelector('#fbSuccess');

  trigger.onclick = () => { trigger.style.display = 'none'; form.style.display = 'block'; text.focus(); };
  container.querySelector('#fbClose').onclick = () => { form.style.display = 'none'; trigger.style.display = 'block'; };

  send.onclick = async () => {
    const msg = text.value.trim();
    if (!msg) return;
    send.disabled = true; send.textContent = 'Sending...';
    try {
      await fetch(`${API_URL}/feedback`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ message: msg, version: chrome.runtime.getManifest().version })
      });
      form.style.display = 'none';
      success.style.display = 'block';
      setTimeout(() => {
        success.style.display = 'none';
        trigger.style.display = 'block';
        text.value = '';
        send.disabled = false; send.textContent = 'Send Feedback';
      }, 3000);
    } catch(e) {
      send.textContent = 'Error. Try again.'; send.disabled = false;
    }
  };
}

// --- Debug & Main ---

function renderDebugUI() {
  if (document.getElementById('debug-panel')) return;
  const panel = document.createElement('div');
  panel.id = 'debug-panel';
  panel.style.cssText = 'margin-top:16px;padding:12px;background:#202124;color:#e8eaed;border-radius:8px;font-size:12px;border:1px solid #5f6368;';
  panel.innerHTML = `
    <div style="font-weight:bold;margin-bottom:8px;color:#8ab4f8;display:flex;justify-content:space-between;"><span>🛠️ Developer Mode</span></div>
    <div style="display:grid;gap:8px;">
      <button id="dbg-test-update" style="cursor:pointer;padding:6px;background:#303134;border:1px solid #5f6368;color:white;border-radius:4px;">Test Update Popup</button>
      <button id="dbg-clear-cache" style="cursor:pointer;padding:6px;background:#303134;border:1px solid #5f6368;color:white;border-radius:4px;">Clear Location Cache</button>
    </div>`;
  document.body.appendChild(panel);
  document.getElementById('dbg-test-update').onclick = () => showFullScreenUpdate('9.9.9-TEST');
  document.getElementById('dbg-clear-cache').onclick = () => {
    chrome.storage.local.remove('twitter_location_cache', () => {
      document.getElementById('dbg-clear-cache').textContent = '✅ Cache Cleared';
    });
  };
}

function init() {
  chrome.storage.local.get([TOGGLE_KEY, BLOCKED_COUNTRIES_KEY, DEBUG_STORAGE_KEY], (res) => {
    // 1. Setup State
    const isEnabled = res[TOGGLE_KEY] !== undefined ? res[TOGGLE_KEY] : DEFAULT_ENABLED;
    updateToggle(isEnabled);
    
    blockedCountries = Array.isArray(res[BLOCKED_COUNTRIES_KEY]) ? res[BLOCKED_COUNTRIES_KEY] : [];
    renderBlockedList();
    
    if (res[DEBUG_STORAGE_KEY]) renderDebugUI();
    
    // 2. Setup Listeners
    els.toggle.addEventListener('click', () => {
      const newState = !els.toggle.classList.contains('enabled');
      updateToggle(newState);
      chrome.storage.local.set({ [TOGGLE_KEY]: newState }, () => {
        notifyContentScript({ type: 'extensionToggle', enabled: newState });
      });
    });

    els.select.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!isDropdownLoaded) populateDropdown();
      els.select.classList.toggle('open');
    });

    window.addEventListener('click', () => els.select.classList.remove('open'));
    
    const headerTitle = document.querySelector('h1');
    if (headerTitle) {
      headerTitle.addEventListener('click', (e) => {
        if (e.detail === 5) {
          chrome.storage.local.get(DEBUG_STORAGE_KEY, (curr) => {
             chrome.storage.local.set({ [DEBUG_STORAGE_KEY]: !curr[DEBUG_STORAGE_KEY] }, () => location.reload());
          });
        }
      });
    }

    // 3. Initialize background tasks
    setTimeout(() => {
      checkRateLimitStatus();
      initUpdateCheck();
      initFeedbackUI();
    }, 50);
  });
}

document.addEventListener('DOMContentLoaded', init);