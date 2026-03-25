// Popup script
const TOGGLE_KEY = 'extension_enabled';
const BLOCKED_COUNTRIES_KEY = 'blocked_countries';
const VERIFIED_ONLY_KEY = 'verified_only_mode';
const AUTO_BLOCK_KEY = 'auto_block_mode';
const PASSPORT_MODE_KEY = 'passport_mode';
const HAS_SEEN_WELCOME_KEY = 'has_seen_welcome';
const DEFAULT_ENABLED = true;
const REPO_URL = 'https://github.com/incconutwo/twitter-account-location-in-username';
const API_URL = 'https://twitter-countries-api.tnemoroccan.workers.dev';
const DEBUG_STORAGE_KEY = 'debug_mode_enabled';
const STATS_KEY = 'extension_stats';
const DEV_DATA_SOURCE_KEY = 'dev_data_source';

// DOM Elements - initialized after DOMContentLoaded
let els = {};

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
  els.status.textContent = '';
  
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

// Custom full-screen confirmation modal for auto-block
function showAutoBlockConfirmation() {
  return new Promise((resolve) => {
    // Create modal overlay
    const modal = document.createElement('div');
    modal.className = 'confirm-modal';
    
    const content = document.createElement('div');
    content.className = 'confirm-content';
    
    // Warning icon
    const icon = document.createElement('div');
    icon.className = 'confirm-icon';
    icon.textContent = '⚠️';
    
    // Title
    const title = document.createElement('h2');
    title.className = 'confirm-title';
    title.textContent = 'Enable Auto-Block?';
    
    // Description
    const desc = document.createElement('p');
    desc.className = 'confirm-desc';
    desc.innerHTML = 'This will <strong>permanently block</strong> Twitter accounts that match your country filter.<br><br>Blocked accounts must be manually unblocked from Twitter settings.';
    
    // Warning box
    const warning = document.createElement('div');
    warning.className = 'confirm-warning';
    warning.textContent = '⚡ This action cannot be undone automatically';
    
    // Buttons
    const btnContainer = document.createElement('div');
    btnContainer.className = 'confirm-buttons';
    
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'confirm-btn cancel';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick = () => { modal.remove(); resolve(false); };
    
    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'confirm-btn danger';
    confirmBtn.textContent = 'Enable Auto-Block';
    confirmBtn.onclick = () => { modal.remove(); resolve(true); };
    
    btnContainer.append(cancelBtn, confirmBtn);
    content.append(icon, title, desc, warning, btnContainer);
    modal.appendChild(content);
    
    // Add styles
    if (!document.getElementById('confirm-modal-style')) {
      const style = document.createElement('style');
      style.id = 'confirm-modal-style';
      style.textContent = `
        .confirm-modal {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: #fff;
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: fadeIn 0.2s ease-out;
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .confirm-content {
          padding: 24px;
          text-align: center;
          max-width: 280px;
        }
        .confirm-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }
        .confirm-title {
          font-size: 18px;
          font-weight: 700;
          margin: 0 0 12px 0;
          color: #0f1419;
        }
        .confirm-desc {
          font-size: 14px;
          color: #536471;
          margin: 0 0 16px 0;
          line-height: 1.4;
        }
        .confirm-warning {
          background: #fef0f0;
          color: #f4212e;
          padding: 10px 12px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 500;
          margin-bottom: 20px;
        }
        .confirm-buttons {
          display: flex;
          gap: 12px;
        }
        .confirm-btn {
          flex: 1;
          padding: 12px 16px;
          border-radius: 999px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          border: none;
          transition: opacity 0.2s;
        }
        .confirm-btn:hover { opacity: 0.9; }
        .confirm-btn.cancel {
          background: #eff3f4;
          color: #0f1419;
        }
        .confirm-btn.danger {
          background: #f4212e;
          color: #fff;
        }
        @media (prefers-color-scheme: dark) {
          .confirm-modal { background: #15202b; }
          .confirm-title { color: #f7f9f9; }
          .confirm-desc { color: #8b98a5; }
          .confirm-warning { background: rgba(244, 33, 46, 0.15); }
          .confirm-btn.cancel { background: #1e2732; color: #f7f9f9; }
        }
      `;
      document.head.appendChild(style);
    }
    
    document.body.appendChild(modal);
  });
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
  els.list.textContent = '';
  if (blockedCountries.length === 0) {
    const empty = document.createElement('span');
    empty.className = 'empty-msg';
    empty.textContent = 'No countries blocked';
    els.list.appendChild(empty);
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
    removeBtn.textContent = '×';
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
  if (manifest.update_url) return; 

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
  
  const span = document.createElement('span');
  span.textContent = `🚀 Update ${version} available`;
  
  const link = document.createElement('a');
  link.href = REPO_URL;
  link.target = '_blank';
  link.textContent = 'Get it';
  link.style.cssText = `color:#0277bd;font-weight:700;margin-left:8px;text-decoration:none;`;
  
  banner.append(span, link);
  banner.style.cssText = `background:#e1f5fe;border:1px solid #b3e5fc;color:#0277bd;padding:10px;border-radius:8px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;animation:slideIn 0.3s;font-size:13px;`;
  
  const header = document.querySelector('.header');
  if (header) header.parentNode.insertBefore(banner, header.nextSibling);
}

function showFullScreenUpdate(version) {
  if (document.querySelector('.update-modal')) return;
  const modal = document.createElement('div');
  modal.className = 'update-modal';
  
  const h2 = document.createElement('h2');
  h2.textContent = 'Update Available';
  
  const p = document.createElement('p');
  const pText = document.createTextNode(`A new version ${version} is ready. `);
  const b = document.createElement('b');
  b.textContent = version;
  p.append(pText, b);
  
  const link = document.createElement('a');
  link.href = REPO_URL;
  link.target = '_blank';
  link.className = 'update-modal-btn';
  link.textContent = 'Get Update';
  
  const btn = document.createElement('button');
  btn.className = 'update-dismiss';
  btn.textContent = 'Remind me later';
  btn.onclick = () => {
    chrome.storage.local.set({ 'dismissed_update_version': version });
    modal.remove();
    showUpdateBanner(version);
  };

  modal.append(h2, p, link, btn);
  
  const style = document.createElement('style');
  style.textContent = `.update-modal{position:fixed;top:0;left:0;width:100%;height:100%;background:#fff;z-index:2000;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center;box-sizing:border-box}.update-modal h2{margin:0 0 12px;font-size:18px}.update-modal-btn{background:#1d9bf0;color:#fff;border:none;padding:10px 24px;border-radius:99px;font-weight:700;text-decoration:none;margin-bottom:16px;cursor:pointer}.update-dismiss{background:none;border:none;color:#536471;cursor:pointer;font-size:13px}@media(prefers-color-scheme:dark){.update-modal{background:#15202b;color:#f7f9f9}.update-dismiss{color:#8b98a5}}`;
  document.head.appendChild(style);
  document.body.appendChild(modal);
}

function initFeedbackUI() {
  const style = document.createElement('style');
  style.textContent = `
    .fb-section { margin-top: 12px; font-size: 12px; }
    .fb-trigger { cursor: pointer; color: #1d9bf0; text-align: left; padding: 4px 0; transition: color 0.2s; font-weight: 500; }
    .fb-trigger:hover { text-decoration: underline; color: #1a8cd8; }
    .fb-form { display: none; position: relative; margin-top: 10px; animation: fbFade 0.2s ease-out; }
    .fb-close { position: absolute; right: 0; top: -22px; cursor: pointer; color: #536471; font-size: 18px; font-weight: bold; padding: 2px 6px; line-height: 1; }
    .fb-close:hover { color: #0f1419; }
    .fb-input { width: 100%; box-sizing: border-box; height: 60px; border: 1px solid #cfd9de; border-radius: 4px; padding: 8px; font-family: inherit; font-size: 13px; resize: none; margin-bottom: 8px; background: #fff; color: #0f1419; display: block; }
    .fb-input:focus { border-color: #1d9bf0; outline: none; }
    .fb-btn { width: 100%; background: #0f1419; color: white; border: none; padding: 8px; border-radius: 999px; font-weight: 700; cursor: pointer; font-size: 13px; transition: opacity 0.2s; }
    .fb-btn:hover { opacity: 0.9; }
    .fb-btn:disabled { opacity: 0.5; cursor: default; }
    .fb-success { display: none; color: #00ba7c; text-align: center; margin-top: 8px; font-weight: 500; }
    @keyframes fbFade { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
    @media (prefers-color-scheme: dark) {
      .fb-close { color: #8b98a5; }
      .fb-close:hover { color: #f7f9f9; }
      .fb-input { background: #15202b; border-color: #38444d; color: #f7f9f9; }
      .fb-input:focus { background: #1e2732; }
      .fb-btn { background: #eff3f4; color: #0f1419; }
    }
  `;
  document.head.appendChild(style);

  const container = document.createElement('div');
  container.className = 'fb-section';

  const trigger = document.createElement('div');
  trigger.id = 'fbTrigger';
  trigger.className = 'fb-trigger';
  trigger.textContent = '💬 Have feedback or found a bug?';

  const form = document.createElement('div');
  form.id = 'fbForm';
  form.className = 'fb-form';

  const close = document.createElement('span');
  close.id = 'fbClose';
  close.className = 'fb-close';
  close.title = 'Dismiss';
  close.textContent = '×';

  const text = document.createElement('textarea');
  text.id = 'fbText';
  text.className = 'fb-input';
  text.placeholder = 'Tell us what you think...';

  const send = document.createElement('button');
  send.id = 'fbSend';
  send.className = 'fb-btn';
  send.textContent = 'Send Feedback';

  const success = document.createElement('div');
  success.id = 'fbSuccess';
  success.className = 'fb-success';
  success.textContent = '✅ Thanks for your feedback!';

  form.append(close, text, send);
  container.append(trigger, form, success);
  document.body.appendChild(container);

  trigger.onclick = () => { trigger.style.display = 'none'; form.style.display = 'block'; text.focus(); };
  close.onclick = () => { form.style.display = 'none'; trigger.style.display = 'block'; };

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
  
  const header = document.createElement('div');
  header.style.cssText = 'font-weight:bold;margin-bottom:8px;color:#8ab4f8;display:flex;justify-content:space-between;';
  header.textContent = '🛠️ Developer Mode';

  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;gap:8px;';

  const btnUpdate = document.createElement('button');
  btnUpdate.id = 'dbg-test-update';
  btnUpdate.textContent = 'Test Update Popup';
  btnUpdate.style.cssText = 'cursor:pointer;padding:6px;background:#303134;border:1px solid #5f6368;color:white;border-radius:4px;';
  
  const btnClear = document.createElement('button');
  btnClear.id = 'dbg-clear-cache';
  btnClear.textContent = 'Clear Location Cache';
  btnClear.style.cssText = 'cursor:pointer;padding:6px;background:#303134;border:1px solid #5f6368;color:white;border-radius:4px;';

  const sourceLabel = document.createElement('label');
  sourceLabel.textContent = 'Data Source:';
  sourceLabel.style.cssText = 'font-weight:bold; margin-top:8px; display:block;';
  
  const sourceSelect = document.createElement('select');
  sourceSelect.id = 'dbg-data-source';
  sourceSelect.style.cssText = 'width:100%; padding:6px; background:#303134; border:1px solid #5f6368; color:white; border-radius:4px; margin-top:4px; margin-bottom: 8px; font-family:inherit;';
  
  const options = [
    { text: 'Auto (Default)', value: 'auto' },
    { text: 'Local Cache Only', value: 'cache_only' },
    { text: 'Cloudflare API Only', value: 'cloudflare_only' },
    { text: 'Twitter API Only', value: 'twitter_only' }
  ];
  
  options.forEach(opt => {
    const option = document.createElement('option');
    option.value = opt.value;
    option.textContent = opt.text;
    sourceSelect.appendChild(option);
  });
  
  chrome.storage.local.get(DEV_DATA_SOURCE_KEY, (res) => {
    if (res[DEV_DATA_SOURCE_KEY]) {
      sourceSelect.value = res[DEV_DATA_SOURCE_KEY];
    } else {
      sourceSelect.value = 'auto';
    }
  });

  sourceSelect.addEventListener('change', (e) => {
    const val = e.target.value;
    chrome.storage.local.set({ [DEV_DATA_SOURCE_KEY]: val }, () => {
      notifyContentScript({ type: 'devDataSourceUpdate', source: val });
    });
  });

  grid.append(btnUpdate, btnClear);
  panel.append(header, grid, sourceLabel, sourceSelect);
  document.body.appendChild(panel);

  btnUpdate.onclick = () => showFullScreenUpdate('9.9.9-TEST');
  btnClear.onclick = () => {
    chrome.storage.local.remove('twitter_location_cache', () => {
      btnClear.textContent = '✅ Cache Cleared';
    });
  };
}

function init() {
  // Initialize DOM element references
  els = {
    toggle: document.getElementById('toggleSwitch'),
    list: document.getElementById('blockedList'),
    select: document.getElementById('customSelect'),
    options: document.getElementById('customOptions'),
    status: document.getElementById('apiStatus'),
    verifiedOnly: document.getElementById('verifiedOnlyToggle'),
    autoBlock: document.getElementById('autoBlockToggle'),
    passportMode: document.getElementById('passportModeToggle')
  };

  // Verify critical elements exist
  if (!els.toggle || !els.list) {
    console.error('Critical popup elements not found');
    return;
  }

  chrome.storage.local.get([TOGGLE_KEY, BLOCKED_COUNTRIES_KEY, DEBUG_STORAGE_KEY, VERIFIED_ONLY_KEY, AUTO_BLOCK_KEY, PASSPORT_MODE_KEY, STATS_KEY], (res) => {
    // 1. Setup State
    const isEnabled = res[TOGGLE_KEY] !== undefined ? res[TOGGLE_KEY] : DEFAULT_ENABLED;
    updateToggle(isEnabled);
    
    blockedCountries = Array.isArray(res[BLOCKED_COUNTRIES_KEY]) ? res[BLOCKED_COUNTRIES_KEY] : [];
    renderBlockedList();
    
    // Setup new toggles
    if (res[VERIFIED_ONLY_KEY]) els.verifiedOnly.classList.add('enabled');
    if (res[AUTO_BLOCK_KEY]) els.autoBlock.classList.add('enabled');
    // Default to enabled if not set
    if (res[PASSPORT_MODE_KEY] !== false) els.passportMode.classList.add('enabled');

    
    // Load stats
    const stats = res[STATS_KEY] || { hiddenPosts: 0, blockedAccounts: 0 };
    document.getElementById('hiddenPostsCount').textContent = stats.hiddenPosts.toLocaleString();
    document.getElementById('blockedAccountsCount').textContent = stats.blockedAccounts.toLocaleString();
    
    if (res[DEBUG_STORAGE_KEY]) renderDebugUI();
    
    // 2. Setup Listeners
    els.toggle.addEventListener('click', () => {
      const newState = !els.toggle.classList.contains('enabled');
      updateToggle(newState);
      chrome.storage.local.set({ [TOGGLE_KEY]: newState }, () => {
        notifyContentScript({ type: 'extensionToggle', enabled: newState });
      });
    });
    
    els.verifiedOnly.addEventListener('click', () => {
      const newState = !els.verifiedOnly.classList.contains('enabled');
      els.verifiedOnly.classList.toggle('enabled', newState);
      chrome.storage.local.set({ [VERIFIED_ONLY_KEY]: newState }, () => {
        notifyContentScript({ type: 'verifiedOnlyUpdate', enabled: newState });
      });
    });
    
    els.autoBlock.addEventListener('click', async () => {
      const newState = !els.autoBlock.classList.contains('enabled');
      if (newState) {
        const confirmed = await showAutoBlockConfirmation();
        if (!confirmed) return;
      }
      els.autoBlock.classList.toggle('enabled', newState);
      chrome.storage.local.set({ [AUTO_BLOCK_KEY]: newState }, () => {
        notifyContentScript({ type: 'autoBlockUpdate', enabled: newState });
      });
    });

    els.passportMode.addEventListener('click', () => {
      const newState = !els.passportMode.classList.contains('enabled');
      els.passportMode.classList.toggle('enabled', newState);
      chrome.storage.local.set({ [PASSPORT_MODE_KEY]: newState }, () => {
        notifyContentScript({ type: 'passportModeUpdate', enabled: newState });
      });
    });

    // Dashboard button handler
    const dashboardBtn = document.getElementById('openDashboard');
    if (dashboardBtn) {
      dashboardBtn.addEventListener('click', () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
      });
    }

    els.select.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!isDropdownLoaded) populateDropdown();
      els.select.classList.toggle('open');
    });

    window.addEventListener('click', () => els.select.classList.remove('open'));
    
    // Stats toggle
    const statsToggle = document.getElementById('statsToggle');
    const statsContainer = document.getElementById('statsContainer');
    if (statsToggle && statsContainer) {
      statsToggle.addEventListener('click', () => {
        statsToggle.classList.toggle('open');
        statsContainer.hidden = !statsContainer.hidden;
      });
    }
    
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
      initWelcomeScreen();
      initKofiModal();
    }, 50);
  });
}

// --- Auto-Update Checker (Store-Safe) ---

async function initUpdateCheck() {
  const manifest = chrome.runtime.getManifest();
  if (manifest.update_url) return; // Disables check for Store installs

  try {
    const res = await fetch('https://raw.githubusercontent.com/incconutwo/twitter-account-location-in-username/main/chrome/manifest.json');
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
  
  const style = document.createElement('style');
  style.textContent = `.update-modal{position:fixed;top:0;left:0;width:100%;height:100%;background:#fff;z-index:2000;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center;box-sizing:border-box}.update-modal h2{margin:0 0 12px;font-size:18px}.update-modal-btn{background:#1d9bf0;color:#fff;border:none;padding:10px 24px;border-radius:99px;font-weight:700;text-decoration:none;margin-bottom:16px;cursor:pointer;display:inline-block}.update-dismiss{background:none;border:none;color:#536471;cursor:pointer;font-size:13px}@media(prefers-color-scheme:dark){.update-modal{background:#15202b;color:#f7f9f9}.update-dismiss{color:#8b98a5}}`;
  document.head.appendChild(style);

  modal.querySelector('.update-dismiss').onclick = () => {
    chrome.storage.local.set({ 'dismissed_update_version': version });
    modal.remove();
    showUpdateBanner(version);
  };
  document.body.appendChild(modal);
}

// --- Welcome Screen (First Time) ---
function initWelcomeScreen() {
  chrome.storage.local.get(HAS_SEEN_WELCOME_KEY, (res) => {
    if (res[HAS_SEEN_WELCOME_KEY]) return; // Already seen

    const welcomeModal = document.getElementById('welcomeModal');
    const closeBtn = document.getElementById('closeWelcomeModal');

    if (!welcomeModal || !closeBtn) return;

    // Show welcome modal
    welcomeModal.hidden = false;

    // Close handler
    closeBtn.addEventListener('click', () => {
      welcomeModal.hidden = true;
      chrome.storage.local.set({ [HAS_SEEN_WELCOME_KEY]: true });
    });
  });
}

// --- Feedback System ---
const FEEDBACK_API_URL = 'https://twitter-countries-api.tnemoroccan.workers.dev/feedback';

function initFeedbackUI() {
  const feedbackTrigger = document.getElementById('feedbackTrigger');
  const feedbackBox = document.getElementById('feedbackBox');
  const closeFeedback = document.getElementById('closeFeedback');
  const sendFeedback = document.getElementById('sendFeedback');
  const feedbackInput = document.getElementById('feedbackInput');
  const feedbackStatus = document.getElementById('feedbackStatus');
  const donationModal = document.getElementById('donationModal');
  const closeDonationModal = document.getElementById('closeDonationModal');
  const ticketIdDisplay = document.getElementById('ticketIdDisplay');
  const copyTicketBtn = document.getElementById('copyTicketBtn');
  const copyFeedback = document.getElementById('copyFeedback');

  if (!feedbackTrigger) return;

  const generateTicketId = () => 'TF-' + Math.random().toString(36).substring(2, 8).toUpperCase();

  feedbackTrigger.addEventListener('click', () => {
    feedbackBox.hidden = false;
    feedbackTrigger.hidden = true;
    feedbackInput?.focus();
  });

  const resetFeedbackUI = () => {
    feedbackBox.hidden = true;
    feedbackTrigger.hidden = false;
    feedbackStatus.hidden = true;
    feedbackStatus.textContent = '';
    feedbackStatus.className = 'feedback-status';
  };

  closeFeedback?.addEventListener('click', resetFeedbackUI);

  closeDonationModal?.addEventListener('click', () => {
    donationModal.hidden = true;
    resetFeedbackUI();
  });

  copyTicketBtn?.addEventListener('click', () => {
    navigator.clipboard.writeText(ticketIdDisplay.textContent);
    copyFeedback?.classList.add('visible');
    setTimeout(() => copyFeedback?.classList.remove('visible'), 2000);
  });

  sendFeedback?.addEventListener('click', async () => {
    const text = feedbackInput?.value.trim();
    if (!text) return;

    sendFeedback.disabled = true;
    sendFeedback.textContent = 'Sending...';
    feedbackStatus.hidden = true;

    const ticketId = generateTicketId();

    try {
      const response = await fetch(FEEDBACK_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          version: chrome.runtime.getManifest().version,
          ticketId: ticketId
        })
      });

      if (response.ok) {
        ticketIdDisplay.textContent = '#' + ticketId;
        donationModal.hidden = false;
        feedbackInput.value = '';
        feedbackBox.hidden = true;
      } else {
        throw new Error('Server Error');
      }
    } catch (err) {
      console.error(err);
      feedbackStatus.textContent = 'Failed. Try again.';
      feedbackStatus.className = 'feedback-status error';
      feedbackStatus.hidden = false;
    } finally {
      sendFeedback.disabled = false;
      sendFeedback.textContent = 'Send Feedback';
    }
  });
}


// --- Ko-fi Modal ---
function initKofiModal() {
  const kofiTrigger = document.getElementById('kofiTrigger');
  const kofiModal = document.getElementById('kofiModal');
  const closeKofiModal = document.getElementById('closeKofiModal');

  if (!kofiTrigger || !kofiModal || !closeKofiModal) return;

  kofiTrigger.addEventListener('click', () => {
    kofiModal.hidden = false;
  });

  closeKofiModal.addEventListener('click', () => {
    kofiModal.hidden = true;
  });

  // Close modal when clicking outside the content
  kofiModal.addEventListener('click', (e) => {
    if (e.target === kofiModal) {
      kofiModal.hidden = true;
    }
  });
}

document.addEventListener('DOMContentLoaded', init);