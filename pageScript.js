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
    console.log('Captured Twitter API headers:', Object.keys(headerObj));
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
        console.log('Captured Twitter headers:', Object.keys(twitterHeaders || {}));
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
      console.log('No Twitter headers captured yet, using defaults');
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
        let isVPN = false;

        if (response.ok) {
          const data = await response.json();
          console.log(`API response for ${screenName}:`, data);
          location = data?.data?.user_result_by_screen_name?.result?.about_profile?.account_based_in || null;

          // VPN Detection (basic heuristics - can be enhanced with external API)
          const userResult = data?.data?.user_result_by_screen_name?.result;
          if (userResult && location) {
            // Check for VPN indicators in the API response
            // Note: Twitter's API doesn't directly provide VPN info, so this is heuristic

            // Possible indicators (these are experimental and may not be reliable):
            // 1. Check if user has suspicious location patterns
            // 2. Check for location/IP mismatches (would need IP data)
            // 3. Look for other metadata inconsistencies

            // For now, we'll use a placeholder that can be enhanced later
            // You can add external VPN detection API calls here if needed

            // Example: Check if there's a mismatch indicator in the data
            // (Twitter might add such fields in the future)
            isVPN = userResult?.is_vpn_user || false;

            // TODO: For production use, integrate with VPN detection APIs like:
            // - IPQualityScore (ipqualityscore.com)
            // - IPHub (iphub.info)
            // - ProxyCheck (proxycheck.io)
            // These would require the user's IP address and API keys
          }

          console.log(`Extracted location for ${screenName}:`, location, isVPN ? '⚠️ VPN detected' : '');

          // Debug: log the full path to see what's available
          if (!location && userResult) {
            console.log('User result available but no location:', {
              hasAboutProfile: !!userResult.about_profile,
              aboutProfile: userResult.about_profile
            });
          }
        } else {
          const errorText = await response.text().catch(() => '');
          
          // Handle rate limiting
          if (response.status === 429) {
            const resetTime = response.headers.get('x-rate-limit-reset');
            const remaining = response.headers.get('x-rate-limit-remaining');
            const limit = response.headers.get('x-rate-limit-limit');
            
            if (resetTime) {
              const resetDate = new Date(parseInt(resetTime) * 1000);
              const now = Date.now();
              const waitTime = resetDate.getTime() - now;
              
              console.log(`Rate limited! Limit: ${limit}, Remaining: ${remaining}`);
              console.log(`Rate limit resets at: ${resetDate.toLocaleString()}`);
              console.log(`Waiting ${Math.ceil(waitTime / 1000 / 60)} minutes before retrying...`);

              // Store rate limit info for content script
              window.postMessage({
                type: '__rateLimitInfo',
                resetTime: parseInt(resetTime),
                waitTime: Math.max(0, waitTime),
                remaining: parseInt(remaining) || 0,
                limit: parseInt(limit) || 50
              }, '*');
            }
          } else {
            console.log(`Twitter API error for ${screenName}:`, response.status, response.statusText, errorText.substring(0, 200));
          }
        }
        
        // Send response back to content script via postMessage
        // Include error status so content script knows not to cache on rate limit
        window.postMessage({
          type: '__locationResponse',
          screenName,
          location,
          isVPN,
          requestId,
          isRateLimited: response.status === 429
        }, '*');
      } catch (error) {
        console.error('Error fetching location:', error);
        window.postMessage({
          type: '__locationResponse',
          screenName,
          location: null,
          isVPN: false,
          requestId
        }, '*');
      }
    }
  });
})();

