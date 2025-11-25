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
  
  if (status === 'good') {
    apiStatusEl.classList.add('green');
    apiStatusEl.innerHTML = '<span class="api-status-icon">✅</span> API Status: Good';
  } else if (status === 'limited') {
    apiStatusEl.classList.add('red');
    const now = Math.floor(Date.now() / 1000);
    const minutesLeft = Math.max(0, Math.ceil((resetTime - now) / 60));
    apiStatusEl.innerHTML = `<span class="api-status-icon">⚠️</span> Rate Limited (${minutesLeft}m left)`;
  } else if (status === 'inactive') {
    apiStatusEl.innerHTML = '<span class="api-status-icon">ℹ️</span> Go to X.com to use';
    apiStatusEl.style.color = '#536471';
  } else {
    apiStatusEl.innerHTML = '<span class="api-status-icon">⚪</span> Status: Unknown';
  }
}

// Populate the dropdown (Lazy Load)
function populateDropdown() {
  if (isDropdownLoaded || typeof COUNTRY_FLAGS === 'undefined') return;
  
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
    
    // Use native lazy loading for images
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
    });
    
    fragment.appendChild(option);
  });
  
  customOptions.appendChild(fragment);
  isDropdownLoaded = true;
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