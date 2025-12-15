# Changelog

## [1.1.0]

### New Features
- **Cloud-First Architecture**: Implemented a hybrid data fetching strategy that checks a community cloud database before querying Twitter's API, significantly improving speed and reducing rate limits.
- **Crowdsourced Database**: Automatically contributes discovered user locations to the cloud database to benefit the community.
- **In-App Update Notifications**: Added a full-screen modal to alert users when a critical update is available.
- **Feedback System**: Integrated a feedback form directly in the popup, allowing users to report bugs or suggestions without leaving the extension.
- **Developer Mode**: Added a hidden debug panel (accessed by clicking the title 5 times) for testing updates and clearing local caches.

### Technical Improvements
- **Performance Optimization**: Replaced DOM scanning loops with `IntersectionObserver` to only process tweets currently in the viewport, reducing CPU usage.
- **Smart Rate Limiting**: Implemented intelligent queue management (`cloudQueue` and `twitterQueue`) that detects and respects Twitter's API rate limits to prevent temporary blocks.
- **Robust Caching**: Enhanced caching system with configurable expiry (30 days) and stale-while-revalidate logic, persisted to local storage.
- **API Interception**: Completely rewrote `pageScript.js` to more reliably capture Twitter's authentication headers and `AboutAccountQuery` ID for internal API requests.

### Fixes & Refactoring
- **Content Script Overhaul**: `content.js` was fully refactored for better stability and error handling.
- **Popup UI**: Modernized `popup.js` with cleaner state management and dynamic UI injection for modals.
- **Permissions**: Updated `manifest.json` to support the new background service worker and storage requirements.
