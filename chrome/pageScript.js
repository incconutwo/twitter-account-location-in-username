(function() {
  // State
  let twitterHeaders = null;
  let headersReady = false;
  let activeQueryId = 'XRqGa7EeokUU5kppkh13EA'; // Default/Fallback ID

  // --- Helpers ---

  function sniffQueryId(url) {
    if (typeof url !== 'string') return;
    const match = url.match(/\/graphql\/([a-zA-Z0-9_-]+)\/AboutAccountQuery/);
    if (match && match[1]) activeQueryId = match[1];
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
  window.fetch = function(...args) {
    const [url, options] = args;
    sniffQueryId(url);
    if (typeof url === 'string' && url.includes('/i/api/graphql') && options?.headers) {
      captureHeaders(options.headers);
    }
    return originalFetch.apply(this, args);
  };

  const originalXHROpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this._url = url;
    sniffQueryId(url);
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
  }, 3000);

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

      try {
        const variables = encodeURIComponent(JSON.stringify({ screenName }));
        const baseUrl = window.location.origin;
        const url = `${baseUrl}/i/api/graphql/${activeQueryId}/AboutAccountQuery?variables=${variables}`;
        
        const response = await originalFetch(url, {
          method: 'GET',
          credentials: 'include',
          headers: twitterHeaders || { 'Accept': 'application/json' },
          referrerPolicy: 'origin-when-cross-origin'
        });

        if (response.ok) {
          const data = await response.json();
          const userResult = data?.data?.user_result_by_screen_name?.result;
          const location = userResult?.about_profile?.account_based_in || null;
          // Check multiple verified fields - Twitter may use different ones
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
        
        // We don't need to send a response, the block is fire-and-forget
        console.log(`[Twitter Flags] Blocked user: @${screenName}`);
      } catch (error) {
        console.error(`[Twitter Flags] Failed to block user: @${screenName}`, error);
      }
    }

    // Legacy handler for backwards compatibility
    if (event.data.type === '__fetchLocation') {
      const { screenName, requestId } = event.data;

      let attempts = 0;
      while (!headersReady && attempts < 30) {
        await new Promise(r => setTimeout(r, 100));
        attempts++;
      }

      try {
        const variables = encodeURIComponent(JSON.stringify({ screenName }));
        const baseUrl = window.location.origin;
        const url = `${baseUrl}/i/api/graphql/${activeQueryId}/AboutAccountQuery?variables=${variables}`;
        
        const response = await originalFetch(url, {
          method: 'GET',
          credentials: 'include',
          headers: twitterHeaders || { 'Accept': 'application/json' },
          referrerPolicy: 'origin-when-cross-origin'
        });

        if (response.ok) {
          const data = await response.json();
          const location = data?.data?.user_result_by_screen_name?.result?.about_profile?.account_based_in || null;
          sendToContent('__locationResponse', { screenName, location, requestId });
        } else {
          if (response.status === 429) {
            const reset = response.headers.get('x-rate-limit-reset');
            if (reset) {
              const waitTime = Math.max(0, (parseInt(reset) * 1000) - Date.now());
              sendToContent('__rateLimitInfo', { resetTime: parseInt(reset), waitTime });
            }
          }
          sendToContent('__locationResponse', { screenName, location: null, requestId, isRateLimited: response.status === 429 });
        }
      } catch (error) {
        sendToContent('__locationResponse', { screenName, location: null, requestId });
      }
    }
  });
})();