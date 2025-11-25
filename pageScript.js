// This script runs in the page context to access cookies and make API calls
(function() {
  // Store headers from Twitter's own API calls
  let twitterHeaders = null;
  let headersReady = false;
  
  // Function to capture headers from a request
  function captureHeaders(headers) {
    if (!headers) return;
    
    const headerObj = {};
    if (headers instanceof Headers) {
      headers.forEach((value, key) => {
        headerObj[key] = value;
      });
    } else if (headers instanceof Object) {
      // Copy all headers
      for (const [key, value] of Object.entries(headers)) {
        headerObj[key] = value;
      }
    }
    
    // Replace headers completely (don't merge) to ensure we get auth tokens
    twitterHeaders = headerObj;
    headersReady = true;
  }
  
  // Intercept fetch to capture Twitter's headers
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    const url = args[0];
    const options = args[1] || {};
    
    // If it's a Twitter GraphQL API call, capture ALL headers
    if (typeof url === 'string' && url.includes('x.com/i/api/graphql')) {
      if (options.headers) {
        captureHeaders(options.headers);
      }
    }
    
    return originalFetch.apply(this, args);
  };
  
  // Also intercept XMLHttpRequest
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;
  
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this._url = url;
    return originalXHROpen.apply(this, [method, url, ...rest]);
  };
  
  XMLHttpRequest.prototype.send = function(...args) {
    if (this._url && this._url.includes('x.com/i/api/graphql')) {
      const headers = {};
      // Try to get headers from setRequestHeader
      if (this._headers) {
        Object.assign(headers, this._headers);
      }
      captureHeaders(headers);
    }
    return originalXHRSend.apply(this, args);
  };
  
  const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.setRequestHeader = function(header, value) {
    if (!this._headers) this._headers = {};
    this._headers[header] = value;
    return originalSetRequestHeader.apply(this, [header, value]);
  };
  
  // Wait a bit for Twitter to make some API calls first
  setTimeout(() => {
    if (!headersReady) {
      twitterHeaders = {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      };
      headersReady = true;
    }
  }, 3000);
  
  // Listen for fetch requests from content script via postMessage
  window.addEventListener('message', async function(event) {
    // Only accept messages from our extension
    if (event.data && event.data.type === '__fetchLocation') {
      const { screenName, requestId } = event.data;
      
      // Wait for headers to be ready
      if (!headersReady) {
        let waitCount = 0;
        while (!headersReady && waitCount < 30) {
          await new Promise(resolve => setTimeout(resolve, 100));
          waitCount++;
        }
      }
      
      try {
        const variables = JSON.stringify({ screenName });
        const url = `https://x.com/i/api/graphql/XRqGa7EeokUU5kppkh13EA/AboutAccountQuery?variables=${encodeURIComponent(variables)}`;
        
        // Use captured headers or minimal defaults
        const headers = twitterHeaders || {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        };
        
        // Ensure credentials are included
        const response = await fetch(url, {
          method: 'GET',
          credentials: 'include',
          headers: headers,
          referrer: window.location.href,
          referrerPolicy: 'origin-when-cross-origin'
        });
        
        let location = null;
        if (response.ok) {
          const data = await response.json();
          location = data?.data?.user_result_by_screen_name?.result?.about_profile?.account_based_in || null;
          
        } else {
          // Handle rate limiting
          if (response.status === 429) {
            const resetTime = response.headers.get('x-rate-limit-reset');
            
            if (resetTime) {
              const resetDate = new Date(parseInt(resetTime) * 1000);
              const now = Date.now();
              const waitTime = resetDate.getTime() - now;
              
              // Store rate limit info for content script
              window.postMessage({
                type: '__rateLimitInfo',
                resetTime: parseInt(resetTime),
                waitTime: Math.max(0, waitTime)
              }, '*');
            }
          }
        }
        
        // Send response back to content script via postMessage
        // Include error status so content script knows not to cache on rate limit
        window.postMessage({
          type: '__locationResponse',
          screenName,
          location,
          requestId,
          isRateLimited: response.status === 429
        }, '*');
      } catch (error) {
        window.postMessage({
          type: '__locationResponse',
          screenName,
          location: null,
          requestId
        }, '*');
      }
    }
  });
})();