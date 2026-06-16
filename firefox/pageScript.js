(function() {
  if (window.__twitterLocationFlagsLoaded) return;
  window.__twitterLocationFlagsLoaded = true;

  // State
  let twitterHeaders = null;
  let headersReady = false;
  let activeQueryId = null; // Discovered dynamically
  let queryIdDiscovered = false;
  let discoveredBearerToken = null; // Sniffed from Twitter's own API calls

  let headersPromiseResolver = null;
  const headersPromise = new Promise(resolve => {
    headersPromiseResolver = resolve;
  });

  // Load cached query ID passed from content script
  const scriptEl = document.currentScript || document.querySelector('script[data-cached-query-id]');
  if (scriptEl) {
    const cachedId = scriptEl.getAttribute('data-cached-query-id');
    if (cachedId) {
      activeQueryId = cachedId;
      queryIdDiscovered = true;
    }
  }

  // Hardcoded fallback — only used if sniffing fails
  const FALLBACK_BEARER = 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';

  function extractQueryIdFromString(str) {
    if (!str || typeof str !== 'string') return null;
    const m = str.match(/queryId:"([a-zA-Z0-9_-]+)".{0,100}AboutAccountQuery|AboutAccountQuery.{0,100}queryId:"([a-zA-Z0-9_-]+)"/s);
    return m ? (m[1] || m[2]) : null;
  }

  function scanWebpackSource(modules) {
    for (const modId in modules) {
      const modFn = modules[modId];
      if (typeof modFn === 'function') {
        const fnStr = modFn.toString();
        if (fnStr.includes('AboutAccountQuery')) {
          const qId = extractQueryIdFromString(fnStr);
          if (qId) return qId;
        }
      }
    }
    return null;
  }

  function setupWebpackInterceptor() {
    if (typeof window === 'undefined') return;

    const checkAndSet = (chunk) => {
      if (queryIdDiscovered && activeQueryId) return;
      if (chunk && chunk[1]) {
        const qId = scanWebpackSource(chunk[1]);
        if (qId) {
          activeQueryId = qId;
          queryIdDiscovered = true;
          sendToContent('__queryIdDiscovered', { queryId: activeQueryId });
        }
      }
    };

    // Intercept future chunk pushes
    if (!window.webpackChunk_twitter_responsive_web) {
      window.webpackChunk_twitter_responsive_web = [];
    }

    const originalPush = window.webpackChunk_twitter_responsive_web.push;
    window.webpackChunk_twitter_responsive_web.push = function(...args) {
      for (const arg of args) {
        if (!queryIdDiscovered) {
          if (window.requestIdleCallback) {
            window.requestIdleCallback(() => {
              try { checkAndSet(arg); } catch(e) {}
            });
          } else {
            setTimeout(() => {
              try { checkAndSet(arg); } catch(e) {}
            }, 1);
          }
        }
      }
      return originalPush.apply(this, args);
    };

    // Scan already loaded chunks asynchronously
    if (!queryIdDiscovered) {
      const scanLoaded = () => {
        try {
          const chunks = window.webpackChunk_twitter_responsive_web;
          for (const chunk of chunks) {
            if (chunk && chunk[1]) {
              const qId = scanWebpackSource(chunk[1]);
              if (qId) {
                activeQueryId = qId;
                queryIdDiscovered = true;
                sendToContent('__queryIdDiscovered', { queryId: activeQueryId });
                break;
              }
            }
          }
        } catch (e) {}
      };
      
      if (window.requestIdleCallback) window.requestIdleCallback(scanLoaded);
      else setTimeout(scanLoaded, 1);
    }
  }

  // Start intercepting and scanning Webpack chunks immediately
  setupWebpackInterceptor();

  // --- Passive Data Snooping ---
  
  // Skip keys known to never contain user objects — saves CPU on deep traversal
  const SKIP_KEYS = new Set(['instructions', 'globalObjects', 'promoted_content', 'card', 'media', 'entities', 'extended_entities', 'features', 'mediaStats', 'birdwatch_pivot', 'tombstone']);
  // Iteratively find user objects in arbitrary JSON (Timeline data) using a stack
  function extractUsersFromResponse(data) {
    const usersFound = new Map();
    if (!data || typeof data !== 'object') return usersFound;

    const stack = [data];
    
    while (stack.length > 0) {
      const current = stack.pop();
      if (!current || typeof current !== 'object') continue;

      // Check if this object looks like a User result
      if (current.screen_name && (current.location || current.verified || current.is_blue_verified || current.about_profile)) {
        if (!usersFound.has(current.screen_name)) {
          const profile = current.about_profile;
          usersFound.set(current.screen_name, {
            screen_name: current.screen_name,
            location: profile?.account_based_in || current.location || current.legacy?.location || null,
            verified: !!(current.verified || current.is_blue_verified || current.legacy?.verified || current.legacy?.verified_type || current.verification_info?.is_identity_verified),
            utc_offset: current.utc_offset ?? current.legacy?.utc_offset ?? null,
            time_zone: current.time_zone ?? current.legacy?.time_zone ?? null,
            is_region: profile?.location_accurate === false
          });
        }
      }
      // Also check legacy format
      if (current.legacy && current.legacy.screen_name) {
        const u = current.legacy;
        if (!usersFound.has(u.screen_name)) {
          // Legacy objects usually don't have about_profile, but checking just in case
          const profile = current.about_profile;
          usersFound.set(u.screen_name, {
            screen_name: u.screen_name,
            location: profile?.account_based_in || u.location || null,
            verified: !!(u.verified || current.is_blue_verified || u.verified_type || current.verification_info?.is_identity_verified),
            utc_offset: u.utc_offset ?? current.utc_offset ?? null,
            time_zone: u.time_zone ?? current.time_zone ?? null,
            is_region: profile?.location_accurate === false
          });
        }
      }

      // Traverse arrays and objects
      if (Array.isArray(current)) {
        for (let i = 0; i < current.length; i++) {
          stack.push(current[i]);
        }
      } else {
        for (const key in current) {
          const val = current[key];
          if (val && typeof val === 'object') {
            if (SKIP_KEYS.has(key)) {
              // Special handler for globalObjects.users
              if (key === 'globalObjects' && val.users) {
                stack.push(val.users);
              }
              continue;
            }
            stack.push(val);
          }
        }
      }
    }
    return usersFound;
  }

  function broadcastPassiveData(data) {
    if (!data) return;
    // Use requestIdleCallback to not block the main Twitter UI thread
    if (window.requestIdleCallback) {
      window.requestIdleCallback(() => {
        const users = Array.from(extractUsersFromResponse(data).values());
        if (users.length > 0) {
          sendToContent('__passiveData', { users });
        }
      });
    } else {
      setTimeout(() => {
        const users = Array.from(extractUsersFromResponse(data).values());
        if (users.length > 0) sendToContent('__passiveData', { users });
      }, 500);
    }
  }

  // --- Helpers ---

  // Discover the AboutAccountQuery ID by scanning Twitter's loaded JS bundles
  async function discoverQueryId() {
    if (queryIdDiscovered && activeQueryId) return activeQueryId;
    
    // Method 1: Scan inline script contents (does not make network requests, completely CSP-safe)
    const scripts = document.querySelectorAll('script');
    for (const script of scripts) {
      if (script.src) continue; // Skip external scripts
      try {
        const text = script.textContent;
        if (text && text.includes('AboutAccountQuery')) {
          const qId = extractQueryIdFromString(text);
          if (qId) {
            activeQueryId = qId;
            queryIdDiscovered = true;
            sendToContent('__queryIdDiscovered', { queryId: activeQueryId });
            return activeQueryId;
          }
        }
      } catch (e) {}
    }
    
    // Method 2: Fallback — try known recent IDs
    const fallbackIds = ['XRqGa7EeokUU5kppkh13EA', 'GsbGOVoqyItTRx7Cr4owgQ'];
    for (const id of fallbackIds) {
      try {
        const testUrl = `${window.location.origin}/i/api/graphql/${id}/AboutAccountQuery?variables=${encodeURIComponent(JSON.stringify({screenName: "x"}))}`;
        const resp = await fetchWithTimeout(testUrl, {
          method: 'GET',
          credentials: 'include',
          headers: twitterHeaders || { 'Accept': 'application/json' },
          referrerPolicy: 'origin-when-cross-origin'
        }, 5000);
        // 400 = wrong query ID, 403/404 = wrong user but valid ID
        if (resp.status !== 400) {
          activeQueryId = id;
          queryIdDiscovered = true;
          return activeQueryId;
        }
      } catch (e) {}
    }
    
    // Last resort fallback
    activeQueryId = fallbackIds[0];
    return activeQueryId;
  }

  function sniffQueryId(url) {
    if (typeof url !== 'string') return;
    
    // Only capture query IDs from AboutAccountQuery endpoints specifically
    if (url.includes('/graphql/') && url.includes('AboutAccount')) {
      const match = url.match(/\/graphql\/([a-zA-Z0-9_-]+)\//);
      if (match && match[1] && match[1] !== activeQueryId) {
        activeQueryId = match[1];
        queryIdDiscovered = true;
        sendToContent('__queryIdDiscovered', { queryId: activeQueryId });
      }
    }
  }

  function captureHeaders(headers) {
    if (!headers) return;
    const headerObj = {};
    
    if (headers instanceof Headers) {
      headers.forEach((val, key) => headerObj[key] = val);
    } else if (typeof headers === 'object') {
      Object.assign(headerObj, headers);
    }
    
    // Sniff Bearer token from Twitter's own API calls
    const auth = headerObj['authorization'] || headerObj['Authorization'];
    if (auth && auth.startsWith('Bearer ') && !discoveredBearerToken) {
      discoveredBearerToken = auth;
    }
    
    // Sanitize headers to prevent credential leakage (delete cookies & session IDs)
    const sensitive = ['cookie', 'cookie2', 'authorization-x', 'x-client-uuid'];
    for (const key of Object.keys(headerObj)) {
      if (sensitive.includes(key.toLowerCase())) {
        delete headerObj[key];
      }
    }
    
    twitterHeaders = headerObj;
    headersReady = true;
    if (headersPromiseResolver) {
      headersPromiseResolver();
      headersPromiseResolver = null;
    }
  }

  function sendToContent(type, payload = {}) {
    window.postMessage({ target: 'contentScript', type, ...payload }, window.location.origin);
  }

  async function fetchWithTimeout(url, options = {}, timeout = 6000) {
    return originalFetch(url, { ...options, signal: AbortSignal.timeout(timeout) });
  }

  // --- Interceptors ---

  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const [url, options] = args;
    sniffQueryId(url);
    if (typeof url === 'string' && url.includes('/i/api/graphql')) {
      if (options?.headers) captureHeaders(options.headers);
      
      // SNOOP: Intercept the response to find users
      try {
        const response = await originalFetch.apply(this, args);
        const clone = response.clone();
        clone.json().then(data => broadcastPassiveData(data)).catch(() => {});
        return response;
      } catch(e) {
        return originalFetch.apply(this, args);
      }
    }
    return originalFetch.apply(this, args);
  };

  const originalXHROpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this._url = url;
    sniffQueryId(url);
    this.addEventListener('load', () => {
      if (this._url && (this._url.includes('/i/api/graphql') || this._url.includes('/1.1/')) && this.responseText) {
        try {
          const data = JSON.parse(this.responseText);
          broadcastPassiveData(data);
        } catch(e) {}
      }
    });
    return originalXHROpen.apply(this, [method, url, ...rest]);
  };

  const originalXHRSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function(...args) {
    if (this._url?.includes('/i/api/graphql') && this._headers) {
      captureHeaders(this._headers);
    }
    return originalXHRSend.apply(this, args);
  };

  const originalSetHeader = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.setRequestHeader = function(header, value) {
    if (!this._headers) this._headers = {};
    this._headers[header] = value;
    return originalSetHeader.apply(this, [header, value]);
  };

  // --- Fallback & Initialization ---

  // Try cookie-based auth immediately (was 3000ms delay)
  setTimeout(() => {
    if (headersReady) return;

    const getCookie = (name) => {
      const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
      return match ? match[2] : null;
    };

    const csrfToken = getCookie('ct0');
    if (csrfToken) {
      twitterHeaders = {
        'authorization': discoveredBearerToken || FALLBACK_BEARER,
        'x-csrf-token': csrfToken,
        'x-twitter-active-user': 'yes',
        'x-twitter-auth-type': 'OAuth2Session',
        'x-twitter-client-language': 'en',
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      };
      headersReady = true;
      if (headersPromiseResolver) {
        headersPromiseResolver();
        headersPromiseResolver = null;
      }
    }
  }, 500);

  // --- Message Listener ---

  window.addEventListener('message', async (event) => {
    if (event.source !== window || event.data?.target !== 'pageScript') return;

    if (event.data.type === '__setCachedQueryId') {
      const { queryId } = event.data;
      if (queryId && !queryIdDiscovered) {
        activeQueryId = queryId;
        queryIdDiscovered = true;
      }
      return;
    }

    // Handle user data fetch (location + verified status)
    if (event.data.type === '__fetchUserData') {
      const { screenName, requestId } = event.data;

      // Wait for headers
      if (!headersReady) {
        await Promise.race([
          headersPromise,
          new Promise(r => setTimeout(r, 3000))
        ]);
      }
      
      // Ensure we have a valid query ID
      await discoverQueryId();

      try {
        const variables = encodeURIComponent(JSON.stringify({ screenName }));
        const baseUrl = window.location.origin;
        let url = `${baseUrl}/i/api/graphql/${activeQueryId}/AboutAccountQuery?variables=${variables}`;
        
        let response = await fetchWithTimeout(url, {
          method: 'GET',
          credentials: 'include',
          headers: twitterHeaders || { 'Accept': 'application/json' },
          referrerPolicy: 'origin-when-cross-origin'
        }, 5000);

        // If 400, the query ID is stale — re-discover and retry once
        if (response.status === 400 && queryIdDiscovered) {
          queryIdDiscovered = false;
          activeQueryId = null;
          await discoverQueryId();
          url = `${baseUrl}/i/api/graphql/${activeQueryId}/AboutAccountQuery?variables=${variables}`;
          response = await fetchWithTimeout(url, {
            method: 'GET',
            credentials: 'include',
            headers: twitterHeaders || { 'Accept': 'application/json' },
            referrerPolicy: 'origin-when-cross-origin'
          }, 5000);
        }

        if (response.ok) {
          const data = await response.json();
          // Also feed this specific lookup back into the passive system
          broadcastPassiveData(data);
          const userResult = data?.data?.user_result_by_screen_name?.result;
          const location = userResult?.about_profile?.account_based_in || null;
          const is_region = userResult?.about_profile?.location_accurate === false;
          // Check multiple verified fields - Twitter may use different ones
          const verified = userResult?.is_blue_verified === true || 
                           userResult?.verified === true ||
                           userResult?.legacy?.verified === true ||
                           userResult?.legacy?.is_blue_verified === true;
          sendToContent('__userDataResponse', { screenName, location, verified, is_region, requestId });
        } else {
          if (response.status === 429) {
            const reset = response.headers.get('x-rate-limit-reset');
            if (reset) {
              const waitTime = Math.max(0, (parseInt(reset) * 1000) - Date.now());
              sendToContent('__rateLimitInfo', { resetTime: parseInt(reset), waitTime });
            }
          }
          sendToContent('__userDataResponse', { screenName, location: null, verified: false, requestId, isRateLimited: response.status === 429 });
        }
      } catch (error) {
        sendToContent('__userDataResponse', { screenName, location: null, verified: false, requestId });
      }
    }

    // Handle block user request
    if (event.data.type === '__blockUser') {
      const { screenName } = event.data;

      // Wait for headers
      if (!headersReady) {
        await Promise.race([
          headersPromise,
          new Promise(r => setTimeout(r, 3000))
        ]);
      }

      try {
        const url = `https://api.x.com/1.1/blocks/create.json?screen_name=${encodeURIComponent(screenName)}`;
        
        await originalFetch(url, {
          method: 'POST',
          credentials: 'include',
          headers: twitterHeaders || { 'Accept': 'application/json' },
          referrerPolicy: 'origin-when-cross-origin'
        });
        
        // Block is fire-and-forget
      } catch (error) {
        // Block is fire-and-forget
      }
    }
  });
})();