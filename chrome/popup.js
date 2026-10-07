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
const ALWAYS_LOAD_COMMENTS_KEY = 'always_load_comments';
const BLOCK_VPN_KEY = 'block_vpn_mode';
const BYPASS_FOLLOWED_KEY = 'bypass_followed_mode';
const IS_PRO_KEY = 'is_pro_member';
const PRO_DATA_KEY = 'pro_membership_data';
const PRO_DEVICE_CODE_KEY = 'pro_device_code';
const VERIFY_PRO_URL = `${API_URL}/verify-pro`;

// DOM Elements - initialized after DOMContentLoaded
let els = {};

let blockedCountries = [];
let isDropdownLoaded = false;

// --- Helpers ---

function trackEvent(name, data) {
  try {
    chrome.runtime.sendMessage({
      type: 'sendTelemetry',
      url: '/popup',
      eventName: name,
      data
    }).catch(() => {});
  } catch (_) {}
}

function updateStatusUI(type, resetTime) {
  els.status.style.display = 'flex';
  els.status.className = 'api-status';
  els.status.textContent = '';
  
  const icon = document.createElement('span');
  icon.className = 'api-status-icon';
  icon.style.display = 'inline-flex';
  icon.style.alignItems = 'center';
  const text = document.createElement('span');

  if (type === 'good') {
    els.status.classList.add('green');
    icon.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#00ba7c" fill-opacity="0.2" stroke="#00ba7c" stroke-width="2"/><path d="m9 12 2 2 4-4" stroke="#00ba7c" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    text.textContent = ' API Status: Good';
  } else if (type === 'limited') {
    els.status.classList.add('red');
    const min = Math.max(0, Math.ceil((resetTime - (Date.now()/1000)) / 60));
    icon.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" fill="#f4212e" fill-opacity="0.2" stroke="#f4212e" stroke-width="2"/><line x1="12" y1="9" x2="12" y2="13" stroke="#f4212e" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="17" r="1" fill="#f4212e"/></svg>';
    text.textContent = ` Rate Limited (${min}m left)`;
  } else if (type === 'inactive') {
    els.status.style.color = '#536471';
    icon.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#536471" stroke-width="2"/><line x1="12" y1="16" x2="12" y2="12" stroke="#536471" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="8" r="1" fill="#536471"/></svg>';
    text.textContent = ' Go to X.com to use';
  } else {
    icon.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24"><circle cx="12" cy="12" r="7" fill="#8b98a5"/></svg>';
    text.textContent = ' Status: Unknown';
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
    icon.innerHTML = '<svg width="44" height="44" viewBox="0 0 24 24" fill="none"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" fill="#f4212e" fill-opacity="0.16" stroke="#f4212e" stroke-width="1.75" stroke-linejoin="round"/><line x1="12" y1="9" x2="12" y2="13" stroke="#f4212e" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="17" r="1" fill="#f4212e"/></svg>';
    
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
    warning.textContent = 'This action cannot be undone automatically';
    
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
  trackEvent('toggle_country', { country, action: add ? 'block' : 'unblock' });
  
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

// (Update check, feedback — defined below init())

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

  const btnWelcome = document.createElement('button');
  btnWelcome.id = 'dbg-show-welcome';
  btnWelcome.textContent = 'Show Welcome Screen';
  btnWelcome.style.cssText = 'cursor:pointer;padding:6px;background:#303134;border:1px solid #5f6368;color:white;border-radius:4px;';

  const btnM100 = document.createElement('button');
  btnM100.textContent = 'Test 100 Milestone';
  btnM100.style.cssText = 'cursor:pointer;padding:6px;background:#1d9bf033;border:1px solid #1d9bf066;color:#1d9bf0;border-radius:4px;font-weight:bold;';

  const btnM500 = document.createElement('button');
  btnM500.textContent = 'Test 500 Milestone';
  btnM500.style.cssText = 'cursor:pointer;padding:6px;background:#1d9bf033;border:1px solid #1d9bf066;color:#1d9bf0;border-radius:4px;font-weight:bold;';

  const btnM2500 = document.createElement('button');
  btnM2500.textContent = 'Test 2500 Milestone';
  btnM2500.style.cssText = 'cursor:pointer;padding:6px;background:#1d9bf033;border:1px solid #1d9bf066;color:#1d9bf0;border-radius:4px;font-weight:bold;';

  const btnTriggerRating = document.createElement('button');
  btnTriggerRating.id = 'dbg-trigger-rating';
  btnTriggerRating.textContent = 'Force Show Rating Widget';
  btnTriggerRating.style.cssText = 'cursor:pointer;padding:6px;background:#303134;border:1px solid #5f6368;color:white;border-radius:4px;';
  btnTriggerRating.onclick = () => {
    const widget = document.getElementById('ratingWidget');
    if (widget) widget.hidden = false;
  };

  const btnResetRating = document.createElement('button');
  btnResetRating.id = 'dbg-reset-rating';
  btnResetRating.textContent = 'Reset Rating State';
  btnResetRating.style.cssText = 'cursor:pointer;padding:6px;background:#303134;border:1px solid #5f6368;color:white;border-radius:4px;';
  btnResetRating.onclick = () => {
    chrome.storage.local.remove(['has_rated', 'dismissed_rating'], () => {
      btnResetRating.textContent = '✅ Rating State Reset';
      setTimeout(() => btnResetRating.textContent = 'Reset Rating State', 2000);
    });
  };

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

  const bannerLabel = document.createElement('label');
  bannerLabel.style.cssText = 'display:flex; align-items:center; gap:8px; margin-top:12px; font-weight:bold; cursor:pointer;';
  
  const bannerCheck = document.createElement('input');
  bannerCheck.type = 'checkbox';
  bannerCheck.id = 'dbg-show-source-banner';
  
  bannerLabel.append(bannerCheck, document.createTextNode('Show Data Source Banner'));
  
  chrome.storage.local.get('dev_show_source_banner', (res) => {
    bannerCheck.checked = !!res.dev_show_source_banner;
  });

  bannerCheck.addEventListener('change', (e) => {
    const val = e.target.checked;
    chrome.storage.local.set({ dev_show_source_banner: val }, () => {
      notifyContentScript({ type: 'devBannerUpdate', enabled: val });
    });
  });

  grid.append(btnUpdate, btnClear, btnWelcome, btnM100, btnM500, btnM2500, btnTriggerRating, btnResetRating);
  panel.append(header, grid, sourceLabel, sourceSelect, bannerLabel);
  document.body.appendChild(panel);

  btnUpdate.onclick = () => showFullScreenUpdate('9.9.9-TEST');
  btnClear.onclick = () => {
    // Remove all versioned cache keys and the specific v4 key
    chrome.storage.local.get(null, (all) => {
      const keys = Object.keys(all).filter(k => k.startsWith('twitter_location_cache'));
      chrome.storage.local.remove(keys, () => {
        // Also clear the negative map if it exists
        chrome.storage.local.remove('negative_cache', () => {
          btnClear.textContent = '✅ Cache Cleared';
          notifyContentScript({ type: 'cacheCleared' });
        });
      });
    });
  };
  btnWelcome.onclick = () => {
    const modal = document.getElementById('welcomeModal');
    if (modal) modal.hidden = false;
  };

  btnM100.onclick = () => chrome.runtime.sendMessage({ type: 'testMilestone', count: 100 });
  btnM500.onclick = () => chrome.runtime.sendMessage({ type: 'testMilestone', count: 500 });
  btnM2500.onclick = () => chrome.runtime.sendMessage({ type: 'testMilestone', count: 2500 });
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
    passportMode: document.getElementById('passportModeToggle'),
    alwaysLoadComments: document.getElementById('alwaysLoadCommentsToggle'),
    blockVpn: document.getElementById('blockVpnToggle'),
    bypassFollowed: document.getElementById('bypassFollowedToggle')
  };

  // Verify critical elements exist
  if (!els.toggle || !els.list) {
    console.error('Critical popup elements not found');
    return;
  }

  chrome.storage.local.get([TOGGLE_KEY, BLOCKED_COUNTRIES_KEY, DEBUG_STORAGE_KEY, VERIFIED_ONLY_KEY, AUTO_BLOCK_KEY, PASSPORT_MODE_KEY, ALWAYS_LOAD_COMMENTS_KEY, BLOCK_VPN_KEY, BYPASS_FOLLOWED_KEY, STATS_KEY, 'has_rated', 'dismissed_rating'], (res) => {
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
    if (res[ALWAYS_LOAD_COMMENTS_KEY]) els.alwaysLoadComments.classList.add('enabled');
    if (res[BLOCK_VPN_KEY]) els.blockVpn.classList.add('enabled');
    if (res[BYPASS_FOLLOWED_KEY] !== false) els.bypassFollowed?.classList.add('enabled');
    
    // Load stats with backward compatibility
    const rawStats = res[STATS_KEY] || {};
    const stats = {
      hiddenPosts: Number(rawStats.hiddenPosts) || 0,
      blockedAccounts: Number(rawStats.blockedAccounts) || 0,
      seenCountries: rawStats.seenCountries || {},
      totalScanned: Number(rawStats.totalScanned) || 0
    };
    document.getElementById('hiddenPostsCount').textContent = stats.hiddenPosts.toLocaleString();
    document.getElementById('blockedAccountsCount').textContent = stats.blockedAccounts.toLocaleString();
    document.getElementById('totalScannedCount').textContent = stats.totalScanned.toLocaleString();

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes[STATS_KEY]?.newValue) {
        const updated = changes[STATS_KEY].newValue;
        document.getElementById('hiddenPostsCount').textContent = (Number(updated.hiddenPosts) || 0).toLocaleString();
        document.getElementById('blockedAccountsCount').textContent = (Number(updated.blockedAccounts) || 0).toLocaleString();
        document.getElementById('totalScannedCount').textContent = (Number(updated.totalScanned) || 0).toLocaleString();
      }
    });
    
    if (res[DEBUG_STORAGE_KEY]) renderDebugUI();
    initRatingUI(stats, res.has_rated, res.dismissed_rating);
    trackEvent('popup_open');
    
    // 2. Setup Listeners
    els.toggle.addEventListener('click', () => {
      const newState = !els.toggle.classList.contains('enabled');
      updateToggle(newState);
      trackEvent('toggle_setting', { setting: 'extension_enabled', value: newState });
      chrome.storage.local.set({ [TOGGLE_KEY]: newState }, () => {
        notifyContentScript({ type: 'extensionToggle', enabled: newState });
      });
    });
    
    els.verifiedOnly.addEventListener('click', () => {
      const newState = !els.verifiedOnly.classList.contains('enabled');
      els.verifiedOnly.classList.toggle('enabled', newState);
      trackEvent('toggle_setting', { setting: 'verified_only_mode', value: newState });
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
      trackEvent('toggle_setting', { setting: 'auto_block_mode', value: newState });
      chrome.storage.local.set({ [AUTO_BLOCK_KEY]: newState }, () => {
        notifyContentScript({ type: 'autoBlockUpdate', enabled: newState });
      });
    });

    els.passportMode.addEventListener('click', () => {
      const newState = !els.passportMode.classList.contains('enabled');
      els.passportMode.classList.toggle('enabled', newState);
      trackEvent('toggle_setting', { setting: 'passport_mode', value: newState });
      chrome.storage.local.set({ [PASSPORT_MODE_KEY]: newState }, () => {
        notifyContentScript({ type: 'passportModeUpdate', enabled: newState });
      });
    });

    els.alwaysLoadComments.addEventListener('click', () => {
      const newState = !els.alwaysLoadComments.classList.contains('enabled');
      els.alwaysLoadComments.classList.toggle('enabled', newState);
      trackEvent('toggle_setting', { setting: 'always_load_comments', value: newState });
      chrome.storage.local.set({ [ALWAYS_LOAD_COMMENTS_KEY]: newState }, () => {
        notifyContentScript({ type: 'alwaysLoadCommentsUpdate', enabled: newState });
      });
    });

    els.blockVpn.addEventListener('click', () => {
      const newState = !els.blockVpn.classList.contains('enabled');
      els.blockVpn.classList.toggle('enabled', newState);
      trackEvent('toggle_setting', { setting: 'block_vpn_mode', value: newState });
      chrome.storage.local.set({ [BLOCK_VPN_KEY]: newState }, () => {
        notifyContentScript({ type: 'blockVpnUpdate', enabled: newState });
      });
    });

    els.bypassFollowed?.addEventListener('click', () => {
      const newState = !els.bypassFollowed.classList.contains('enabled');
      els.bypassFollowed.classList.toggle('enabled', newState);
      trackEvent('toggle_setting', { setting: 'bypass_followed_mode', value: newState });
      chrome.storage.local.set({ [BYPASS_FOLLOWED_KEY]: newState }, () => {
        notifyContentScript({ type: 'bypassFollowedUpdate', enabled: newState });
      });
    });

    els.select.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!isDropdownLoaded) populateDropdown();
      els.select.classList.toggle('open');
    });

    window.addEventListener('click', () => els.select.classList.remove('open'));
    
    // Dashboard button handler
    const dashboardBtn = document.getElementById('openDashboard');
    if (dashboardBtn) {
      dashboardBtn.addEventListener('click', () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
      });
    }
    
    let clickCount = 0;
    let clickTimeout = null;
    const headerTitle = document.querySelector('h1');
    if (headerTitle) {
      headerTitle.addEventListener('click', () => {
        clickCount++;
        if (clickTimeout) clearTimeout(clickTimeout);
        clickTimeout = setTimeout(() => {
          clickCount = 0;
        }, 1000);

        if (clickCount === 5) {
          clickCount = 0;
          chrome.storage.local.get(DEBUG_STORAGE_KEY, (curr) => {
            const newDebug = !curr[DEBUG_STORAGE_KEY];
            const updates = { [DEBUG_STORAGE_KEY]: newDebug };
            // Reset dev data source when debug mode is turned off
            if (!newDebug) updates[DEV_DATA_SOURCE_KEY] = 'auto';
            chrome.storage.local.set(updates, () => location.reload());
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
      initProModal();
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
  const span = document.createElement('span');
  span.style.cssText = 'display:inline-flex;align-items:center;gap:6px;';
  span.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0277bd" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="16 12 12 8 8 12"/><line x1="12" y1="16" x2="12" y2="8"/></svg> Update ${version} available`;
  const link = document.createElement('a');
  link.href = REPO_URL; link.target = '_blank'; link.textContent = 'Get it';
  link.style.cssText = 'color:#0277bd;font-weight:700;margin-left:8px;text-decoration:none;';
  banner.append(span, link);
  banner.style.cssText = 'background:#e1f5fe;border:1px solid #b3e5fc;color:#0277bd;padding:10px;border-radius:8px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;animation:slideIn 0.3s;font-size:13px;';
  
  const header = document.querySelector('.header');
  if (header) header.parentNode.insertBefore(banner, header.nextSibling);
}

function showFullScreenUpdate(version) {
  if (document.querySelector('.update-modal')) return;
  const modal = document.createElement('div');
  modal.className = 'update-modal';
  const h2 = document.createElement('h2'); h2.textContent = 'Update Available';
  const p = document.createElement('p'); p.textContent = `A new version ${version} is ready.`;
  const a = document.createElement('a'); a.href = REPO_URL; a.target = '_blank';
  a.className = 'update-modal-btn'; a.textContent = 'Get Update';
  const btn = document.createElement('button'); btn.className = 'update-dismiss';
  btn.textContent = 'Remind me later';
  btn.onclick = () => { chrome.storage.local.set({ 'dismissed_update_version': version }); modal.remove(); showUpdateBanner(version); };
  modal.append(h2, p, a, btn);

  const style = document.createElement('style');
  style.textContent = `.update-modal{position:fixed;top:0;left:0;width:100%;height:100%;background:#fff;z-index:2000;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center;box-sizing:border-box}.update-modal h2{margin:0 0 12px;font-size:18px}.update-modal-btn{background:#1d9bf0;color:#fff;border:none;padding:10px 24px;border-radius:99px;font-weight:700;text-decoration:none;margin-bottom:16px;cursor:pointer;display:inline-block}.update-dismiss{background:none;border:none;color:#536471;cursor:pointer;font-size:13px}@media(prefers-color-scheme:dark){.update-modal{background:#15202b;color:#f7f9f9}.update-dismiss{color:#8b98a5}}`;
  document.head.appendChild(style);
  document.body.appendChild(modal);
}

// --- Welcome Screen (First Time) ---
function initWelcomeScreen() {
  const welcomeModal = document.getElementById('welcomeModal');
  const closeBtn = document.getElementById('closeWelcomeModal');

  if (!welcomeModal || !closeBtn) return;

  // Always attach the listener so Developer Mode works
  closeBtn.addEventListener('click', () => {
    welcomeModal.hidden = true;
    chrome.storage.local.set({ [HAS_SEEN_WELCOME_KEY]: true });
  });

  chrome.storage.local.get(HAS_SEEN_WELCOME_KEY, (res) => {
    if (res[HAS_SEEN_WELCOME_KEY]) return; // Already seen
    welcomeModal.hidden = false;
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


// --- Pro Membership System ---
function initProModal() {
  const proBadgeBtn = document.getElementById('proBadgeBtn');
  const proBadgeText = document.getElementById('proBadgeText');
  const proModal = document.getElementById('proModal');
  const closeProModal = document.getElementById('closeProModal');
  const proCodeDisplay = document.getElementById('proCodeDisplay');
  const copyProCodeBtn = document.getElementById('copyProCodeBtn');
  const copyProFeedback = document.getElementById('copyProFeedback');
  const proKeyInput = document.getElementById('proKeyInput');
  const activateProBtn = document.getElementById('activateProBtn');
  const proActivationStatus = document.getElementById('proActivationStatus');
  const proModalTitle = document.getElementById('proModalTitle');
  const proModalSub = document.getElementById('proModalSub');

  if (!proBadgeBtn || !proModal) return;

  function setProActiveUI(proData) {
    if (proBadgeBtn) {
      proBadgeBtn.classList.add('active');
      if (proBadgeText) proBadgeText.textContent = 'PRO';
      proBadgeBtn.title = 'Supporter Pro Active!';
    }
    if (proModalTitle) proModalTitle.textContent = 'Pro Supporter Active';
    if (proModalSub) {
      const tier = proData?.tier || 'Supporter';
      proModalSub.textContent = `Thank you for supporting this project! (${tier})`;
    }
  }

  // 1. Get or Generate Unique Device Activation Code
  chrome.storage.local.get([IS_PRO_KEY, PRO_DATA_KEY, PRO_DEVICE_CODE_KEY], (res) => {
    let deviceCode = res[PRO_DEVICE_CODE_KEY];
    if (!deviceCode) {
      deviceCode = 'PRO-' + Math.random().toString(36).substring(2, 8).toUpperCase();
      chrome.storage.local.set({ [PRO_DEVICE_CODE_KEY]: deviceCode });
    }
    if (proCodeDisplay) proCodeDisplay.textContent = '#' + deviceCode;

    // 2. Check Pro Status
    if (res[IS_PRO_KEY]) {
      setProActiveUI(res[PRO_DATA_KEY]);
    }
  });

  // 3. Open / Close Modal
  proBadgeBtn.addEventListener('click', () => {
    proModal.hidden = false;
  });

  closeProModal?.addEventListener('click', () => {
    proModal.hidden = true;
  });

  proModal.addEventListener('click', (e) => {
    if (e.target === proModal) proModal.hidden = true;
  });

  // 4. Copy Code Button
  copyProCodeBtn?.addEventListener('click', () => {
    const code = proCodeDisplay ? proCodeDisplay.textContent : '';
    navigator.clipboard.writeText(code).then(() => {
      copyProFeedback?.classList.add('visible');
      setTimeout(() => copyProFeedback?.classList.remove('visible'), 2000);
    });
  });

  // 5. Activate Pro Handler
  activateProBtn?.addEventListener('click', async () => {
    const key = (proKeyInput?.value || '').trim();
    if (!key) {
      if (proActivationStatus) {
        proActivationStatus.textContent = 'Please enter your code or Ko-fi transaction ID.';
        proActivationStatus.className = 'feedback-status error';
        proActivationStatus.hidden = false;
      }
      return;
    }

    if (key.includes('@')) {
      if (proActivationStatus) {
        proActivationStatus.textContent = 'Please enter your private Ko-fi Transaction ID (from receipt) instead of an email address.';
        proActivationStatus.className = 'feedback-status error';
        proActivationStatus.hidden = false;
      }
      return;
    }

    activateProBtn.disabled = true;
    activateProBtn.textContent = 'Verifying...';
    if (proActivationStatus) proActivationStatus.hidden = true;

    try {
      const response = await fetch(VERIFY_PRO_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: key })
      });

      const data = await response.json();

      if (response.ok && data.valid) {
        const proPayload = {
          tier: data.tier,
          name: data.supporter_name,
          key: data.activation_key || key,
          activatedAt: data.activated_at || Date.now()
        };

        chrome.storage.local.set({
          [IS_PRO_KEY]: true,
          [PRO_DATA_KEY]: proPayload
        });

        if (chrome.storage.sync) {
          chrome.storage.sync.set({ [IS_PRO_KEY]: true, [PRO_DATA_KEY]: proPayload }, () => {});
        }

        setProActiveUI(proPayload);

        if (proActivationStatus) {
          proActivationStatus.textContent = 'Pro unlocked successfully! Thank you!';
          proActivationStatus.className = 'feedback-status success';
          proActivationStatus.hidden = false;
        }

        notifyContentScript({ type: 'proStatusUpdated', isPro: true, proData: proPayload });

        setTimeout(() => {
          if (proModal) proModal.hidden = true;
        }, 1800);
      } else {
        if (proActivationStatus) {
          proActivationStatus.textContent = data.error || 'Activation failed. Check code and try again.';
          proActivationStatus.className = 'feedback-status error';
          proActivationStatus.hidden = false;
        }
      }
    } catch (err) {
      console.error(err);
      if (proActivationStatus) {
        proActivationStatus.textContent = 'Network error. Please try again.';
        proActivationStatus.className = 'feedback-status error';
        proActivationStatus.hidden = false;
      }
    } finally {
      activateProBtn.disabled = false;
      activateProBtn.textContent = 'Activate';
    }
  });
}

// --- Rating System ---
function initRatingUI(stats, hasRated, dismissedRating) {
  const widget = document.getElementById('ratingWidget');
  const closeBtn = document.getElementById('closeRatingWidget');
  const starsContainer = document.getElementById('ratingStars');
  const feedbackBox = document.getElementById('ratingFeedbackBox');
  const commentInput = document.getElementById('ratingComment');
  const submitBtn = document.getElementById('submitRating');
  const statusEl = document.getElementById('ratingStatus');

  if (!widget || !starsContainer) return;

  let selectedRating = 0;

  // Show widget if eligible
  if (stats.totalScanned >= 500 && !hasRated && !dismissedRating) {
    widget.hidden = false;
  }

  // Handle Close / Dismiss
  closeBtn?.addEventListener('click', () => {
    widget.hidden = true;
    chrome.storage.local.set({ dismissed_rating: true });
  });

  // Handle Stars interaction
  const stars = starsContainer.querySelectorAll('.star');
  
  stars.forEach((star, index) => {
    // Mouse enter highlights stars up to current
    star.addEventListener('mouseenter', () => {
      stars.forEach((s, idx) => {
        s.classList.toggle('selected', idx <= index);
      });
    });

    // Click sets rating and shows feedback comment section
    star.addEventListener('click', () => {
      selectedRating = index + 1;
      stars.forEach((s, idx) => {
        s.classList.toggle('selected', idx < selectedRating);
      });
      if (feedbackBox) feedbackBox.hidden = false;
    });
  });

  // Revert to selected rating when mouse leaves stars container
  starsContainer.addEventListener('mouseleave', () => {
    stars.forEach((s, idx) => {
      s.classList.toggle('selected', idx < selectedRating);
    });
  });

  // Submit handler
  submitBtn?.addEventListener('click', async () => {
    if (selectedRating === 0) return;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';
    if (statusEl) statusEl.hidden = true;

    try {
      const response = await fetch(FEEDBACK_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: selectedRating,
          message: commentInput?.value.trim() || null,
          version: chrome.runtime.getManifest().version
        })
      });

      if (response.ok) {
        if (statusEl) {
          statusEl.textContent = 'Thank you for your rating!';
          statusEl.className = 'rating-status success';
          statusEl.hidden = false;
        }
        chrome.storage.local.set({ has_rated: true });
        setTimeout(() => {
          widget.hidden = true;
        }, 1500);
      } else {
        throw new Error('Server Error');
      }
    } catch (err) {
      console.error(err);
      if (statusEl) {
        statusEl.textContent = 'Failed to submit. Please try again.';
        statusEl.className = 'rating-status error';
        statusEl.hidden = false;
      }
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Rating';
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  init();
  document.querySelectorAll('a[href*="ko-fi.com"]').forEach(link => {
    link.addEventListener('click', () => {
      trackEvent('kofi_clicked', { source: link.id || 'popup' });
    });
  });
  document.querySelectorAll('a[href*="chromewebstore.google.com"], a[href*="addons.mozilla.org"]').forEach(link => {
    link.addEventListener('click', () => {
      trackEvent('review_clicked', { source: 'popup' });
    });
  });
});