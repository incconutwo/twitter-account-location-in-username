# X/Twitter Location Flag & Blocker (v1.1.0)

A browser extension that displays the country flag of X.com (Twitter) users next to their usernames and allows you to automatically hide posts based on specific countries.

> **Enjoying the extension?** Please consider dropping a **Star ⭐** on this repository to show your support! It helps visibility a ton.

## Install from Web Stores

🔗 **Chrome:** [Chrome Web Store](https://chromewebstore.google.com/detail/xtwitter-country-flags-bl/dgodabjkaifjlhpcapiohikkklnailla?authuser=0&hl=en)  
🦊 **Firefox:** [Firefox Add-ons Store](https://addons.mozilla.org/fr/firefox/addon/x-twitter-flags-blocker/)

---

## 🚀 What's New in v1.1.0

This release focuses on massive backend performance upgrades and UI quality-of-life improvements:

*   **Migrated to SQL (Cloudflare D1):** We switched the backend from Workers KV to Cloudflare D1 (SQL). This ensures faster reads, better data structure, and higher scalability for the community database.
*   **Request Batching:** Data submissions are now buffered and sent in batches (groups of 50). This significantly reduces network requests and backend load.
*   **Stale-While-Revalidate Caching:** The extension now shows cached locations immediately (even if slightly old) while silently updating them in the background.
*   **Searchable Blocker:** You can now type to search for countries in the blocking dropdown menu.
*   **Performance:** Optimized CSS injection and reduced layout trashing during scroll.

---

## Key Features

### 🌎 Country Flags
- **Automatic Detection:** Fetches user location data via Twitter's internal API.
- **Cross-Platform Support:** Uses Twemoji SVGs to ensure flags render correctly on **Windows 10/11**, macOS, Linux, and mobile (fixes the "letter" issue on Windows).
- **Visual Integration:** Flags are seamlessly inserted next to the verification badge or handle.

### ☁️ Community Cloud Database (SQL Powered)
There is a crowdsourced database for location data. This makes the extension way faster, and with enough data, it could make the extension work even without the Twitter API.
- **Stronger Together:** When my extension finds a user's location, it shares it with the cloud. When *you* see that user later, you get the location instantly from the cloud without using your own API limits.
- **Ultra Low Latency:** Lookups via Cloudflare D1 take ~50ms (compared to Twitter's 500ms+).
- **Save Your Limits:** This drastically reduces how often we hit Twitter's API, so the extension stays green and working longer.

### 🛡️ Post Blocking
- **Hide by Country:** Select specific countries from the extension popup to automatically hide tweets from users in those locations.
- **Searchable List:** Quickly find countries to block using the new search bar in the popup.
- **Clean Feed:** Posts are removed from the DOM before they clutter your view.

### ⚡ Performance & Efficiency
- **Smart Caching:**
  - **Success Cache:** Locations are cached for **30 days**.
  - **Stale Cache:** Old data (up to 90 days) is shown instantly while a fresh update is fetched in the background.
  - **Negative Caching:** Users with no location set are cached for **14 days** to prevent repeated failed requests.
- **Viewport Prefetching:** Uses an `IntersectionObserver` to "look ahead" and fetch data before the tweet scrolls into view.
- **Rate Limit Protection:** Automatically detects API rate limits and pauses requests until the reset window.

## Manual Installation (Dev Build)

1. Download or clone this repository (switch to `dev` branch).
2. Open Chrome/Brave/Edge and go to `chrome://extensions/`.
3. Enable **"Developer mode"** in the top right corner.
4. Click **"Load unpacked"** and select the folder containing this extension.
5. The extension should now be active.

## Firefox Installation (Developer Build)

Since this version is not yet on the Firefox Add-ons Store, you need to load it as a temporary add-on.

1.  Download or clone this repository.
2.  Open Firefox and type `about:debugging` in the address bar.
3.  Click **"This Firefox"** on the left sidebar.
4.  Click the **"Load Temporary Add-on..."** button.
5.  Navigate to the extension folder and select the **`manifest.json`** file.

## How it works technically

- **Architecture:** MV3 (Manifest V3) with a lightweight Service Worker (`background.js`).
- **Data Fetching:**
  1.  **Tier 1:** Checks the Cloudflare D1 Worker cache.
  2.  **Tier 2:** If missing, intercepts the authenticated session to query Twitter's GraphQL API (`AccountBasedIn`).
- **Optimization:**
  - `writeBuffer`: Queues uploads to the cloud to prevent flooding the backend.
  - `injectStyles`: Programmatically injects CSS to avoid external file request latency.
  - `pageScript.js`: Bridges the gap between the content script and the page's XHR/Fetch stack to capture authentication headers securely.

## Permissions

- `storage`: Used to save your cache (user locations), settings, and blocked country list.
- `activeTab` / Host Permissions: Required to run scripts on `x.com` and `twitter.com`.

## Credits

- **Twemoji:** Uses Twitter's open-source emoji library for consistent rendering across operating systems.
- **Flag Data:** Country mapping logic based on standard ISO codes.
- Originally forked from [RhysSullivan/twitter-account-location-in-username](https://github.com/RhysSullivan/twitter-account-location-in-username).

## ❤️ Support the Project

This extension is 100% free and open source. I built it because I wanted a cleaner, more transparent Twitter experience.

However, maintaining the **Cloudflare D1 Database** and handling the traffic does incur costs.

If you enjoy the extension, there are two easy ways to support it:

1.  **⭐ Star this Repo:** It helps more people find the project and encourages me to keep shipping updates.
2.  **☕ Buy me a Coffee:** If you want to help me continue and expand the project or help cover Database costs, you can donate here:
    *   [Ko-fi](https://ko-fi.com/incconutwo)

Thanks for using the extension! 🚀

---
*Note: This extension is for educational and personal customization purposes. It is not affiliated with X Corp.*
