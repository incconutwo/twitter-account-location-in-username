# X/Twitter Location Flag & Blocker

A Chrome browser extension that displays the country flag of X.com (Twitter) users next to their usernames and allows you to automatically hide posts based on specific countries.

## 🚀 Key Features

### 🌎 Country Flags
- **Automatic Detection:** Fetches user location data via Twitter's internal API.
- **Cross-Platform Support:** Uses Twemoji SVGs to ensure flags render correctly on **Windows 10/11**, macOS, Linux, and mobile (fixes the "letter" issue on Windows).
- **Visual Integration:** Flags are seamlessly inserted next to the verification badge or handle.

### 🛡️ Post Blocking (New!)
- **Hide by Country:** Select specific countries from the extension popup to automatically hide tweets from users in those locations.
- **Clean Feed:** Posts are removed from the DOM before they clutter your view.
- **Easy Management:** Add or remove blocked countries instantly using the dropdown menu and chip tags in the popup.

### ⚡ Performance & Efficiency
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

- **Browsers:** Chromium-based browsers (Chrome, Brave, Edge, etc.).
- **OS:** Windows, macOS, Linux.

## Credits

- **Twemoji:** Uses Twitter's open-source emoji library for consistent rendering across operating systems.
- **Flag Data:** Country mapping logic based on standard ISO codes.

---
*Note: This extension is for educational and personal customization purposes. It is not affiliated with X Corp.*
---