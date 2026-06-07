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
    const parser = new DOMParser();
    const parsedDoc = parser.parseFromString(svgText, 'image/svg+xml');
    const svgElement = parsedDoc.documentElement;
    if (svgElement.querySelector('parsererror')) {
      throw new Error('SVG parsing failed');
    }
    els.mapContainer.replaceChildren(svgElement);
    
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
    const errorDiv = document.createElement('div');
    errorDiv.className = 'map-error';
    errorDiv.textContent = `Failed to load map: ${e.message}`;
    els.mapContainer.replaceChildren(errorDiv);
  }
}

function showTooltip(e, country, flag, count) {
  els.tooltip.hidden = false;
  // Use Twemoji image instead of text flag mainly for Windows support
  const tooltipImg = document.createElement('img');
  tooltipImg.src = getTwemojiUrl(flag);
  tooltipImg.alt = flag;
  tooltipImg.style.width = '1.5em';
  tooltipImg.style.height = 'auto';
  tooltipImg.style.display = 'block';
  els.tooltipFlag.replaceChildren(tooltipImg);
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
    
    const rankDiv = document.createElement('div');
    rankDiv.className = rankClass;
    rankDiv.textContent = `#${index + 1}`;
    div.appendChild(rankDiv);

    const flagDiv = document.createElement('div');
    flagDiv.className = 'country-flag';
    const flagImg = document.createElement('img');
    flagImg.src = getTwemojiUrl(item.flag);
    flagImg.alt = item.flag;
    flagImg.loading = 'lazy';
    flagDiv.appendChild(flagImg);
    div.appendChild(flagDiv);

    const infoDiv = document.createElement('div');
    infoDiv.className = 'country-info';

    const flexDiv = document.createElement('div');
    flexDiv.style.display = 'flex';
    flexDiv.style.justifyContent = 'space-between';
    flexDiv.style.alignItems = 'center';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'country-name';
    nameSpan.textContent = item.country;
    flexDiv.appendChild(nameSpan);

    const countSpan = document.createElement('span');
    countSpan.className = 'country-count';
    countSpan.textContent = formatCount(item.count);
    flexDiv.appendChild(countSpan);

    infoDiv.appendChild(flexDiv);

    const barDiv = document.createElement('div');
    barDiv.className = 'country-bar';
    const barFill = document.createElement('div');
    barFill.className = 'country-bar-fill';
    barFill.style.width = `${barWidth}%`;
    barDiv.appendChild(barFill);
    infoDiv.appendChild(barDiv);

    div.appendChild(infoDiv);
    
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
    const top3 = countryArray.slice(0, 3).map((c, i) => `${i+1}. ${c.flag} ${c.country}: ${formatCount(c.count)}`).join('\n');
    
    const text = `My X Feed Geography 🌍\nI've spotted users from ${totalCountries} countries on my feed so far!\n\nTop locations:\n${top3}\n\nTrack yours: https://chromewebstore.google.com/detail/xtwitter-country-flags-bl/dgodabjkaifjlhpcapiohikkklnailla\n\n#TwitterGeography #OpenSource`;
    
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
