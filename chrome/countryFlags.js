// Country name to flag emoji mapping
const COUNTRY_FLAGS = {
  "Afghanistan": "🇦🇫",
  "Albania": "🇦🇱",
  "Algeria": "🇩🇿",
  "American Samoa": "🇦🇸",
  "Andorra": "🇦🇩",
  "Angola": "🇦🇴",
  "Anguilla": "🇦🇮",
  "Antarctica": "🇦🇶",
  "Antigua and Barbuda": "🇦🇬",
  "Argentina": "🇦🇷",
  "Armenia": "🇦🇲",
  "Aruba": "🇦🇼",
  "Australia": "🇦🇺",
  "Austria": "🇦🇹",
  "Azerbaijan": "🇦🇿",
  "Bahamas": "🇧🇸",
  "Bahrain": "🇧🇭",
  "Bangladesh": "🇧🇩",
  "Barbados": "🇧🇧",
  "Belarus": "🇧🇾",
  "Belgium": "🇧🇪",
  "Belize": "🇧🇿",
  "Benin": "🇧🇯",
  "Bermuda": "🇧🇲",
  "Bhutan": "🇧🇹",
  "Bolivia": "🇧🇴",
  "Bosnia and Herzegovina": "🇧🇦",
  "Botswana": "🇧🇼",
  "Bouvet Island": "🇧🇻",
  "Brazil": "🇧🇷",
  "British Indian Ocean Territory": "🇮🇴",
  "Brunei Darussalam": "🇧🇳",
  "Bulgaria": "🇧🇬",
  "Burkina Faso": "🇧🇫",
  "Burundi": "🇧🇮",
  "Cambodia": "🇰🇭",
  "Cameroon": "🇨🇲",
  "Canada": "🇨🇦",
  "Cape Verde": "🇨🇻",
  "Cayman Islands": "🇰🇾",
  "Central African Republic": "🇨🇫",
  "Chad": "🇹🇩",
  "Chile": "🇨🇱",
  "China": "🇨🇳",
  "Christmas Island": "🇨🇽",
  "Cocos (Keeling) Islands": "🇨🇨",
  "Colombia": "🇨🇴",
  "Comoros": "🇰🇲",
  "Congo": "🇨🇬",
  "Congo, The Democratic Republic of the": "🇨🇩",
  "Cook Islands": "🇨🇰",
  "Costa Rica": "🇨🇷",
  "Cote D'Ivoire": "🇨🇮",
  "Croatia": "🇭🇷",
  "Cuba": "🇨🇺",
  "Cyprus": "🇨🇾",
  "Czech Republic": "🇨🇿",
  "Denmark": "🇩🇰",
  "Djibouti": "🇩🇯",
  "Dominica": "🇩🇲",
  "Dominican Republic": "🇩🇴",
  "Ecuador": "🇪🇨",
  "Egypt": "🇪🇬",
  "El Salvador": "🇸🇻",
  "Equatorial Guinea": "🇬🇶",
  "Eritrea": "🇪🇷",
  "Estonia": "🇪🇪",
  "Ethiopia": "🇪🇹",
  "Europe": "🇪🇺",
  "European Union": "🇪🇺",
  "Falkland Islands (Malvinas)": "🇫🇰",
  "Faroe Islands": "🇫🇴",
  "Fiji": "🇫🇯",
  "Finland": "🇫🇮",
  "France": "🇫🇷",
  "French Guiana": "🇬🇫",
  "French Polynesia": "🇵🇫",
  "French Southern Territories": "🇹🇫",
  "Gabon": "🇬🇦",
  "Gambia": "🇬🇲",
  "Georgia": "🇬🇪",
  "Germany": "🇩🇪",
  "Ghana": "🇬🇭",
  "Gibraltar": "🇬🇮",
  "Greece": "🇬🇷",
  "Greenland": "🇬🇱",
  "Grenada": "🇬🇩",
  "Guadeloupe": "🇬🇵",
  "Guam": "🇬🇺",
  "Guatemala": "🇬🇹",
  "Guinea": "🇬🇳",
  "Guinea-Bissau": "🇬🇼",
  "Guyana": "🇬🇾",
  "Haiti": "🇭🇹",
  "Heard Island and Mcdonald Islands": "🇭🇲",
  "Holy See (Vatican City State)": "🇻🇦",
  "Honduras": "🇭🇳",
  "Hong Kong": "🇭🇰",
  "Hungary": "🇭🇺",
  "Iceland": "🇮🇸",
  "India": "🇮🇳",
  "Indonesia": "🇮🇩",
  "Iran": "🇮🇷",
  "Iraq": "🇮🇶",
  "Ireland": "🇮🇪",
  "Israel": "🇮🇱",
  "Italy": "🇮🇹",
  "Jamaica": "🇯🇲",
  "Japan": "🇯🇵",
  "Jordan": "🇯🇴",
  "Kazakhstan": "🇰🇿",
  "Kenya": "🇰🇪",
  "Kiribati": "🇰🇮",
  "Korea": "🇰🇷",
  "North Korea": "🇰🇵",
  "South Korea": "🇰🇷",
  "Kuwait": "🇰🇼",
  "Kyrgyzstan": "🇰🇬",
  "Lao People's Democratic Republic": "🇱🇦",
  "Latvia": "🇱🇻",
  "Lebanon": "🇱🇧",
  "Lesotho": "🇱🇸",
  "Liberia": "🇱🇷",
  "Libyan Arab Jamahiriya": "🇱🇾",
  "Liechtenstein": "🇱🇮",
  "Lithuania": "🇱🇹",
  "Luxembourg": "🇱🇺",
  "Macao": "🇲🇴",
  "Macedonia": "🇲🇰",
  "Madagascar": "🇲🇬",
  "Malawi": "🇲🇼",
  "Malaysia": "🇲🇾",
  "Maldives": "🇲🇻",
  "Mali": "🇲🇱",
  "Malta": "🇲🇹",
  "Marshall Islands": "🇲🇭",
  "Martinique": "🇲🇶",
  "Mauritania": "🇲🇷",
  "Mauritius": "🇲🇺",
  "Mayotte": "🇾🇹",
  "Mexico": "🇲🇽",
  "Micronesia": "🇫🇲",
  "Moldova": "🇲🇩",
  "Monaco": "🇲🇨",
  "Mongolia": "🇲🇳",
  "Montserrat": "🇲🇸",
  "Morocco": "🇲🇦",
  "Mozambique": "🇲🇿",
  "Myanmar": "🇲🇲",
  "Namibia": "🇳🇦",
  "Nauru": "🇳🇷",
  "Nepal": "🇳🇵",
  "Netherlands": "🇳🇱",
  "Netherlands Antilles": "🇦🇳",
  "New Caledonia": "🇳🇨",
  "New Zealand": "🇳🇿",
  "Nicaragua": "🇳🇮",
  "Niger": "🇳🇪",
  "Nigeria": "🇳🇬",
  "Niue": "🇳🇺",
  "Norfolk Island": "🇳🇫",
  "Northern Mariana Islands": "🇲🇵",
  "Norway": "🇳🇴",
  "Oman": "🇴🇲",
  "Pakistan": "🇵🇰",
  "Palau": "🇵🇼",
  "Palestinian Territory": "🇵🇸",
  "Panama": "🇵🇦",
  "Papua New Guinea": "🇵🇬",
  "Paraguay": "🇵🇾",
  "Peru": "🇵🇪",
  "Philippines": "🇵🇭",
  "Pitcairn": "🇵🇳",
  "Poland": "🇵🇱",
  "Portugal": "🇵🇹",
  "Puerto Rico": "🇵🇷",
  "Qatar": "🇶🇦",
  "Reunion": "🇷🇪",
  "Romania": "🇷🇴",
  "Russia": "🇷🇺",
  "Russian Federation": "🇷🇺",
  "Rwanda": "🇷🇼",
  "Saint Helena": "🇸🇭",
  "Saint Kitts and Nevis": "🇰🇳",
  "Saint Lucia": "🇱🇨",
  "Saint Pierre and Miquelon": "🇵🇲",
  "Saint Vincent and the Grenadines": "🇻🇨",
  "Samoa": "🇼🇸",
  "San Marino": "🇸🇲",
  "Sao Tome and Principe": "🇸🇹",
  "Saudi Arabia": "🇸🇦",
  "Senegal": "🇸🇳",
  "Serbia and Montenegro": "🇷🇸",
  "Serbia": "🇷🇸",
  "Montenegro": "🇲🇪",
  "Kosovo": "🇽🇰",
  "Seychelles": "🇸🇨",
  "Sierra Leone": "🇸🇱",
  "Singapore": "🇸🇬",
  "Slovakia": "🇸🇰",
  "Slovenia": "🇸🇮",
  "Solomon Islands": "🇸🇧",
  "Somalia": "🇸🇴",
  "South Africa": "🇿🇦",
  "South Georgia and the South Sandwich Islands": "🇬🇸",
  "Spain": "🇪🇸",
  "Sri Lanka": "🇱🇰",
  "Sudan": "🇸🇩",
  "South Sudan": "🇸🇸",
  "Suriname": "🇸🇷",
  "Svalbard and Jan Mayen": "🇸🇯",
  "Swaziland": "🇸🇿",
  "Eswatini": "🇸🇿",
  "Sweden": "🇸🇪",
  "Switzerland": "🇨🇭",
  "Syrian Arab Republic": "🇸🇾",
  "Taiwan": "🇹🇼",
  "Tajikistan": "🇹🇯",
  "Tanzania": "🇹🇿",
  "Thailand": "🇹🇭",
  "Timor-Leste": "🇹🇱",
  "Togo": "🇹🇬",
  "Tokelau": "🇹🇰",
  "Tonga": "🇹🇴",
  "Trinidad and Tobago": "🇹🇹",
  "Tunisia": "🇹🇳",
  "Turkey": "🇹🇷",
  "Turkmenistan": "🇹🇲",
  "Turks and Caicos Islands": "🇹🇨",
  "Tuvalu": "🇹🇻",
  "Uganda": "🇺🇬",
  "Ukraine": "🇺🇦",
  "United Arab Emirates": "🇦🇪",
  "United Kingdom": "🇬🇧",
  "United States": "🇺🇸",
  "United States Minor Outlying Islands": "🇺🇲",
  "Uruguay": "🇺🇾",
  "Uzbekistan": "🇺🇿",
  "Vanuatu": "🇻🇺",
  "Venezuela": "🇻🇪",
  "Vietnam": "🇻🇳",
  "Viet Nam": "🇻🇳",
  "Virgin Islands, British": "🇻🇬",
  "Virgin Islands, U.S.": "🇻🇮",
  "Wallis and Futuna": "🇼🇫",
  "Western Sahara": "🇪🇭",
  "Yemen": "🇾🇪",
  "Zambia": "🇿🇲",
  "Zimbabwe": "🇿🇼",

  // Modern names / aliases (Twitter API uses these)
  "Czechia": "🇨🇿",
  "Ivory Coast": "🇨🇮",
  "Côte d'Ivoire": "🇨🇮",
  "DR Congo": "🇨🇩",
  "DRC": "🇨🇩",
  "North Macedonia": "🇲🇰",
  "Burma": "🇲🇲",
  "East Timor": "🇹🇱",
  "Cape Verde": "🇨🇻",
  "Cabo Verde": "🇨🇻",
  "Libya": "🇱🇾",
  "Syria": "🇸🇾",
  "Laos": "🇱🇦",
  "Brunei": "🇧🇳",
  "Vatican City": "🇻🇦",
  "Palestine": "🇵🇸",
  "Türkiye": "🇹🇷",

  // Native language names (common in Twitter bios / locations)
  "Polska": "🇵🇱",
  "Deutschland": "🇩🇪",
  "Italia": "🇮🇹",
  "España": "🇪🇸",
  "Brasil": "🇧🇷",
  "Россия": "🇷🇺",
  "Србија": "🇷🇸",
  "Україна": "🇺🇦",
  "Ελλάδα": "🇬🇷",
  "日本": "🇯🇵",
  "中国": "🇨🇳",
  "한국": "🇰🇷",
  "مصر": "🇪🇬",
  "المغرب": "🇲🇦",
  "السعودية": "🇸🇦",
  "العراق": "🇮🇶",
  "الجزائر": "🇩🇿",
  "تونس": "🇹🇳",
  "Türkiye": "🇹🇷",
  "Nederland": "🇳🇱",
  "Belgique": "🇧🇪",
  "Belgien": "🇧🇪",
  "Schweiz": "🇨🇭",
  "Suisse": "🇨🇭",
  "Österreich": "🇦🇹",
  "Sverige": "🇸🇪",
  "Norge": "🇳🇴",
  "Danmark": "🇩🇰",
  "Suomi": "🇫🇮",
  "Česko": "🇨🇿",
  "Slovensko": "🇸🇰",
  "Slovenija": "🇸🇮",
  "Hrvatska": "🇭🇷",
  "Magyarország": "🇭🇺",
  "România": "🇷🇴",
  "България": "🇧🇬",
  "Shqipëria": "🇦🇱",
  "Crna Gora": "🇲🇪",
  "Bosna i Hercegovina": "🇧🇦",
  "Lietuva": "🇱🇹",
  "Latvija": "🇱🇻",
  "Eesti": "🇪🇪",
  "საქართველო": "🇬🇪",
  "Հայաստան": "🇦🇲",
  "ไทย": "🇹🇭",
  "Việt Nam": "🇻🇳",
  "भारत": "🇮🇳",
  "ישראל": "🇮🇱",
  "پاکستان": "🇵🇰",
  "বাংলাদেশ": "🇧🇩",
  "ایران": "🇮🇷",

  // Common shorthands
  "UK": "🇬🇧",
  "Great Britain": "🇬🇧",
  "GB": "🇬🇧",
  "England": "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  "Scotland": "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  "Wales": "🏴󠁧󠁢󠁷󠁬󠁳󠁿",
  "Northern Ireland": "🇬🇧",
  "US": "🇺🇸",
  "USA": "🇺🇸",
  "America": "🇺🇸",
  "UAE": "🇦🇪",
  "KSA": "🇸🇦",
  "RSA": "🇿🇦",
  "NZ": "🇳🇿",
  "EU": "🇪🇺",

  // Regions & Continents
  "North America": "🌎",
  "South America": "🌎",
  "Central America": "🌎",
  "Latin America": "🌎",
  "Latin America and the Caribbean": "🌎",
  "Latin America & Caribbean": "🌎",
  "Caribbean": "🌎",
  "Europe & Central Asia": "🌍",
  "Middle East": "🌍",
  "Middle East & North Africa": "🌍",
  "Africa": "🌍",
  "Sub-Saharan Africa": "🌍",
  "Asia": "🌏",
  "East Asia": "🌏",
  "East Asia & Pacific": "🌏",
  "South Asia": "🌏",
  "Southeast Asia": "🌏",
  "West Asia": "🌏",
  "Asia-Pacific": "🌏",
  "Oceania": "🌏",
  "Antarctica": "🇦🇶",
  "World": "🌐",
  "Global": "🌐",
  "International": "🌐"
};

// --- Performance Optimizations: Pre-computed at load time ---

// O(1) lowercase lookup map for flags
const COUNTRY_FLAGS_LOWER = new Map(
  Object.entries(COUNTRY_FLAGS).map(([k, v]) => [k.toLowerCase(), v])
);

// O(1) lowercase lookup map for canonical country names
const COUNTRY_NAMES_LOWER = new Map(
  Object.keys(COUNTRY_FLAGS).map(k => [k.toLowerCase(), k])
);

// Pre-sorted by length (longest first) for substring matching
const SORTED_COUNTRIES = Object.keys(COUNTRY_FLAGS)
  .sort((a, b) => b.length - a.length)
  .map(c => ({ name: c, lower: c.toLowerCase(), flag: COUNTRY_FLAGS[c] }));

const TWEMOJI_URLS = new Map();
function getTwemojiUrl(emoji) {
  if (!emoji) return '';
  let url = TWEMOJI_URLS.get(emoji);
  if (!url) {
    const hex = Array.from(emoji).map(c => c.codePointAt(0).toString(16)).join('-');
    url = `https://abs-0.twimg.com/emoji/v2/svg/${hex}.svg`;
    TWEMOJI_URLS.set(emoji, url);
  }
  return url;
}

// Performance: Cache resolved location strings to avoid O(N) re-scan
const _flagCache = new Map();
const _nameCache = new Map();
const _CACHE_MAX = 500;

function matchTokenGrams(tokens, map) {
  for (let i = 0; i < tokens.length; i++) {
    for (let len = 1; len <= 3; len++) {
      if (i + len <= tokens.length) {
        const gram = tokens.slice(i, i + len).join(' ');
        if (map.has(gram)) return map.get(gram);
      }
    }
  }
  return null;
}

function checkIfUSState(str) {
  // Pattern 1: Ending with a comma followed by any US state code (e.g., "Houston, TX" or "Little Rock, AR")
  const stateAbbrevRegex = /,\s*\b(al|ak|az|ar|ca|co|ct|de|fl|ga|hi|id|il|in|ia|ks|ky|la|me|md|ma|mi|mn|ms|mo|mt|ne|nv|nh|nj|nm|ny|nc|nd|oh|ok|or|pa|ri|sc|sd|tn|tx|ut|vt|va|wa|wv|wi|wy)\b\s*$/i;
  if (stateAbbrevRegex.test(str)) return true;
  
  // Pattern 2: Exactly matches a non-ambiguous US state code (e.g., "tx", "fl", "ca")
  const exactStateCodes = new Set(['al', 'ak', 'az', 'ar', 'ca', 'co', 'ct', 'de', 'fl', 'ga', 'id', 'il', 'ia', 'ks', 'ky', 'md', 'ma', 'mi', 'mn', 'ms', 'mo', 'mt', 'ne', 'nv', 'nh', 'nj', 'nm', 'ny', 'nc', 'nd', 'oh', 'ok', 'pa', 'ri', 'sc', 'sd', 'tn', 'tx', 'ut', 'vt', 'va', 'wv', 'wi', 'wy']);
  if (exactStateCodes.has(str)) return true;

  // Pattern 3: Contains a full US state name with word boundaries
  const fullStates = ["california", "texas", "florida", "illinois", "pennsylvania", "ohio", "georgia", "michigan", "north carolina", "virginia", "washington", "massachusetts", "arizona", "tennessee", "indiana", "missouri", "maryland", "wisconsin", "colorado", "minnesota", "oregon", "nevada", "connecticut", "utah", "iowa", "kentucky", "louisiana", "alabama", "oklahoma", "mississippi", "arkansas", "nebraska", "kansas", "new mexico", "hawaii", "alaska", "montana", "idaho", "maine", "new hampshire", "vermont", "rhode island", "delaware", "south dakota", "north dakota", "wyoming", "west virginia"];
  
  for (const state of fullStates) {
    const idx = str.indexOf(state);
    if (idx !== -1) {
      const before = str[idx - 1];
      const after = str[idx + state.length];
      if ((!before || before === ' ' || before === ',') && 
          (!after || after === ' ' || after === ',')) {
        return true;
      }
    }
  }
  return false;
}

function getCountryFlag(countryName) {
  if (!countryName) return null;
  
  const normalized = countryName.trim();
  const normalizedLower = normalized.toLowerCase();
  
  // Check cache first
  if (_flagCache.has(normalizedLower)) return _flagCache.get(normalizedLower);
  
  let result = null;

  // 1. O(1) exact match (most common case)
  if (COUNTRY_FLAGS_LOWER.has(normalizedLower)) {
    result = COUNTRY_FLAGS_LOWER.get(normalizedLower);
  } else if (checkIfUSState(normalizedLower)) {
    result = "🇺🇸";
  } else {
    // 2. Tokenized match (1-gram, 2-gram, 3-gram)
    const tokens = normalizedLower.split(/[\s,.()\-\/]+/).filter(Boolean);
    result = matchTokenGrams(tokens, COUNTRY_FLAGS_LOWER);

    // 3. Fallback to O(N) substring match using pre-sorted list (e.g. "Paris, France" -> France)
    if (!result) {
      for (const { name, lower, flag } of SORTED_COUNTRIES) {
        const idx = normalizedLower.indexOf(lower);
        if (idx !== -1) {
          // Word boundary check without regex (faster)
          const before = normalizedLower[idx - 1];
          const after = normalizedLower[idx + lower.length];
          if ((!before || before === ' ' || before === ',') && 
              (!after || after === ' ' || after === ',')) {
            result = flag;
            break;
          }
        }
      }
    }
  }
  
  // Cache the result (including null to avoid re-scanning misses)
  if (_flagCache.size >= _CACHE_MAX) _flagCache.delete(_flagCache.keys().next().value);
  _flagCache.set(normalizedLower, result);
  return result;
}

// Resolves a location string to a canonical country name (avoids duplicate lookup)
function resolveCountryName(location) {
  if (!location) return null;
  
  const normalizedLower = location.trim().toLowerCase();
  
  // Check cache first
  if (_nameCache.has(normalizedLower)) return _nameCache.get(normalizedLower);
  
  let result = null;

  // 1. O(1) exact match
  if (COUNTRY_NAMES_LOWER.has(normalizedLower)) {
    result = COUNTRY_NAMES_LOWER.get(normalizedLower);
  } else if (checkIfUSState(normalizedLower)) {
    result = "United States";
  } else {
    // 2. Tokenized match
    const tokens = normalizedLower.split(/[\s,.()\-\/]+/).filter(Boolean);
    result = matchTokenGrams(tokens, COUNTRY_NAMES_LOWER);

    // 3. Fallback to O(N) substring match
    if (!result) {
      for (const { name, lower } of SORTED_COUNTRIES) {
        const idx = normalizedLower.indexOf(lower);
        if (idx !== -1) {
          const before = normalizedLower[idx - 1];
          const after = normalizedLower[idx + lower.length];
          if ((!before || before === ' ' || before === ',') && 
              (!after || after === ' ' || after === ',')) {
            result = name;
            break;
          }
        }
      }
    }
  }
  
  if (_nameCache.size >= _CACHE_MAX) _nameCache.delete(_nameCache.keys().next().value);
  _nameCache.set(normalizedLower, result);
  return result;
}

// --- Timezone Resolution System ---

// Default timezone per country (capital / most populous city)
const COUNTRY_TIMEZONES = {
  "Afghanistan": "Asia/Kabul", "Albania": "Europe/Tirane", "Algeria": "Africa/Algiers",
  "Andorra": "Europe/Andorra", "Angola": "Africa/Luanda", "Argentina": "America/Argentina/Buenos_Aires",
  "Armenia": "Asia/Yerevan", "Australia": "Australia/Sydney", "Austria": "Europe/Vienna",
  "Azerbaijan": "Asia/Baku", "Bahamas": "America/Nassau", "Bahrain": "Asia/Bahrain",
  "Bangladesh": "Asia/Dhaka", "Barbados": "America/Barbados", "Belarus": "Europe/Minsk",
  "Belgium": "Europe/Brussels", "Belize": "America/Belize", "Benin": "Africa/Porto-Novo",
  "Bhutan": "Asia/Thimphu", "Bolivia": "America/La_Paz", "Bosnia and Herzegovina": "Europe/Sarajevo",
  "Botswana": "Africa/Gaborone", "Brazil": "America/Sao_Paulo", "Brunei Darussalam": "Asia/Brunei",
  "Bulgaria": "Europe/Sofia", "Burkina Faso": "Africa/Ouagadougou", "Burundi": "Africa/Bujumbura",
  "Cambodia": "Asia/Phnom_Penh", "Cameroon": "Africa/Douala", "Canada": "America/Toronto",
  "Cape Verde": "Atlantic/Cape_Verde", "Central African Republic": "Africa/Bangui",
  "Chad": "Africa/Ndjamena", "Chile": "America/Santiago", "China": "Asia/Shanghai",
  "Colombia": "America/Bogota", "Comoros": "Indian/Comoro", "Congo": "Africa/Brazzaville",
  "Congo, The Democratic Republic of the": "Africa/Kinshasa", "Costa Rica": "America/Costa_Rica",
  "Cote D'Ivoire": "Africa/Abidjan", "Croatia": "Europe/Zagreb", "Cuba": "America/Havana",
  "Cyprus": "Asia/Nicosia", "Czech Republic": "Europe/Prague", "Denmark": "Europe/Copenhagen",
  "Djibouti": "Africa/Djibouti", "Dominican Republic": "America/Santo_Domingo",
  "Ecuador": "America/Guayaquil", "Egypt": "Africa/Cairo", "El Salvador": "America/El_Salvador",
  "Equatorial Guinea": "Africa/Malabo", "Eritrea": "Africa/Asmara", "Estonia": "Europe/Tallinn",
  "Ethiopia": "Africa/Addis_Ababa", "Fiji": "Pacific/Fiji", "Finland": "Europe/Helsinki",
  "France": "Europe/Paris", "Gabon": "Africa/Libreville", "Gambia": "Africa/Banjul",
  "Georgia": "Asia/Tbilisi", "Germany": "Europe/Berlin", "Ghana": "Africa/Accra",
  "Greece": "Europe/Athens", "Greenland": "America/Nuuk", "Guatemala": "America/Guatemala",
  "Guinea": "Africa/Conakry", "Guinea-Bissau": "Africa/Bissau", "Guyana": "America/Guyana",
  "Haiti": "America/Port-au-Prince", "Honduras": "America/Tegucigalpa", "Hong Kong": "Asia/Hong_Kong",
  "Hungary": "Europe/Budapest", "Iceland": "Atlantic/Reykjavik", "India": "Asia/Kolkata",
  "Indonesia": "Asia/Jakarta", "Iran": "Asia/Tehran", "Iraq": "Asia/Baghdad",
  "Ireland": "Europe/Dublin", "Israel": "Asia/Jerusalem", "Italy": "Europe/Rome",
  "Jamaica": "America/Jamaica", "Japan": "Asia/Tokyo", "Jordan": "Asia/Amman",
  "Kazakhstan": "Asia/Almaty", "Kenya": "Africa/Nairobi", "Korea": "Asia/Seoul",
  "South Korea": "Asia/Seoul", "North Korea": "Asia/Pyongyang", "Kuwait": "Asia/Kuwait",
  "Kyrgyzstan": "Asia/Bishkek", "Lao People's Democratic Republic": "Asia/Vientiane",
  "Latvia": "Europe/Riga", "Lebanon": "Asia/Beirut", "Lesotho": "Africa/Maseru",
  "Liberia": "Africa/Monrovia", "Libyan Arab Jamahiriya": "Africa/Tripoli",
  "Liechtenstein": "Europe/Vaduz", "Lithuania": "Europe/Vilnius", "Luxembourg": "Europe/Luxembourg",
  "Macao": "Asia/Macau", "Macedonia": "Europe/Skopje", "Madagascar": "Indian/Antananarivo",
  "Malawi": "Africa/Blantyre", "Malaysia": "Asia/Kuala_Lumpur", "Maldives": "Indian/Maldives",
  "Mali": "Africa/Bamako", "Malta": "Europe/Malta", "Mauritania": "Africa/Nouakchott",
  "Mauritius": "Indian/Mauritius", "Mexico": "America/Mexico_City", "Moldova": "Europe/Chisinau",
  "Monaco": "Europe/Monaco", "Mongolia": "Asia/Ulaanbaatar", "Montenegro": "Europe/Podgorica",
  "Morocco": "Africa/Casablanca", "Mozambique": "Africa/Maputo", "Myanmar": "Asia/Yangon",
  "Namibia": "Africa/Windhoek", "Nepal": "Asia/Kathmandu", "Netherlands": "Europe/Amsterdam",
  "New Zealand": "Pacific/Auckland", "Nicaragua": "America/Managua", "Niger": "Africa/Niamey",
  "Nigeria": "Africa/Lagos", "Norway": "Europe/Oslo", "Oman": "Asia/Muscat",
  "Pakistan": "Asia/Karachi", "Palestinian Territory": "Asia/Gaza", "Panama": "America/Panama",
  "Papua New Guinea": "Pacific/Port_Moresby", "Paraguay": "America/Asuncion",
  "Peru": "America/Lima", "Philippines": "Asia/Manila", "Poland": "Europe/Warsaw",
  "Portugal": "Europe/Lisbon", "Puerto Rico": "America/Puerto_Rico", "Qatar": "Asia/Qatar",
  "Romania": "Europe/Bucharest", "Russia": "Europe/Moscow", "Russian Federation": "Europe/Moscow",
  "Rwanda": "Africa/Kigali", "Saudi Arabia": "Asia/Riyadh", "Senegal": "Africa/Dakar",
  "Serbia and Montenegro": "Europe/Belgrade", "Serbia": "Europe/Belgrade", "Montenegro": "Europe/Podgorica",
  "Kosovo": "Europe/Belgrade", "Sierra Leone": "Africa/Freetown",
  "Singapore": "Asia/Singapore", "Slovakia": "Europe/Bratislava", "Slovenia": "Europe/Ljubljana",
  "Somalia": "Africa/Mogadishu", "South Africa": "Africa/Johannesburg", "Spain": "Europe/Madrid",
  "Sri Lanka": "Asia/Colombo", "Sudan": "Africa/Khartoum", "Suriname": "America/Paramaribo",
  "Sweden": "Europe/Stockholm", "Switzerland": "Europe/Zurich",
  "Syrian Arab Republic": "Asia/Damascus", "Taiwan": "Asia/Taipei", "Tajikistan": "Asia/Dushanbe",
  "Tanzania": "Africa/Dar_es_Salaam", "Thailand": "Asia/Bangkok", "Togo": "Africa/Lome",
  "Tonga": "Pacific/Tongatapu", "Trinidad and Tobago": "America/Port_of_Spain",
  "Tunisia": "Africa/Tunis", "Turkey": "Europe/Istanbul", "Turkmenistan": "Asia/Ashgabat",
  "Uganda": "Africa/Kampala", "Ukraine": "Europe/Kiev", "United Arab Emirates": "Asia/Dubai",
  "United Kingdom": "Europe/London", "United States": "America/New_York",
  "Uruguay": "America/Montevideo",  "Uzbekistan": "Asia/Tashkent", "Vanuatu": "Pacific/Efate", "Venezuela": "America/Caracas",
  "Vietnam": "Asia/Ho_Chi_Minh", "Viet Nam": "Asia/Ho_Chi_Minh",
  "Yemen": "Asia/Aden", "Zambia": "Africa/Lusaka",
  "Zimbabwe": "Africa/Harare",
  // Modern aliases
  "Czechia": "Europe/Prague", "Libya": "Africa/Tripoli", "Syria": "Asia/Damascus",
  "Laos": "Asia/Vientiane", "Brunei": "Asia/Brunei", "Palestine": "Asia/Gaza",
  "Türkiye": "Europe/Istanbul", "Eswatini": "Africa/Mbabane", "South Sudan": "Africa/Juba",
  "North Macedonia": "Europe/Skopje", "Burma": "Asia/Yangon", "East Timor": "Asia/Dili",
  "Cabo Verde": "Atlantic/Cape_Verde", "Ivory Coast": "Africa/Abidjan",
  "Vatican City": "Europe/Rome",
  // Native-language names
  "Polska": "Europe/Warsaw", "Deutschland": "Europe/Berlin", "Italia": "Europe/Rome",
  "España": "Europe/Madrid", "Brasil": "America/Sao_Paulo", "Nederland": "Europe/Amsterdam",
  "Belgique": "Europe/Brussels", "Belgien": "Europe/Brussels", "Schweiz": "Europe/Zurich",
  "Suisse": "Europe/Zurich", "Österreich": "Europe/Vienna", "Sverige": "Europe/Stockholm",
  "Norge": "Europe/Oslo", "Danmark": "Europe/Copenhagen", "Suomi": "Europe/Helsinki",
  "Česko": "Europe/Prague", "Slovensko": "Europe/Bratislava", "Slovenija": "Europe/Ljubljana",
  "Hrvatska": "Europe/Zagreb", "Magyarország": "Europe/Budapest", "România": "Europe/Bucharest",
  "Србија": "Europe/Belgrade", "Crna Gora": "Europe/Podgorica",
  "Bosna i Hercegovina": "Europe/Sarajevo", "Lietuva": "Europe/Vilnius",
  "Latvija": "Europe/Riga", "Eesti": "Europe/Tallinn",
  // Shorthands
  "UK": "Europe/London", "GB": "Europe/London", "Great Britain": "Europe/London",
  "England": "Europe/London", "Scotland": "Europe/London", "Wales": "Europe/London",
  "Northern Ireland": "Europe/London",
  "US": "America/New_York", "USA": "America/New_York", "America": "America/New_York",
  "UAE": "Asia/Dubai", "KSA": "Asia/Riyadh", "RSA": "Africa/Johannesburg",
  "NZ": "Pacific/Auckland"
};

// City → IANA timezone (top 100+ cities for precision in multi-tz countries)
const CITY_TIMEZONES = {
  // USA
  "new york": "America/New_York", "nyc": "America/New_York", "manhattan": "America/New_York",
  "brooklyn": "America/New_York", "queens": "America/New_York", "bronx": "America/New_York",
  "boston": "America/New_York", "philadelphia": "America/New_York", "miami": "America/New_York",
  "atlanta": "America/New_York", "washington": "America/New_York", "dc": "America/New_York",
  "charlotte": "America/New_York", "orlando": "America/New_York", "tampa": "America/New_York",
  "detroit": "America/New_York", "pittsburgh": "America/New_York", "cleveland": "America/New_York",
  "chicago": "America/Chicago", "houston": "America/Chicago", "dallas": "America/Chicago",
  "austin": "America/Chicago", "san antonio": "America/Chicago", "minneapolis": "America/Chicago",
  "nashville": "America/Chicago", "memphis": "America/Chicago", "milwaukee": "America/Chicago",
  "new orleans": "America/Chicago", "st louis": "America/Chicago", "kansas city": "America/Chicago",
  "oklahoma city": "America/Chicago", "omaha": "America/Chicago", "fort worth": "America/Chicago",
  "denver": "America/Denver", "phoenix": "America/Phoenix", "salt lake city": "America/Denver",
  "albuquerque": "America/Denver", "el paso": "America/Denver", "tucson": "America/Phoenix",
  "boise": "America/Boise", "colorado springs": "America/Denver",
  "los angeles": "America/Los_Angeles", "san francisco": "America/Los_Angeles",
  "seattle": "America/Los_Angeles", "portland": "America/Los_Angeles",
  "san diego": "America/Los_Angeles", "las vegas": "America/Los_Angeles",
  "sacramento": "America/Los_Angeles", "san jose": "America/Los_Angeles",
  "oakland": "America/Los_Angeles", "la": "America/Los_Angeles", "sf": "America/Los_Angeles",
  "silicon valley": "America/Los_Angeles", "bay area": "America/Los_Angeles",
  "honolulu": "Pacific/Honolulu", "hawaii": "Pacific/Honolulu",
  "anchorage": "America/Anchorage", "alaska": "America/Anchorage",
  // Canada
  "toronto": "America/Toronto", "montreal": "America/Toronto", "ottawa": "America/Toronto",
  "vancouver": "America/Vancouver", "calgary": "America/Edmonton", "edmonton": "America/Edmonton",
  "winnipeg": "America/Winnipeg", "halifax": "America/Halifax",
  // Brazil
  "são paulo": "America/Sao_Paulo", "sao paulo": "America/Sao_Paulo",
  "rio de janeiro": "America/Sao_Paulo", "rio": "America/Sao_Paulo",
  "brasilia": "America/Sao_Paulo", "manaus": "America/Manaus",
  // Russia
  "moscow": "Europe/Moscow", "saint petersburg": "Europe/Moscow", "st petersburg": "Europe/Moscow",
  "novosibirsk": "Asia/Novosibirsk", "vladivostok": "Asia/Vladivostok",
  "yekaterinburg": "Asia/Yekaterinburg", "kazan": "Europe/Moscow",
  // Australia
  "sydney": "Australia/Sydney", "melbourne": "Australia/Melbourne",
  "brisbane": "Australia/Brisbane", "perth": "Australia/Perth",
  "adelaide": "Australia/Adelaide", "darwin": "Australia/Darwin",
  "canberra": "Australia/Sydney", "hobart": "Australia/Hobart",
  // India
  "mumbai": "Asia/Kolkata", "delhi": "Asia/Kolkata", "new delhi": "Asia/Kolkata",
  "bangalore": "Asia/Kolkata", "bengaluru": "Asia/Kolkata", "hyderabad": "Asia/Kolkata",
  "chennai": "Asia/Kolkata", "kolkata": "Asia/Kolkata", "pune": "Asia/Kolkata",
  // China
  "beijing": "Asia/Shanghai", "shanghai": "Asia/Shanghai", "guangzhou": "Asia/Shanghai",
  "shenzhen": "Asia/Shanghai", "chengdu": "Asia/Shanghai", "hong kong": "Asia/Hong_Kong",
  // Europe (major cities)
  "london": "Europe/London", "paris": "Europe/Paris", "berlin": "Europe/Berlin",
  "madrid": "Europe/Madrid", "barcelona": "Europe/Madrid", "rome": "Europe/Rome",
  "milan": "Europe/Rome", "amsterdam": "Europe/Amsterdam", "brussels": "Europe/Brussels",
  "vienna": "Europe/Vienna", "zurich": "Europe/Zurich", "geneva": "Europe/Zurich",
  "lisbon": "Europe/Lisbon", "dublin": "Europe/Dublin", "edinburgh": "Europe/London",
  "manchester": "Europe/London", "birmingham": "Europe/London", "stockholm": "Europe/Stockholm",
  "oslo": "Europe/Oslo", "copenhagen": "Europe/Copenhagen", "helsinki": "Europe/Helsinki",
  "prague": "Europe/Prague", "warsaw": "Europe/Warsaw", "budapest": "Europe/Budapest",
  "bucharest": "Europe/Bucharest", "athens": "Europe/Athens", "istanbul": "Europe/Istanbul",
  "munich": "Europe/Berlin", "hamburg": "Europe/Berlin", "frankfurt": "Europe/Berlin",
  "lyon": "Europe/Paris", "marseille": "Europe/Paris",
  // Middle East
  "dubai": "Asia/Dubai", "abu dhabi": "Asia/Dubai", "riyadh": "Asia/Riyadh",
  "jeddah": "Asia/Riyadh", "doha": "Asia/Qatar", "cairo": "Africa/Cairo",
  "tel aviv": "Asia/Jerusalem", "jerusalem": "Asia/Jerusalem", "beirut": "Asia/Beirut",
  "amman": "Asia/Amman", "baghdad": "Asia/Baghdad", "tehran": "Asia/Tehran",
  // Asia
  "tokyo": "Asia/Tokyo", "osaka": "Asia/Tokyo", "seoul": "Asia/Seoul",
  "bangkok": "Asia/Bangkok", "singapore": "Asia/Singapore", "kuala lumpur": "Asia/Kuala_Lumpur",
  "jakarta": "Asia/Jakarta", "manila": "Asia/Manila", "taipei": "Asia/Taipei",
  "hanoi": "Asia/Ho_Chi_Minh", "ho chi minh": "Asia/Ho_Chi_Minh", "saigon": "Asia/Ho_Chi_Minh",
  "karachi": "Asia/Karachi", "lahore": "Asia/Karachi", "islamabad": "Asia/Karachi",
  "dhaka": "Asia/Dhaka", "kathmandu": "Asia/Kathmandu",
  // Africa
  "lagos": "Africa/Lagos", "nairobi": "Africa/Nairobi", "johannesburg": "Africa/Johannesburg",
  "cape town": "Africa/Johannesburg", "accra": "Africa/Accra", "addis ababa": "Africa/Addis_Ababa",
  "casablanca": "Africa/Casablanca", "algiers": "Africa/Algiers", "tunis": "Africa/Tunis",
  "dakar": "Africa/Dakar", "dar es salaam": "Africa/Dar_es_Salaam",
  // Latin America
  "mexico city": "America/Mexico_City", "cdmx": "America/Mexico_City",
  "bogota": "America/Bogota", "lima": "America/Lima", "santiago": "America/Santiago",
  "buenos aires": "America/Argentina/Buenos_Aires", "montevideo": "America/Montevideo",
  "caracas": "America/Caracas", "havana": "America/Havana",
  "panama city": "America/Panama", "san jose": "America/Costa_Rica"
};

// US State abbreviations → timezone
const US_STATE_TIMEZONES = {
  "al": "America/Chicago", "ak": "America/Anchorage", "az": "America/Phoenix",
  "ar": "America/Chicago", "ca": "America/Los_Angeles", "co": "America/Denver",
  "ct": "America/New_York", "de": "America/New_York", "fl": "America/New_York",
  "ga": "America/New_York", "hi": "Pacific/Honolulu", "id": "America/Boise",
  "il": "America/Chicago", "in": "America/Indiana/Indianapolis", "ia": "America/Chicago",
  "ks": "America/Chicago", "ky": "America/New_York", "la": "America/Chicago",
  "me": "America/New_York", "md": "America/New_York", "ma": "America/New_York",
  "mi": "America/New_York", "mn": "America/Chicago", "ms": "America/Chicago",
  "mo": "America/Chicago", "mt": "America/Denver", "ne": "America/Chicago",
  "nv": "America/Los_Angeles", "nh": "America/New_York", "nj": "America/New_York",
  "nm": "America/Denver", "ny": "America/New_York", "nc": "America/New_York",
  "nd": "America/Chicago", "oh": "America/New_York", "ok": "America/Chicago",
  "or": "America/Los_Angeles", "pa": "America/New_York", "ri": "America/New_York",
  "sc": "America/New_York", "sd": "America/Chicago", "tn": "America/Chicago",
  "tx": "America/Chicago", "ut": "America/Denver", "vt": "America/New_York",
  "va": "America/New_York", "wa": "America/Los_Angeles", "wv": "America/New_York",
  "wi": "America/Chicago", "wy": "America/Denver", "dc": "America/New_York",
  // Full state names
  "california": "America/Los_Angeles", "texas": "America/Chicago", "florida": "America/New_York",
  "new york": "America/New_York", "illinois": "America/Chicago", "pennsylvania": "America/New_York",
  "ohio": "America/New_York", "georgia": "America/New_York", "michigan": "America/New_York",
  "north carolina": "America/New_York", "virginia": "America/New_York",
  "washington": "America/Los_Angeles", "massachusetts": "America/New_York",
  "arizona": "America/Phoenix", "tennessee": "America/Chicago", "indiana": "America/Indiana/Indianapolis",
  "missouri": "America/Chicago", "maryland": "America/New_York", "wisconsin": "America/Chicago",
  "colorado": "America/Denver", "minnesota": "America/Chicago", "oregon": "America/Los_Angeles",
  "nevada": "America/Los_Angeles", "connecticut": "America/New_York", "utah": "America/Denver",
  "iowa": "America/Chicago", "kentucky": "America/New_York", "louisiana": "America/Chicago",
  "alabama": "America/Chicago", "oklahoma": "America/Chicago", "mississippi": "America/Chicago",
  "arkansas": "America/Chicago", "nebraska": "America/Chicago", "kansas": "America/Chicago",
  "new mexico": "America/Denver", "hawaii": "Pacific/Honolulu", "alaska": "America/Anchorage",
  "montana": "America/Denver", "idaho": "America/Boise", "maine": "America/New_York",
  "new hampshire": "America/New_York", "vermont": "America/New_York",
  "rhode island": "America/New_York", "delaware": "America/New_York",
  "south dakota": "America/Chicago", "north dakota": "America/Chicago",
  "wyoming": "America/Denver", "west virginia": "America/New_York"
};

// Short city abbreviations that are too ambiguous for substring matching.
// These are only checked when the whole location string equals them (or is comma-separated with them).
const SHORT_CITY_ABBREVS = new Set(['la', 'sf', 'dc', 'nyc', 'rio', 'ny']);

const WORD_SEP = /[\s,.()\-\/]/;
// Returns true if `needle` appears at a word boundary inside `haystack`
function hasWordBoundary(haystack, needle) {
  const idx = haystack.indexOf(needle);
  if (idx === -1) return false;
  const before = haystack[idx - 1], after = haystack[idx + needle.length];
  return (!before || WORD_SEP.test(before)) && (!after || WORD_SEP.test(after));
}

// Resolve a location string to an IANA timezone
function resolveTimezone(locationStr) {
  if (!locationStr) return null;
  const lower = locationStr.trim().toLowerCase();

  // 1. Direct city match — with word-boundary safety
  for (const [city, tz] of Object.entries(CITY_TIMEZONES)) {
    if (SHORT_CITY_ABBREVS.has(city)) {
      // For short abbreviations, only match if the whole token equals the location
      // e.g. "NYC, USA" matches but "Nether-la-nds" does NOT
      const tokens = lower.split(/[\s,.()\-\/]+/).filter(Boolean);
      if (tokens.includes(city)) return tz;
    } else if (city.length <= 3) {
      // Very short names — require whole-token match only
      const tokens = lower.split(/[\s,.()\-\/]+/).filter(Boolean);
      if (tokens.includes(city) || lower === city) return tz;
    } else {
      // Normal multi-character city names — require word boundaries
      if (hasWordBoundary(lower, city)) return tz;
    }
  }

  // 2. US state detection (e.g., "Miami, FL" or "California, USA")
  const commaMatch = lower.match(/,\s*([a-z]{2})(?:\s|$|,)/);
  if (commaMatch) {
    const stateCode = commaMatch[1];
    if (US_STATE_TIMEZONES[stateCode]) return US_STATE_TIMEZONES[stateCode];
  }
  // Check for full state names (require word boundaries)
  for (const [state, tz] of Object.entries(US_STATE_TIMEZONES)) {
    if (state.length > 2 && hasWordBoundary(lower, state)) return tz;
  }

  // 3. Country-level fallback
  const countryName = resolveCountryName(locationStr);
  if (countryName && COUNTRY_TIMEZONES[countryName]) {
    return COUNTRY_TIMEZONES[countryName];
  }

  return null;
}

// Cache instantiated Intl.DateTimeFormat objects to avoid expensive re-creation
const _timeFormatterCache = new Map();
const _hourFormatterCache = new Map();

// Format local time using Intl (zero-dependency, DST-aware)
function getLocalTimeString(ianaTimezone) {
  if (!ianaTimezone) return null;
  try {
    let formatter = _timeFormatterCache.get(ianaTimezone);
    if (!formatter) {
      formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: ianaTimezone,
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      _timeFormatterCache.set(ianaTimezone, formatter);
    }
    return formatter.format(new Date());
  } catch (e) {
    return null; // Invalid timezone string
  }
}

// Get hour (0-23) for day/night detection
function getLocalHour(ianaTimezone) {
  if (!ianaTimezone) return null;
  try {
    let formatter = _hourFormatterCache.get(ianaTimezone);
    if (!formatter) {
      formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: ianaTimezone,
        hour: 'numeric',
        hour12: false
      });
      _hourFormatterCache.set(ianaTimezone, formatter);
    }
    const parts = formatter.formatToParts(new Date());
    const hourPart = parts.find(p => p.type === 'hour');
    return hourPart ? parseInt(hourPart.value) : null;
  } catch (e) {
    return null;
  }
}

