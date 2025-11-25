# X/Twitter Location Flag & Blocker

A browser extension that displays the country flag of X.com (Twitter) users next to their usernames and allows you to automatically hide posts based on specific countries.

> **Enjoying the extension?** Please consider dropping a **Star ⭐** on this repository to show your support! It helps visibility a ton.

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

## Installation

1. Download or clone this repository.
2. Open Chrome and go to `chrome://extensions/`.
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
6.  The extension is now active.

*> **Note:** Because this is a developer build, Firefox will remove it if you fully close the browser. You will need to reload it next time you open Firefox.*

### Quick Install Guide

Clone the repo **OR** Download/Extract the zip → Navigate to `chrome://extensions` → Enable **Developer mode** → Click **Load unpacked** and select the *unpacked* project folder → Pin the extension from the puzzle icon.

---

## Install from Chrome Web Store and Firefox Add-ons (coming very soon)

In the works. This section will be updated once the extension is published on the Chrome Web Store.

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
