// Popup script
const TOGGLE_KEY = 'extension_enabled';
const BLOCKED_COUNTRIES_KEY = 'blocked_countries';
const DEFAULT_ENABLED = true;

// Elements
const toggleSwitch = document.getElementById('toggleSwitch');
const blockedListEl = document.getElementById('blockedList');
const customSelect = document.getElementById('customSelect');
const customOptions = document.getElementById('customOptions');
const apiStatusEl = document.getElementById('apiStatus');

let blockedCountries = [];
let isDropdownLoaded = false; // Optimization: Load list only when needed

// Helper: Convert emoji to Twemoji URL
function getTwemojiUrl(emoji) {
  if (!emoji) return '';
  const hex = Array.from(emoji)
    .map(c => c.codePointAt(0).toString(16))
    .join('-');
  return `https://abs-0.twimg.com/emoji/v2/svg/${hex}.svg`;
}

// Check Rate Limit Status with Timeout Safety
function checkRateLimitStatus() {
  // Set a fallback timeout in case the message hangs
  const timeoutId = setTimeout(() => {
    updateStatusUI('unknown');
  }, 2000);

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0];
    
    // Only check if we are on Twitter/X
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

function updateStatusUI(status, resetTime) {
  apiStatusEl.className = 'api-status';
  apiStatusEl.style.display = 'flex'; // Ensure visible
  apiStatusEl.textContent = ''; // Clear existing content safely

  const icon = document.createElement('span');
  icon.className = 'api-status-icon';
  
  const textNode = document.createTextNode('');
  
  if (status === 'good') {
    apiStatusEl.classList.add('green');
    icon.textContent = '✅';
    textNode.textContent = ' API Status: Good';
  } else if (status === 'limited') {
    apiStatusEl.classList.add('red');
    const now = Math.floor(Date.now() / 1000);
    const minutesLeft = Math.max(0, Math.ceil((resetTime - now) / 60));
    icon.textContent = '⚠️';
    textNode.textContent = ` Rate Limited (${minutesLeft}m left)`;
  } else if (status === 'inactive') {
    apiStatusEl.style.color = '#536471';
    icon.textContent = 'ℹ️';
    textNode.textContent = ' Go to X.com to use';
  } else {
    icon.textContent = '⚪';
    textNode.textContent = ' Status: Unknown';
  }

  apiStatusEl.appendChild(icon);
  apiStatusEl.appendChild(textNode);
}

// Populate the dropdown (Lazy Load)
function populateDropdown() {
  if (isDropdownLoaded || typeof COUNTRY_FLAGS === 'undefined') return;
  
  // Search Input Container
  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.className = 'country-search';
  searchInput.placeholder = 'Search countries...';
  searchInput.autocomplete = 'off';
  
  // Prevent dropdown closing when clicking search
  searchInput.addEventListener('click', (e) => e.stopPropagation());
  
  // Filter Logic
  searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const options = customOptions.querySelectorAll('.custom-option');
    options.forEach(opt => {
      const country = opt.dataset.value.toLowerCase();
      opt.style.display = country.includes(term) ? 'flex' : 'none';
    });
  });

  customOptions.appendChild(searchInput);

  // Existing Country List Logic
  const fragment = document.createDocumentFragment();
  const countries = Object.keys(COUNTRY_FLAGS).sort();
  
  countries.forEach(country => {
    const emoji = COUNTRY_FLAGS[country];
    const option = document.createElement('div');
    option.className = 'custom-option';
    
    if (blockedCountries.includes(country)) {
      option.classList.add('selected');
    }
    option.dataset.value = country;
    
    const img = document.createElement('img');
    img.loading = 'lazy'; 
    img.src = getTwemojiUrl(emoji);
    img.alt = emoji;
    
    const text = document.createElement('span');
    text.textContent = country;
    
    option.appendChild(img);
    option.appendChild(text);
    
    option.addEventListener('click', () => {
      addCountry(country);
      customSelect.classList.remove('open');
      searchInput.value = ''; // Reset search
      // Reset visibility
      customOptions.querySelectorAll('.custom-option').forEach(el => el.style.display = 'flex');
    });
    
    fragment.appendChild(option);
  });
  
  customOptions.appendChild(fragment);
  isDropdownLoaded = true;
  
  // Focus search when opening
  setTimeout(() => searchInput.focus(), 50);
}

// Initialize - Lightweight
function init() {
  try {
    // 1. Load state (Fast)
    chrome.storage.local.get([TOGGLE_KEY, BLOCKED_COUNTRIES_KEY], (result) => {
      const isEnabled = result[TOGGLE_KEY] !== undefined ? result[TOGGLE_KEY] : DEFAULT_ENABLED;
      updateToggle(isEnabled);
      
      if (result[BLOCKED_COUNTRIES_KEY]) {
        if (Array.isArray(result[BLOCKED_COUNTRIES_KEY])) {
          blockedCountries = result[BLOCKED_COUNTRIES_KEY];
        } else if (typeof result[BLOCKED_COUNTRIES_KEY] === 'string') {
          blockedCountries = result[BLOCKED_COUNTRIES_KEY].split(',')
            .map(s => s.trim())
            .filter(s => s.length > 0);
        }
      }
      renderBlockedList();
    });
    
    // 2. Check status (Async, doesn't block UI)
    checkRateLimitStatus();

  } catch (e) {
    apiStatusEl.textContent = 'Error loading extension';
  }
}

// Event Listeners
toggleSwitch.addEventListener('click', () => {
  chrome.storage.local.get([TOGGLE_KEY], (result) => {
    const currentState = result[TOGGLE_KEY] !== undefined ? result[TOGGLE_KEY] : DEFAULT_ENABLED;
    const newState = !currentState;
    
    chrome.storage.local.set({ [TOGGLE_KEY]: newState }, () => {
      updateToggle(newState);
      notifyContentScript({ type: 'extensionToggle', enabled: newState });
    });
  });
});

// Dropdown interactions
customSelect.addEventListener('click', () => {
  // Lazy load list on first click only
  if (!isDropdownLoaded) {
    populateDropdown();
  }
  customSelect.classList.toggle('open');
});

// Close dropdown when clicking outside
window.addEventListener('click', (e) => {
  if (!customSelect.contains(e.target)) {
    customSelect.classList.remove('open');
  }
});

function addCountry(country) {
  if (country && !blockedCountries.includes(country)) {
    blockedCountries.push(country);
    saveBlockedCountries();
    renderBlockedList();
    
    // Hide from dropdown immediately
    if (isDropdownLoaded) {
      const option = customOptions.querySelector(`.custom-option[data-value="${country}"]`);
      if (option) option.classList.add('selected');
    }
  }
}

function removeCountry(country) {
  blockedCountries = blockedCountries.filter(c => c !== country);
  saveBlockedCountries();
  renderBlockedList();
  
  // Show in dropdown again
  if (isDropdownLoaded) {
    const option = customOptions.querySelector(`.custom-option[data-value="${country}"]`);
    if (option) option.classList.remove('selected');
  }
}

function saveBlockedCountries() {
  chrome.storage.local.set({ [BLOCKED_COUNTRIES_KEY]: blockedCountries }, () => {
    notifyContentScript({ type: 'blockedCountriesUpdate', countries: blockedCountries });
  });
}

function renderBlockedList() {
  blockedListEl.innerHTML = '';
  
  if (blockedCountries.length === 0) {
    blockedListEl.innerHTML = '<span class="empty-msg">No countries blocked</span>';
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
    
    const text = document.createTextNode(country);
    chip.appendChild(text);
    
    const removeBtn = document.createElement('span');
    removeBtn.className = 'chip-remove';
    removeBtn.innerHTML = '×';
    removeBtn.title = 'Remove';
    
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeCountry(country);
    });
    
    chip.appendChild(removeBtn);
    fragment.appendChild(chip);
  });
  
  blockedListEl.appendChild(fragment);
}

function updateToggle(isEnabled) {
  if (isEnabled) {
    toggleSwitch.classList.add('enabled');
  } else {
    toggleSwitch.classList.remove('enabled');
  }
}

function notifyContentScript(message) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, message).catch(() => {});
    }
  });
}

// Start
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// --- UNIFIED UPDATE & DEBUG MODULE ---
const DEBUG_STORAGE_KEY = 'debug_mode_enabled';
const REPO_URL = 'https://github.com/incconutwo/twitter-account-location-in-username';

// 1. Automatic Update Check (Skipped if installed from Store)
async function initUpdateCheck() {
  const manifest = chrome.runtime.getManifest();
  
  // If 'update_url' exists, we are in the Web Store -> Let the Store handle updates.
  if (manifest.update_url) return;

  // Otherwise, we are sideloaded/GitHub -> Check GitHub manually.
  try {
    const res = await fetch('https://raw.githubusercontent.com/incconutwo/twitter-account-location-in-username/main/manifest.json');
    if (res.ok) {
      const data = await res.json();
      if (isNewerVersion(data.version, manifest.version)) {
        showUpdateBanner(data.version);
      }
    }
  } catch (e) { /* Ignore network errors */ }
}

// 2. Secret Debug Trigger: Click Title 5 Times
const headerTitle = document.querySelector('h1');
if (headerTitle) {
  headerTitle.addEventListener('click', (e) => {
    // e.detail counts rapid clicks
    if (e.detail === 5) {
      chrome.storage.local.get(DEBUG_STORAGE_KEY, (result) => {
        const newState = !result[DEBUG_STORAGE_KEY];
        chrome.storage.local.set({ [DEBUG_STORAGE_KEY]: newState });
        newState ? renderDebugUI() : location.reload();
      });
    }
  });
}

// 3. Render Debug UI if enabled
chrome.storage.local.get(DEBUG_STORAGE_KEY, (res) => {
  if (res[DEBUG_STORAGE_KEY]) renderDebugUI();
});

// --- HELPER FUNCTIONS ---

function renderDebugUI() {
  if (document.getElementById('debug-panel')) return;
  
  const panel = document.createElement('div');
  panel.id = 'debug-panel';
  panel.style.cssText = 'margin-top:16px;padding:12px;background:#202124;color:#e8eaed;border-radius:8px;font-size:12px;border:1px solid #5f6368;';
  panel.innerHTML = `
    <div style="font-weight:bold;margin-bottom:8px;color:#8ab4f8;display:flex;justify-content:space-between;">
      <span>🛠️ Developer Mode</span>
    </div>
    <div style="display:grid;gap:8px;">
      <button id="dbg-test-update" style="cursor:pointer;padding:6px;background:#303134;border:1px solid #5f6368;color:white;border-radius:4px;">Test Update Popup</button>
      <button id="dbg-clear-cache" style="cursor:pointer;padding:6px;background:#303134;border:1px solid #5f6368;color:white;border-radius:4px;">Clear Location Cache</button>
      <div style="margin-top:4px;opacity:0.6;font-size:10px;text-align:center;">Tap title 5x to disable</div>
    </div>
  `;
  document.body.appendChild(panel);

  document.getElementById('dbg-test-update').onclick = () => showUpdateBanner('9.9.9-TEST');
  document.getElementById('dbg-clear-cache').onclick = () => {
    chrome.storage.local.remove('twitter_location_cache', () => {
      const btn = document.getElementById('dbg-clear-cache');
      btn.textContent = '✅ Cache Cleared';
      setTimeout(() => btn.textContent = 'Clear Location Cache', 2000);
    });
  };
}

function showUpdateBanner(version) {
  if (document.querySelector('.update-banner')) return;
  
  const style = document.createElement('style');
  style.textContent = `
    .update-banner { background: #e1f5fe; border: 1px solid #b3e5fc; color: #0277bd; padding: 10px; border-radius: 8px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; animation: slideIn 0.3s; }
    @keyframes slideIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
    .update-banner a { color: #0277bd; font-weight: 700; margin-left: 8px; text-decoration: none; }
    @media (prefers-color-scheme: dark) { .update-banner { background: rgba(2,119,189,0.15); border-color: rgba(2,119,189,0.3); color: #4fc3f7; } .update-banner a { color: #4fc3f7; } }
  `;
  document.head.appendChild(style);

  const banner = document.createElement('div');
  banner.className = 'update-banner';
  banner.innerHTML = `<span>🚀 Update ${version} available</span><a href="${REPO_URL}" target="_blank">Get it</a>`;
  
  const header = document.querySelector('.header');
  if (header) header.parentNode.insertBefore(banner, header.nextSibling);
}

function isNewerVersion(latest, current) {
  const l = latest.split('.').map(Number);
  const c = current.split('.').map(Number);
  for (let i = 0; i < Math.max(l.length, c.length); i++) {
    const lv = l[i] || 0, cv = c[i] || 0;
    if (lv > cv) return true;
    if (lv < cv) return false;
  }
  return false;
}

// Start
initUpdateCheck();