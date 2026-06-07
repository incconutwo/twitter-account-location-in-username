# X/Twitter Location Flag & Blocker

A browser extension that displays the country flag of X.com (Twitter) users next to their usernames and allows you to automatically hide posts based on specific countries.

> **Enjoying the extension?** Please consider dropping a **Star ⭐** on this repository to show your support! It helps visibility a ton.

# 🚀 Changelog: Version 1.2.0

**Name Change:** The extension has been renamed to **"X (Twitter) Location Flags, Local Time & Blocker"** to reflect the powerful new features introduced in this release.

### 🌍 New Features & Capabilities

*   **Feed Geography Dashboard 📊:**
    *   Introduced a dedicated dashboard page (`dashboard.html`, `dashboard.css`, `dashboard.js`) accessible from the extension popup.
    *   Features an interactive vector world map (`world-map.svg`) that maps user feed demographics.
    *   Highlights countries with a logarithmic heat-map gradient based on the volume of users spotted from each location.
    *   Displays hover-responsive country metadata (country name, flag emoji, and specific count).
    *   Renders a sidebar detailing the ranked list of countries discovered.
    *   Allows users to share a summary of their feed geography statistics directly to X with a pre-configured template.
*   **Local Time & Timezone Detection 🕒:**
    *   Resolves locations to their corresponding IANA timezone databases (`countryFlags.js`).
    *   Appends a live-updating local clock (`.tf-time`) next to the flag emoji.
    *   Detects late hours (10:00 PM to 6:00 AM) in the user's localized timezone and automatically prepends a moon emoji (🌙) to indicate night-time.
    *   Updates local clocks globally on a 60-second background interval.
*   **Approximate Location Warning ⚠️:**
    *   Added detection for broad or non-specific locations (where X's internal coordinates flag the profile location as approximate/non-accurate).
    *   Appends a subtle warning icon (⚠️) next to the flag if the location is flagged as a regional approximation.
    *   Appends an `(Approximate)` indicator to the flag's hover tooltip text.
*   **Discovery Notification Toasts (Passport Mode) 🛂:**
    *   Added a "Passport Mode" feature that prompts a toast notification at the top-right of the viewport whenever the user scrolls past an account originating from a newly discovered country.
    *   Toasts render an animated progress bar indicating overall global exploration progress (out of 195 countries).
*   **Milestone Achievements Engine 🏆:**
    *   Introduced system-wide triggers to track overall progression metrics (e.g., hiding 100, 500, or 2,500 spam posts).
    *   Triggers milestone-specific celebration banners to provide feedback or request community feedback/support.
*   **Additional Filter Settings ⚙️:**
    *   **Always Load Comment Flags:** Added a configuration to toggle between legacy behavior (always fetch location data for reply threads) and optimized behavior (re-route resources away from secondary comment lists on status pages).

### ⚡ Performance & Architecture Refactoring

*   **IndexedDB Caching Layer 🗄️:**
    *   Migrated the storage pipeline from basic `chrome.storage.local` cache limits to an asynchronous IndexedDB implementation (locations store under `TwitterLocationCacheDB`).
    *   This removes standard MV3 storage limits and supports high-volume persistent caching without degrading extension read/write times.
*   **Passive Snooping Pipeline 📡:**
    *   Extensively updated `pageScript.js` to passively intercept incoming API payload chunks from standard Twitter operations (e.g., timeline fetches and search queries).
    *   Recursively scans raw JSON payloads for user models containing locations, verification parameters, and timezone offsets, sending them in batches back to the content script using `requestIdleCallback`.
    *   Enables location resolving and caching without requiring manual GraphQL API requests.
*   **Dynamic Query ID Sniffing 🔍:**
    *   Implemented Webpack bundle chunk interception. The `pageScript.js` intercepts chunk pushes to `webpackChunk_twitter_responsive_web` to dynamically extract the updated query ID for `AboutAccountQuery`, minimizing the risk of query ID stale-outs after X platform updates.
    *   Added an auto-retry and re-discovery mechanism if the Twitter API returns a 400 Bad Request status code.
*   **Request Staggering, Micro-batching, & Throttle Guards ⏳:**
    *   Introduced a scroll-debounce system (`IntersectionObserver` combined with `WeakMap` delay tracking) to avoid initiating database/network operations on elements that are scrolled past quickly.
    *   Added micro-batching for DOM mutations using a 60ms collector window.
    *   Aggregates network lookups to prevent rate limiting, and introduces exponential backoff logic for Cloudflare API failures.
*   **Detection Engine Optimization 🏎️:**
    *   Refactored flag matching logic to utilize pre-computed lowercase mappings (`COUNTRY_FLAGS_LOWER`, `COUNTRY_NAMES_LOWER`) and length-sorted tuples (`SORTED_COUNTRIES`).
    *   Implements O(1) exact matches first, followed by strict tokenized matches (up to 3-grams) before running string boundary searches, reducing CPU usage during thread scanning.

### 🎨 UI/UX Enhancements

*   **Popup Overhaul 📱:**
    *   Redesigned the layout to support multiple toggles cleanly on a single scrollable pane.
    *   Replaced inline styling elements with premium tooltip elements on setting tags to explain complex configurations clearly.
    *   Added a quick stats widget indicating the total number of hidden posts, blocked accounts, and scanned users.
    *   Replaced the basic text donation hyperlink with a dedicated "Buy Me a Pizza" slice banner.
*   **Dictionary Expandability 📖:**
    *   Added native-language spelling variants (e.g., *Deutschland, Suomi, Россия, 日本, المغرب*) to support locations set in local characters.
    *   Included updated international abbreviations (e.g., *RSA, KSA, NZ, UAE*) and country naming updates (e.g., *Türkiye, Czechia, Eswatini, DR Congo*).
    *   Introduced fallback mapping arrays to resolve major cities (e.g., *New York, Berlin, Tokyo, Dubai*) and US states to their exact timezones.

### 🛠️ Developer Tools

*   **Developer Panel Expansion 🔧:**
    *   Added interactive controls to simulate milestone achievements (100, 500, and 2,500 blocked configurations) to verify celebration layout behaviors.
    *   Added a toggle to clear the local IndexedDB location cache.
    *   **Data Source Selector:** Allows forced routing configurations (Auto, Local Cache Only, Cloudflare Only, Twitter Only) for network pipeline auditing.
    *   **Debug Source Banners:** Adds a color-coded tag beside usernames denoting the origin of the flag data (cache [Gray], cloudflare [Orange], or twitter [Blue]).

### 🔒 Security & Robustness

*   **Credential Sanitization 🧼:**
    *   Before headers are recorded, sensitive cookies and standard authorization properties are stripped out from internal storage parameters to prevent credential leakage.
*   **Protection Against Multiple Injections 🛡️:**
    *   Introduced state-flag initialization checks inside the encapsulated context of `pageScript.js` to ensure the interceptor is only registered once per page load.
*   **Fallback Authorization Logic 🗝️:**
    *   Cookie retrieval fallback checks now utilize the snuffed active session bearer token in place of hardcoded variables to maintain standard operations even during credential rotations.

##  Key Features

### 🌎 Country Flags
- **Automatic Detection:** Fetches user location data via Twitter's internal API.
- **Cross-Platform Support:** Uses Twemoji SVGs to ensure flags render correctly on **Windows 10/11**, macOS, Linux, and mobile (fixes the "letter" issue on Windows).
- **Visual Integration:** Flags are seamlessly inserted next to the verification badge or handle.

### 🤝 Community Cloud Database (New!)
There is now a crowdsourced database for location data. This makes the extension way faster, and with enough data, it could make the extension work even without the Twitter API.
- **Stronger Together:** When my extension finds a user's location, it shares it with the cloud. When *you* see that user later, you get the location instantly from the cloud without using your own API limits.
- **Wayyy Faster:** Cloudflare lookups take about 50ms (Twitter takes 500ms+).
- **Save Your Limits:** This drastically reduces how often we hit Twitter's API, so the extension stays green and working longer.

### 🛡️ Post Blocking (New!)
- **Hide by Country:** Select specific countries from the extension popup to automatically hide tweets from users in those locations.
- **Clean Feed:** Posts are removed from the DOM before they clutter your view.
- **Easy Management:** Add or remove blocked countries instantly using the dropdown menu and chip tags in the popup.

### ⚡ Performance & Efficiency
- **Crowdsourced Database:** I've built a database using Cloudflare so now the extension checks it before ever asking Twitter. It's lightning fast (50ms vs 500ms) and keeps your API usage ultra-low.
- **Smart Caching:**
  - **Success Cache:** Locations are cached for **30 days** to minimize API usage.
  - **Negative Caching:** Users with no location set are cached for **3 days** to prevent repeated failed requests and rate limiting.
- **Viewport Prefetching:** Uses an `IntersectionObserver` to "look ahead" (approx. 5-8 tweets) and fetch data before the tweet scrolls into view.
- **Rate Limit Protection:** Automatically detects API rate limits and pauses requests until the reset window, preventing temporary bans.

## 📦 Installation

### 🚀 Install from Official Stores (Recommended)

You can install the official version of the extension directly from the stores:

*   **Chrome Web Store:** [Get it for Chrome / Chromium-based browsers](https://chromewebstore.google.com/detail/xtwitter-country-flags-bl/dgodabjkaifjlhpcapiohikkklnailla)
*   **Firefox Add-ons:** [Get it for Firefox](https://addons.mozilla.org/en-US/firefox/addon/x-twitter-flags-blocker/)

---

### 🛠️ Manual Installation (Developer Build)

#### Chrome & Chromium-based Browsers (Brave, Edge, Opera, etc.)
1. Download or clone this repository.
2. Open Chrome and go to `chrome://extensions/`.
3. Enable **"Developer mode"** in the top right corner.
4. Click **"Load unpacked"** and select the `chrome` folder containing this extension.
5. The extension should now be active.

#### Firefox (Temporary Load)
1.  Download or clone this repository.
2.  Open Firefox and type `about:debugging` in the address bar.
3.  Click **"This Firefox"** on the left sidebar.
4.  Click the **"Load Temporary Add-on..."** button.
5.  Navigate to the `firefox` folder and select the **`manifest.json`** file.
6.  The extension is now active.

*> **Note:** Because this is a temporary load, Firefox will remove it if you fully close the browser. You will need to reload it next time you open Firefox.*

#### Quick Install Guide (Unpacked)
Clone the repo **OR** Download/Extract the zip → Navigate to `chrome://extensions` (or `about:debugging`) → Click **Load unpacked** / **Load Temporary Add-on** and select the folder → Pin the extension.


## Usage

1. **Browse:** Go to [X.com](https://x.com). The extension works automatically on your Home timeline, Search results, and Profiles.
2. **Settings:** Click the extension icon in your browser toolbar.
   - **Toggle:** Enable or disable the extension globally.
   - **Block Countries:** Use the dropdown menu to select a country. Posts from this location will disappear immediately.
   - **Manage Blocks:** Click the "×" on a country tag to unblock it.

## How it works technically

Unlike older versions that required opening background windows, this version is streamlined:
- It injects a lightweight script to piggyback on the existing authenticated session.
- It intercepts specific GraphQL calls to fetch the `AccountBasedIn` data securely.
- It uses `IntersectionObserver` with a `rootMargin` to lazy-load data efficiently, only querying for users currently in or near your viewport.

## Permissions

- `storage`: Used to save your cache (user locations), settings, and blocked country list.
- `activeTab` / Host Permissions: Required to run scripts on `x.com` and `twitter.com`.

## Compatibility

- **Browsers:** Chromium-based browsers (Chrome, Brave, Edge, etc.) and Firefox-based browsers.
- **OS:** Windows, macOS, Linux, Mobile.

## Credits

- **Twemoji:** Uses Twitter's open-source emoji library for consistent rendering across operating systems.
- **Flag Data:** Country mapping logic based on standard ISO codes.
- Originally forked from [RhysSullivan/twitter-account-location-in-username](https://github.com/RhysSullivan/twitter-account-location-in-username).

## ❤️ Support the Project

This extension is 100% free and open source. I built it because I wanted a cleaner, more transparent Twitter experience from bots/fake accounts for myself and the community.

However, maintaining the **Community Database** (Cloudflare Workers) and keeping the API running smoothly does take time and resources.

If you enjoy the extension, there are two easy ways to support it:

1.  **⭐ Star this Repo:** It helps more people find the project and encourages me to keep shipping updates.
2.  **☕ Buy me a Coffee:** If you want to help me continue and expand the project or/and help cover future Database costs, you can donate here:
    *   [Ko-fi](https://ko-fi.com/incconutwo) thanks,

Thanks for using the extension! 🚀

---
*Note: This extension is for educational and personal customization purposes. It is not affiliated with X Corp.*