# Privacy Policy for X (Twitter) Location Flags, Local Time & Blocker

**Last Updated:** October 7, 2026

This Privacy Policy describes how the **X (Twitter) Location Flags, Local Time & Blocker** extension collects, uses, and discloses information.

## 1. Data Collection
We prioritize user privacy. The extension operates primarily on your local device. To provide community-sourced location data and understand aggregate extension health, the extension communicates with Cloudflare KV and Umami Analytics:

*   **Public Data:** We collect and store **public** Twitter/X usernames (e.g., `@handle`) and public location strings (e.g., "USA") found on timelines to power the shared community cache.
*   **IP Addresses:** Your IP address is transmitted to the Cloudflare server solely for the purpose of preventing abuse (spam/fake data). **We do not store your IP address.** It is immediately cryptographically hashed (SHA-256) upon receipt. We cannot reverse this hash to identify you.
*   **Anonymous Extension Telemetry (Umami):** We collect strictly anonymous, aggregate usage events (such as active extension version, daily active heartbeat, and anonymous UI interactions like opening the dashboard or changelog) via Umami, a privacy-focused, cookie-free analytics platform. No X/Twitter handles, browsing history, or personal identifiers are ever included in these events.
*   **No Personal Data:** We do not collect **any** browsing history, passwords, Direct Messages (DMs), emails, or personal account data.

## 2. How Data is Used
*   **Location Verification:** Public location data is stored in a shared community database to reduce X/Twitter API usage for all users.
*   **Reputation System:** The hashed IP identifier is used to calculate a "Trust Score" to verify the accuracy of submitted data.
*   **Product Improvement:** Anonymous aggregate telemetry helps us verify extension stability across versions and understand which features are used.

## 3. Third-Party Services
*   **Cloudflare:** We use Cloudflare Workers and KV Storage to host the community database. Cloudflare may process network requests in accordance with their privacy policy.
*   **Umami Cloud:** We use Umami (`cloud.umami.is`), a GDPR- and CCPA-compliant, cookie-free analytics service, to process anonymous aggregate extension events without tracking individual users across websites.

## 4. User Control
You can disable or uninstall the extension at any time. You can also view the full source code of this extension on GitHub to verify these claims, as this project is open source.

## 5. Contact
If you have questions about this policy, you may contact the developer via the support tab on the Chrome Web Store or Firefox Add-ons, or via GitHub Issues.