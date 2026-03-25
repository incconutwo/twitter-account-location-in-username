(function() {
  // State
  let twitterHeaders = null;
  let headersReady = false;
  let activeQueryId = null; // Discovered dynamically
  let queryIdDiscovered = false;

  // --- Passive Data Snooping ---
  
  // Recursively find user objects in arbitrary JSON (Timeline data)
  function extractUsersFromResponse(data, usersFound = new Map()) {
    if (!data || typeof data !== 'object') return;

    // Check if this object looks like a User result
    if (data.screen_name && (data.location || data.verified || data.is_blue_verified)) {
      if (!usersFound.has(data.screen_name)) {
        usersFound.set(data.screen_name, {
          screen_name: data.screen_name,
          location: data.location || data.legacy?.location || null,
          verified: !!(data.verified || data.is_blue_verified || data.legacy?.verified)
        });
      }
    }
    // Also check legacy format
    if (data.legacy && data.legacy.screen_name) {
      const u = data.legacy;
      if (!usersFound.has(u.screen_name)) {
        usersFound.set(u.screen_name, {
          screen_name: u.screen_name,
          location: u.location || null,
          verified: !!(u.verified || data.is_blue_verified)
        });
      }
    }

    // Traverse arrays and objects
    if (Array.isArray(data)) {
      for (const item of data) extractUsersFromResponse(item, usersFound);
    } else {
      for (const key in data) {
        // Optimization: Skip large non-user fields to save CPU
        if (key !== 'instructions' && key !== 'globalObjects' && typeof data[key] === 'object') {
          extractUsersFromResponse(data[key], usersFound);
        }
        // Specific handlers for known structures
        if (key === 'globalObjects' && data.globalObjects.users) {
          Object.values(data.globalObjects.users).forEach(u => extractUsersFromResponse(u, usersFound));
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
    
    // Method 1: Scan inline and loaded scripts on the page
    const scripts = document.querySelectorAll('script[src]');
    for (const script of scripts) {
      try {
        if (!script.src.includes('/client-web/') && !script.src.includes('main.')) continue;
        const resp = await fetch(script.src, { credentials: 'omit' });
        if (!resp.ok) continue;
        const text = await resp.text();
        // Twitter bundles map query names to IDs like: {queryId:"abc123",operationName:"AboutAccountQuery",...}
        const patterns = [
          /queryId:"([a-zA-Z0-9_-]+)",operationName:"AboutAccountQuery"/,
          /operationName:"AboutAccountQuery",.*?queryId:"([a-zA-Z0-9_-]+)"/,
          /"AboutAccountQuery".*?queryId:"([a-zA-Z0-9_-]+)"/,
          /queryId:"([a-zA-Z0-9_-]+)".*?"AboutAccountQuery"/
        ];
        for (const pattern of patterns) {
          const match = text.match(pattern);
          if (match && match[1]) {
            activeQueryId = match[1];
            queryIdDiscovered = true;
            return activeQueryId;
          }
        }
      } catch (e) {
        // Skip inaccessible scripts
      }
    }
    
    // Method 2: Fallback — try known recent IDs
    const fallbackIds = ['XRqGa7EeokUU5kppkh13EA', 'GsbGOVoqyItTRx7Cr4owgQ'];
    for (const id of fallbackIds) {
      try {
        const testUrl = `${window.location.origin}/i/api/graphql/${id}/AboutAccountQuery?variables=${encodeURIComponent(JSON.stringify({screenName: "x"}))}`;
        const resp = await fetch(testUrl, {
          method: 'GET',
          credentials: 'include',
          headers: twitterHeaders || { 'Accept': 'application/json' },
          referrerPolicy: 'origin-when-cross-origin'
        });
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
      if (match && match[1]) {
        activeQueryId = match[1];
        queryIdDiscovered = true;
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
    
    twitterHeaders = headerObj;
    headersReady = true;
  }

  function sendToContent(type, payload = {}) {
    window.postMessage({ target: 'contentScript', type, ...payload }, '*');
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
        'authorization': 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA',
        'x-csrf-token': csrfToken,
        'x-twitter-active-user': 'yes',
        'x-twitter-auth-type': 'OAuth2Session',
        'x-twitter-client-language': 'en',
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      };
      headersReady = true;
    }
  }, 500);

  // --- Message Listener ---

  window.addEventListener('message', async (event) => {
    if (event.source !== window || event.data?.target !== 'pageScript') return;

    // Handle user data fetch (location + verified status)
    if (event.data.type === '__fetchUserData') {
      const { screenName, requestId } = event.data;

      // Wait for headers
      let attempts = 0;
      while (!headersReady && attempts < 30) {
        await new Promise(r => setTimeout(r, 100));
        attempts++;
      }
      
      // Ensure we have a valid query ID
      await discoverQueryId();

      try {
        const variables = encodeURIComponent(JSON.stringify({ screenName }));
        const baseUrl = window.location.origin;
        let url = `${baseUrl}/i/api/graphql/${activeQueryId}/AboutAccountQuery?variables=${variables}`;
        
        let response = await originalFetch(url, {
          method: 'GET',
          credentials: 'include',
          headers: twitterHeaders || { 'Accept': 'application/json' },
          referrerPolicy: 'origin-when-cross-origin'
        });

        // If 400, the query ID is stale — re-discover and retry once
        if (response.status === 400 && queryIdDiscovered) {
          queryIdDiscovered = false;
          activeQueryId = null;
          await discoverQueryId();
          url = `${baseUrl}/i/api/graphql/${activeQueryId}/AboutAccountQuery?variables=${variables}`;
          response = await originalFetch(url, {
            method: 'GET',
            credentials: 'include',
            headers: twitterHeaders || { 'Accept': 'application/json' },
            referrerPolicy: 'origin-when-cross-origin'
          });
        }

        if (response.ok) {
          const data = await response.json();
          // Also feed this specific lookup back into the passive system
          broadcastPassiveData(data);
          const userResult = data?.data?.user_result_by_screen_name?.result;
          const location = userResult?.about_profile?.account_based_in || null;
          const verified = userResult?.is_blue_verified === true || 
                           userResult?.verified === true ||
                           userResult?.legacy?.verified === true ||
                           userResult?.legacy?.is_blue_verified === true;
          sendToContent('__userDataResponse', { screenName, location, verified, requestId });
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
      let attempts = 0;
      while (!headersReady && attempts < 30) {
        await new Promise(r => setTimeout(r, 100));
        attempts++;
      }

      try {
        const url = `https://api.x.com/1.1/blocks/create.json?screen_name=${encodeURIComponent(screenName)}`;
        
        await originalFetch(url, {
          method: 'POST',
          credentials: 'include',
          headers: twitterHeaders || { 'Accept': 'application/json' },
          referrerPolicy: 'origin-when-cross-origin'
        });
      } catch (error) {
        // Block is fire-and-forget
      }
    }
  });
})();