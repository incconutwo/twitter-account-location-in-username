// Dashboard Logic

// Constants
const STATS_KEY = 'extension_stats';
const REGIONAL_INDICATOR_OFFSET = 127397;

// DOM Elements
const els = {
  totalUsers: document.getElementById('totalUsers'),
  totalCountriesCount: document.getElementById('totalCountriesCount'),
  mapContainer: document.getElementById('mapContainer'),
  mapLoading: document.getElementById('mapLoading'),
  tooltip: document.getElementById('mapTooltip'),
  tooltipFlag: document.getElementById('tooltipFlag'),
  tooltipCountry: document.getElementById('tooltipCountry'),
  tooltipCount: document.getElementById('tooltipCount'),
  countryList: document.getElementById('countryList'),
  emptyState: document.getElementById('emptyState'),
  resetModal: document.getElementById('resetModal'),
  confirmResetBtn: document.getElementById('confirmReset'),
  cancelResetBtn: document.getElementById('cancelReset')
};

// --- Helpers ---

// Convert Flag Emoji to ISO 2-letter code (e.g. 🇺🇸 -> US)
function getIsoCodeFromEmoji(emoji) {
  if (!emoji) return null;
  // Group UK subdivision flags into the United Kingdom ISO code
  if (["🏴󠁧󠁢󠁥󠁮󠁧󠁿", "🏴󠁧󠁢󠁳󠁣󠁴󠁿", "🏴󠁧󠁢󠁷󠁬󠁳󠁿"].includes(emoji)) return "GB";
  const chars = Array.from(emoji);
  if (chars.length !== 2) return null;
  
  const c1 = chars[0].codePointAt(0) - REGIONAL_INDICATOR_OFFSET;
  const c2 = chars[1].codePointAt(0) - REGIONAL_INDICATOR_OFFSET;
  
  return String.fromCharCode(c1) + String.fromCharCode(c2);
}



function formatCount(num) {
  return new Intl.NumberFormat().format(num);
}

// --- Map Rendering ---

async function loadAndRenderMap(countryCounts) {
  try {
    // Load SVG map from local file
    const mapUrl = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL)
      ? chrome.runtime.getURL('world-map.svg')
      : 'world-map.svg';
    const res = await fetch(mapUrl);
    if (!res.ok) throw new Error('Failed to load map');
    
    const svgText = await res.text();
    els.mapContainer.innerHTML = svgText;
    
    // Process map interaction
    const svg = els.mapContainer.querySelector('svg');
    if (!svg) return;

    // Calculate max count for heat map
    const maxCount = Math.max(...Object.values(countryCounts), 1);
    
    // Apply colors to countries
    Object.keys(COUNTRY_FLAGS).forEach(countryName => {
      const count = countryCounts[countryName] || 0;
      if (count === 0) return;
      
      const emoji = COUNTRY_FLAGS[countryName];
      const iso = getIsoCodeFromEmoji(emoji);
      if (!iso) return;
      
      // Find element by ID (ISO code) - map uses lowercase
      // Could be a <path> directly or a <g> (group) containing multiple paths
      const element = svg.getElementById(iso.toLowerCase());
      if (element) {
        // Logarithmic scale for better visual distribution
        const intensity = Math.ceil((Math.log(count + 1) / Math.log(maxCount + 1)) * 8);
        element.classList.add(`heat-${Math.max(1, Math.min(8, intensity))}`);
        element.classList.add('highlighted');
        element.dataset.country = countryName;
        element.dataset.count = count;
        element.dataset.flag = emoji;
        
        // If it's a group, also add data attributes to child paths for tooltip hover
        if (element.tagName.toLowerCase() === 'g') {
          element.querySelectorAll('path').forEach(childPath => {
            childPath.dataset.country = countryName;
            childPath.dataset.count = count;
            childPath.dataset.flag = emoji;
          });
        }
      }
    });
    
    // Event Listeners for Tooltip
    svg.addEventListener('mousemove', (e) => {
      const path = e.target.closest('path');
      if (path && path.dataset.country) {
        showTooltip(e, path.dataset.country, path.dataset.flag, path.dataset.count);
      } else {
        // Also check if path is inside a group with data
        const group = e.target.closest('g[data-country]');
        if (group) {
          showTooltip(e, group.dataset.country, group.dataset.flag, group.dataset.count);
        } else {
          hideTooltip();
        }
      }
    });
    
    svg.addEventListener('mouseleave', hideTooltip);
    
  } catch (e) {
    els.mapContainer.innerHTML = `<div class="map-error">Failed to load map: ${e.message}</div>`;
  }
}

function showTooltip(e, country, flag, count) {
  els.tooltip.hidden = false;
  // Use Twemoji image instead of text flag mainly for Windows support
  els.tooltipFlag.innerHTML = `<img src="${getTwemojiUrl(flag)}" alt="${flag}" style="width:1.5em; height:auto; display:block;">`;
  els.tooltipCountry.textContent = country;
  els.tooltipCount.textContent = `${formatCount(parseInt(count))} users`;
  
  // Positioning
  const x = e.clientX;
  const y = e.clientY;
  
  // Prevent overflow
  const rect = els.tooltip.getBoundingClientRect();
  const winWidth = window.innerWidth;
  const winHeight = window.innerHeight;
  
  let left = x + 15;
  let top = y + 15;
  
  if (left + rect.width > winWidth) left = x - rect.width - 15;
  if (top + rect.height > winHeight) top = y - rect.height - 15;
  
  els.tooltip.style.left = `${left}px`;
  els.tooltip.style.top = `${top}px`;
}

function hideTooltip() {
  els.tooltip.hidden = true;
}

// --- List Rendering ---

function renderCountryList(sortedData) {
  els.countryList.innerHTML = '';
  
  if (sortedData.length === 0) {
    els.emptyState.hidden = false;
    return;
  }
  
  els.emptyState.hidden = true;
  const maxCount = sortedData[0].count; // Highest count for bar width
  
  const fragment = document.createDocumentFragment();
  
  sortedData.forEach((item, index) => {
    const div = document.createElement('div');
    div.className = 'country-item';
    
    // Rank logic
    let rankClass = 'country-rank';
    if (index < 3) rankClass += ' top-3';
    
    // Bar width percentage
    const barWidth = (item.count / maxCount) * 100;
    
    div.innerHTML = `
      <div class="${rankClass}">#${index + 1}</div>
      <div class="country-flag">
        <img src="${getTwemojiUrl(item.flag)}" alt="${item.flag}" loading="lazy">
      </div>
      <div class="country-info">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span class="country-name"></span>
          <span class="country-count">${formatCount(item.count)}</span>
        </div>
        <div class="country-bar">
          <div class="country-bar-fill" style="width: ${barWidth}%"></div>
        </div>
      </div>
    `;
    
    div.querySelector('.country-name').textContent = item.country;
    
    // Add hover highlighting link to map
    const iso = getIsoCodeFromEmoji(item.flag);
    if (iso) {
      const isoLower = iso.toLowerCase();
      div.dataset.iso = isoLower;
      
      div.addEventListener('mouseenter', () => {
        const svg = els.mapContainer.querySelector('svg');
        if (!svg) return;
        const element = svg.getElementById(isoLower);
        if (element) {
          element.classList.add('hovered');
        }
      });
      
      div.addEventListener('mouseleave', () => {
        const svg = els.mapContainer.querySelector('svg');
        if (!svg) return;
        const element = svg.getElementById(isoLower);
        if (element) {
          element.classList.remove('hovered');
        }
      });
    }

    fragment.appendChild(div);
  });
  
  els.countryList.appendChild(fragment);
}

// --- Main Init ---

function setupShareButton(totalScanned, countryArray, totalCountries) {
  const btn = document.getElementById('shareBtn');
  if (!btn) return;
  
  btn.addEventListener('click', () => {
    const rankEmojis = ['🥇', '🥈', '🥉'];
    const top3 = countryArray.slice(0, 3).map((c, i) => `${rankEmojis[i]} ${c.flag} ${c.country} (${formatCount(c.count)} users)`).join('\n');
    
    const text = `🛂 My X Feed Passport is getting stamped!\nI've discovered users from ${totalCountries}/195 countries on my timeline.\n\nMy top locations:\n${top3}\n\nTrack your feed geography: https://chromewebstore.google.com/detail/xtwitter-country-flags-bl/dgodabjkaifjlhpcapiohikkklnailla\n\n#DataViz #OpenSource`;
    
    const url = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(text);
    const width = 600;
    const height = 550;
    const left = (window.screen.width / 2) - (width / 2);
    const top = (window.screen.height / 2) - (height / 2);
    
    window.open(url, '_blank', `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`);
  });
}

function setupResetButton() {
  const btn = document.getElementById('resetBtn');
  if (!btn) return;
  
  btn.addEventListener('click', () => {
    els.resetModal.hidden = false;
  });

  els.cancelResetBtn.addEventListener('click', () => {
    els.resetModal.hidden = true;
  });

  els.confirmResetBtn.addEventListener('click', () => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ [STATS_KEY]: { seenCountries: {}, totalScanned: 0 } }, () => {
        window.location.reload();
      });
    } else {
      window.location.reload();
    }
  });

  // Close on backdrop click
  els.resetModal.querySelector('.modal-backdrop').addEventListener('click', () => {
    els.resetModal.hidden = true;
  });
}

function setupChangelogModal() {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('update') === 'true') {
    const changelogModal = document.getElementById('changelogModal');
    if (changelogModal) {
      changelogModal.hidden = false;
      
      const closeBtn = document.getElementById('closeChangelog');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          changelogModal.hidden = true;
        });
      }
    }
  }
}

async function init() {
  // Load data
  let stats = { seenCountries: {}, totalScanned: 0 };
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    const res = await chrome.storage.local.get(STATS_KEY);
    stats = res[STATS_KEY] || stats;
  } else {
    // Mock data for local development/testing
    stats = {
      seenCountries: {
        'United States': 142,
        'United Kingdom': 88,
        'Japan': 45,
        'Germany': 31,
        'Canada': 18,
        'France': 12,
        'Australia': 9,
        'Brazil': 7
      },
      totalScanned: 352
    };
  }
  
  const seenCountries = stats.seenCountries || {};
  const totalScanned = stats.totalScanned || 0;
  
  // Update Header Stats
  els.totalUsers.textContent = formatCount(totalScanned);
  if (els.totalCountriesCount) {
    els.totalCountriesCount.textContent = Object.keys(seenCountries).length;
  }
  
  // Transform data for map & list
  const countryArray = Object.entries(seenCountries).map(([country, count]) => ({
    country,
    count,
    flag: COUNTRY_FLAGS[country] || '🏳️'
  }));
  
  // Sort by count desc
  countryArray.sort((a, b) => b.count - a.count);
  
  // Render
  renderCountryList(countryArray);
  setupShareButton(totalScanned, countryArray, Object.keys(seenCountries).length);
  setupResetButton();
  setupChangelogModal();

  // Animate Global Exploration Progress
  const goalPercentage = document.getElementById('goalPercentage');
  const goalProgressFill = document.getElementById('goalProgressFill');
  
  if (goalPercentage && goalProgressFill) {
    const pct = Math.min(100, Math.round((countryArray.length / 195) * 100));
    goalPercentage.textContent = `${pct}%`;
    
    // Set a very slight delay so the transition triggers and animates from 0%
    setTimeout(() => {
      goalProgressFill.style.width = `${pct}%`;
    }, 100);
  }

  await loadAndRenderMap(seenCountries);
}

document.addEventListener('DOMContentLoaded', init);
