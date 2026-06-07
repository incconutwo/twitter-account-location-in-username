# Changelog

All notable changes to the **X/Twitter Location Flags, Time & Blocker** extension will be documented in this file.

## [1.2.0] - 2026-06-07

**Name Change:** The extension has been renamed to **"X/Twitter Location Flags, Time & Blocker"** to reflect the powerful new features introduced in this release.

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

---

## [1.1.1] - 2025-12-24

This release focuses on user experience improvements and community engagement:

*   **Verified-Only Filtering**: A new toggle in the popup allows users to exclusively filter posts from verified accounts based on country. This provides more granular control over content visibility.
*   **Auto-Block Feature**: Introduces an "Auto-Block" option that permanently blocks Twitter accounts matching the selected country filters. This feature includes a prominent confirmation modal to prevent accidental activation, emphasizing its irreversible nature.
*   **Enhanced User Data Fetching**: The `pageScript.js` now fetches both the user's location and their verified status (`is_blue_verified`) from Twitter's API, enabling the new verified-only filtering.
*   **New Welcome Modal**: A first-time user experience modal has been added to onboard new users, highlighting key features like country flags, filtering, and verified-only mode.
*   **Priority Feedback System**: Integrated a "priority feedback" system via donations on Ko-fi. Users can include a ticket ID (generated after sending feedback) in their donation message to potentially expedite their request.

---

## [1.1.0] - 2025-12-16


### 🚀 New Features
*   **Searchable Country List**: Added a search bar inside the popup dropdown to easily find countries when adding them to the blocklist.
*   **In-App Feedback System**: Added a feedback form directly in the popup to report bugs or suggest features without leaving the extension.
*   **Update Notifier**: The extension now checks GitHub for newer versions and displays a banner or modal if an update is available (useful for manual installs).
*   **Developer Mode**: Added a hidden debug panel (activates by clicking the "Location Flag & Blocker" header 5 times) to test updates and clear cache.

### ⚡ Improvements & Performance
*   **Batch API Submissions**: Implemented a `writeBuffer` system in the content script. Instead of sending data to the cloud API one by one, requests are now batched (every 30 seconds or 50 items), significantly reducing network traffic.
*   **Dynamic GraphQL Detection**: The `pageScript` now "sniffs" the URL to dynamically detect the correct Twitter/X GraphQL Query ID. This makes the extension much more resilient to X.com silent updates.
*   **Header Fallback Mechanism**: Added a fallback method to manually construct authentication headers from cookies (`ct0` token) if request interception fails.
*   **CSS Injection**: Styles for flags (`#tf-style`) are now injected immediately into the document head to prevent layout shifts.

### 🛠 Fixes & Stability
*   **Context Invalidation Handling**: Added checks (`isContextInvalid`) throughout the codebase to prevent error logs and crashes when the extension is updated or reloaded while tabs remain open.
*   **Stale Cache Logic**: Introduced a `CACHE_STALE_DAYS` (90 days) setting to keep data longer while prioritizing fresh fetches.
*   **Queue Management**: Improved the logic for the Cloud vs. Twitter API processing queues to prevent race conditions.

### ⚙️ Technical
*   **Manifest V3 Updates**: Added a background service worker (`background.js`) to handle initialization tasks.
*   **Permissions**: Updated `host_permissions` to include the cloud worker API and GitHub raw content (for update checks).
*   **Browser Specific**: Updated Gecko/Firefox specific settings and ID.
