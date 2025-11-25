# Privacy Policy for X/Twitter Country Flags & Blocker

**Last Updated:** November 25, 2025

This Privacy Policy describes how the **X/Twitter Country Flags & Blocker** extension collects, uses, and discloses information.

## 1. Data Collection
We prioritize user privacy. The extension operates primarily on your local device. However, to provide community-sourced location data, the extension communicates with a third-party database (Cloudflare KV).

*   **Public Data:** We collect and store **public** Twitter usernames (e.g., `@handle`) and public location strings (e.g., "USA") found on timelines.
*   **IP Addresses:** Your IP address is transmitted to the Cloudflare server solely for the purpose of preventing abuse (spam/fake data). **We do not store your IP address.** It is immediately cryptographically hashed (SHA-256) upon receipt. We cannot reverse this hash to identify you.
*   **No Personal Data:** We do not collect **any** browsing history, passwords, Direct Messages (DMs), or emails.

## 2. How Data is Used
*   **Location Verification:** Public location data is stored in a shared community database to reduce X/Twitter API usage for all users.
*   **Reputation System:** The hashed IP identifier is used to calculate a "Trust Score" to verify the accuracy of submitted data.

## 3. Third-Party Services
*   **Cloudflare:** We use Cloudflare Workers and KV Storage to host the community database. Cloudflare may process network requests in accordance with their privacy policy.

## 4. User Control
You can disable the extension at any time. You can also view the full source code of this extension on GitHub to verify these claims, as this project is open source.

## 5. Contact
If you have questions about this policy, you may contact the developer via the support tab on the Chrome Web Store.