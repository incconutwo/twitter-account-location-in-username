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
  "French Southern Territories": "🇹4",
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
  "Suriname": "🇸🇷",
  "Svalbard and Jan Mayen": "🇸🇯",
  "Swaziland": "🇸🇿",
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
  "Virgin Islands, British": "🇻🇬",
  "Virgin Islands, U.S.": "🇻6",
  "Wallis and Futuna": "🇼🇫",
  "Western Sahara": "🇪🇭",
  "Yemen": "🇾🇪",
  "Zambia": "🇿🇲",
  "Zimbabwe": "🇿🇼",

  // Regions & Continents
  "North America": "🌎",
  "South America": "🌎",
  "Central America": "🌎",
  "Latin America": "🌎",
  "Latin America and the Caribbean": "🌎",
  "Latin America & Caribbean": "🌎",
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
  "Asia-Pacific": "🌏",
  "Oceania": "🌏",
  "Antarctica": "🇦🇶",
  "World": "🌐",
  "Global": "🌐",
  "International": "🌐"
};

// --- Performance Optimizations: Pre-computed at load time ---

// O(1) lowercase lookup map
const COUNTRY_FLAGS_LOWER = new Map(
  Object.entries(COUNTRY_FLAGS).map(([k, v]) => [k.toLowerCase(), v])
);

// Pre-sorted by length (longest first) for substring matching
const SORTED_COUNTRIES = Object.keys(COUNTRY_FLAGS)
  .sort((a, b) => b.length - a.length)
  .map(c => ({ name: c, lower: c.toLowerCase(), flag: COUNTRY_FLAGS[c] }));

// Pre-cached Twemoji URLs
const TWEMOJI_URLS = new Map();
for (const emoji of Object.values(COUNTRY_FLAGS)) {
  if (!TWEMOJI_URLS.has(emoji)) {
    const hex = Array.from(emoji).map(c => c.codePointAt(0).toString(16)).join('-');
    TWEMOJI_URLS.set(emoji, `https://abs-0.twimg.com/emoji/v2/svg/${hex}.svg`);
  }
}

function getTwemojiUrl(emoji) {
  return TWEMOJI_URLS.get(emoji) || null;
}

function getCountryFlag(countryName) {
  if (!countryName) return null;
  
  const normalized = countryName.trim();
  const normalizedLower = normalized.toLowerCase();
  
  // 1. O(1) exact match (most common case)
  if (COUNTRY_FLAGS_LOWER.has(normalizedLower)) {
    return COUNTRY_FLAGS_LOWER.get(normalizedLower);
  }
  
  // 2. Substring match using pre-sorted list (e.g. "Paris, France" -> France)
  for (const { name, lower, flag } of SORTED_COUNTRIES) {
    const idx = normalizedLower.indexOf(lower);
    if (idx !== -1) {
      // Word boundary check without regex (faster)
      const before = normalizedLower[idx - 1];
      const after = normalizedLower[idx + lower.length];
      if ((!before || before === ' ' || before === ',') && 
          (!after || after === ' ' || after === ',')) {
        return flag;
      }
    }
  }
  
  return null;
}

// Resolves a location string to a canonical country name (avoids duplicate lookup)
function resolveCountryName(location) {
  if (!location) return null;
  
  const normalizedLower = location.trim().toLowerCase();
  
  // O(1) exact match
  for (const { name, lower } of SORTED_COUNTRIES) {
    if (lower === normalizedLower) return name;
  }
  
  // Substring match
  for (const { name, lower } of SORTED_COUNTRIES) {
    const idx = normalizedLower.indexOf(lower);
    if (idx !== -1) {
      const before = normalizedLower[idx - 1];
      const after = normalizedLower[idx + lower.length];
      if ((!before || before === ' ' || before === ',') && 
          (!after || after === ' ' || after === ',')) {
        return name;
      }
    }
  }
  
  return null;
}