# Changelog V1.1.0

All notable changes to the **X/Twitter Country Flags & Blocker** extension will be documented in this file.

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