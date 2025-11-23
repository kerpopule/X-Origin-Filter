// Cache for user locations - persistent storage
let locationCache = new Map();
const CACHE_KEY = 'twitter_location_cache';
const CACHE_EXPIRY_DAYS = 30; // Cache for 30 days (for valid locations)
const NULL_CACHE_HOURS = 24; // Cache null results for 24 hours only

// Rate Limit Tracker Class
class RateLimitTracker {
  constructor() {
    this.requests = []; // Array of request timestamps
    this.maxRequests = 40; // Leave 10 buffer (Twitter limit is 50/15min)
    this.windowMs = 15 * 60 * 1000; // 15 minutes in milliseconds

    // Twitter's actual rate limit status (from 429 responses)
    this.twitterResetTime = null; // Unix timestamp (seconds) when Twitter's limit resets
    this.twitterLimit = 50; // Twitter's actual limit
    this.twitterRemaining = null; // Remaining requests according to Twitter
  }

  // Clean up old requests outside the window
  cleanup() {
    const cutoff = Date.now() - this.windowMs;
    this.requests = this.requests.filter(timestamp => timestamp > cutoff);

    // Check if Twitter's rate limit has expired
    if (this.twitterResetTime) {
      const now = Math.floor(Date.now() / 1000);
      if (now >= this.twitterResetTime) {
        // Rate limit expired, clear Twitter status
        console.log('✅ Twitter rate limit has reset');
        this.twitterResetTime = null;
        this.twitterRemaining = null;
      }
    }
  }

  // Set rate limit info from Twitter's 429 response
  setTwitterRateLimit(resetTime, remaining = 0, limit = 50) {
    this.twitterResetTime = resetTime; // Unix timestamp in seconds
    this.twitterRemaining = remaining;
    this.twitterLimit = limit;

    const resetDate = new Date(resetTime * 1000);
    const minutesUntil = Math.ceil((resetTime * 1000 - Date.now()) / 60000);
    console.log(`🚨 Twitter rate limit: ${limit - remaining}/${limit} used, resets at ${resetDate.toLocaleTimeString()} (in ${minutesUntil} min)`);
  }

  // Check if we can make a new request
  canMakeRequest() {
    this.cleanup();

    // If we know Twitter's actual status, use that
    if (this.twitterResetTime) {
      const now = Math.floor(Date.now() / 1000);
      if (now < this.twitterResetTime) {
        // Still rate limited by Twitter
        return false;
      }
    }

    // Otherwise use our local tracking
    return this.requests.length < this.maxRequests;
  }

  // Record a new request
  addRequest() {
    const now = Date.now();
    this.requests.push(now);
    this.cleanup();
    console.log(`📊 Rate limit: ${this.requests.length}/${this.maxRequests} requests used`);
  }

  // Get current status
  getStatus() {
    this.cleanup();

    // If we have Twitter's actual rate limit status, use that
    if (this.twitterResetTime) {
      const now = Math.floor(Date.now() / 1000);
      if (now < this.twitterResetTime) {
        const used = this.twitterLimit - (this.twitterRemaining || 0);
        return {
          used: Math.min(used, this.maxRequests), // Cap at our display max (40)
          max: this.maxRequests,
          resetTime: this.twitterResetTime * 1000, // Convert to milliseconds
          isTwitterLimit: true
        };
      }
    }

    // Otherwise return our local tracking
    return {
      used: this.requests.length,
      max: this.maxRequests,
      resetTime: this.getResetTime(),
      isTwitterLimit: false
    };
  }

  // Get time when oldest request will expire
  getResetTime() {
    if (this.requests.length === 0) return null;
    const oldest = Math.min(...this.requests);
    return oldest + this.windowMs;
  }

  // Get minutes until reset
  getMinutesUntilReset() {
    const status = this.getStatus();
    const resetTime = status.resetTime;
    if (!resetTime) return 0;
    return Math.ceil((resetTime - Date.now()) / 60000);
  }
}

// Create global rate limit tracker
const rateLimitTracker = new RateLimitTracker();

// Rate limiting
const requestQueue = [];
let isProcessingQueue = false;
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 2000; // 2 seconds between requests (increased to avoid rate limits)
const MAX_CONCURRENT_REQUESTS = 2; // Reduced concurrent requests
let activeRequests = 0;
let rateLimitResetTime = 0; // Unix timestamp when rate limit resets

// Observer for dynamically loaded content
let observer = null;
let viewportObserver = null; // Intersection Observer for viewport detection

// Extension enabled state
let extensionEnabled = true;
const TOGGLE_KEY = 'extension_enabled';
const DEFAULT_ENABLED = true;

// Country filter state
let countryFilterEnabled = false;
let selectedCountries = new Set();
const FILTER_ENABLED_KEY = 'country_filter_enabled';
const SELECTED_COUNTRIES_KEY = 'selected_countries';
const DEFAULT_FILTER_ENABLED = false;

// Loading mode state
let loadingMode = 'balanced'; // 'aggressive', 'balanced', or 'conservative'
const LOADING_MODE_KEY = 'loading_mode';
const DEFAULT_LOADING_MODE = 'balanced';

// Track usernames currently being processed to avoid duplicate requests
const processingUsernames = new Set();

// Load enabled state and filter settings
async function loadEnabledState() {
  try {
    const result = await chrome.storage.local.get([TOGGLE_KEY, FILTER_ENABLED_KEY, SELECTED_COUNTRIES_KEY, LOADING_MODE_KEY]);
    extensionEnabled = result[TOGGLE_KEY] !== undefined ? result[TOGGLE_KEY] : DEFAULT_ENABLED;
    countryFilterEnabled = result[FILTER_ENABLED_KEY] !== undefined ? result[FILTER_ENABLED_KEY] : DEFAULT_FILTER_ENABLED;
    loadingMode = result[LOADING_MODE_KEY] || DEFAULT_LOADING_MODE;

    // Load selected countries
    const allCountries = [...new Set(Object.keys(COUNTRY_FLAGS))];
    const savedCountries = result[SELECTED_COUNTRIES_KEY] || allCountries;
    selectedCountries = new Set(savedCountries);

    console.log('Extension enabled:', extensionEnabled);
    console.log('Country filter enabled:', countryFilterEnabled);
    console.log('Selected countries:', selectedCountries.size);
    console.log('Loading mode:', loadingMode);
  } catch (error) {
    console.error('Error loading enabled state:', error);
    extensionEnabled = DEFAULT_ENABLED;
    countryFilterEnabled = DEFAULT_FILTER_ENABLED;
    loadingMode = DEFAULT_LOADING_MODE;
    selectedCountries = new Set(Object.keys(COUNTRY_FLAGS));
  }
}

// Listen for toggle changes from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'extensionToggle') {
    extensionEnabled = request.enabled;
    console.log('Extension toggled:', extensionEnabled);

    if (extensionEnabled) {
      // Re-initialize if enabled
      setTimeout(() => {
        processUsernames();
      }, 500);
    } else {
      // Remove all flags if disabled
      removeAllFlags();
    }
  } else if (request.type === 'getRateLimitStatus') {
    // Return rate limit status to popup
    const status = rateLimitTracker.getStatus();
    sendResponse(status);
    return true; // Keep message channel open for async response
  } else if (request.type === 'loadingModeChange') {
    loadingMode = request.mode;
    console.log('⚙️  Loading mode changed to:', loadingMode);
    // Reinitialize based on new mode
    if (loadingMode === 'balanced' && !viewportObserver) {
      initViewportObserver();
    }
  } else if (request.type === 'settingsUpdate') {
    // Handle settings update from popup
    const oldFilterEnabled = countryFilterEnabled;
    const oldSelectedCountriesArray = Array.from(selectedCountries).sort();

    extensionEnabled = request.extensionEnabled;
    countryFilterEnabled = request.filterEnabled;
    selectedCountries = new Set(request.selectedCountries);

    console.log('⚙️  Settings updated:', {
      extensionEnabled,
      countryFilterEnabled,
      selectedCountries: Array.from(selectedCountries)
    });

    // Check if selected countries actually changed (not just the count)
    const newSelectedCountriesArray = Array.from(selectedCountries).sort();
    const selectionChanged = JSON.stringify(oldSelectedCountriesArray) !== JSON.stringify(newSelectedCountriesArray);

    // If filter settings changed, reload the page to apply filtering cleanly
    if (countryFilterEnabled && (oldFilterEnabled !== countryFilterEnabled || selectionChanged)) {
      console.log('🔄 Filter settings changed, reloading page...');
      setTimeout(() => {
        location.reload();
      }, 500);
    } else {
      // Just apply filtering to current posts
      applyFilterToAllPosts();
    }
  }
});

// Load cache from persistent storage
async function loadCache() {
  try {
    // Check if extension context is still valid
    if (!chrome.runtime?.id) {
      console.log('Extension context invalidated, skipping cache load');
      return;
    }

    const result = await chrome.storage.local.get(CACHE_KEY);
    if (result[CACHE_KEY]) {
      const cached = result[CACHE_KEY];
      const now = Date.now();

      let validCount = 0;
      let nullCount = 0;
      let expiredCount = 0;

      // Load all non-expired entries (including nulls)
      for (const [username, data] of Object.entries(cached)) {
        if (data.expiry && data.expiry > now) {
          // Store the entire data object (includes location and cachedAt)
          locationCache.set(username, data);
          if (data.location === null) {
            nullCount++;
          } else {
            validCount++;
          }
        } else {
          expiredCount++;
        }
      }
      console.log(`✅ Cache loaded: ${validCount} valid locations, ${nullCount} null locations (24h cache), ${expiredCount} expired entries`);
    }
  } catch (error) {
    // Extension context invalidated errors are expected when extension is reloaded
    if (error.message?.includes('Extension context invalidated') ||
        error.message?.includes('message port closed')) {
      console.log('Extension context invalidated, cache load skipped');
    } else {
      console.error('Error loading cache:', error);
    }
  }
}

// Save cache to persistent storage
async function saveCache() {
  try {
    // Check if extension context is still valid
    if (!chrome.runtime?.id) {
      console.log('Extension context invalidated, skipping cache save');
      return;
    }

    const cacheObj = {};

    // Save all cache entries with their existing expiry times
    for (const [username, data] of locationCache.entries()) {
      cacheObj[username] = data; // Data already includes location, expiry, cachedAt
    }

    await chrome.storage.local.set({ [CACHE_KEY]: cacheObj });
  } catch (error) {
    // Extension context invalidated errors are expected when extension is reloaded
    if (error.message?.includes('Extension context invalidated') ||
        error.message?.includes('message port closed')) {
      console.log('Extension context invalidated, cache save skipped');
    } else {
      console.error('Error saving cache:', error);
    }
  }
}

// Save a single entry to cache
async function saveCacheEntry(username, location, isVPN = false) {
  // Check if extension context is still valid
  if (!chrome.runtime?.id) {
    console.log('Extension context invalidated, skipping cache entry save');
    return;
  }

  const now = Date.now();
  let expiry;
  let vpnExpiry;

  // Use 24-hour expiry for null, 30-day expiry for valid locations
  if (location === null) {
    expiry = now + (NULL_CACHE_HOURS * 60 * 60 * 1000); // 24 hours
    console.log(`💾 Caching NULL location for ${username} (expires in ${NULL_CACHE_HOURS}h)`);
  } else {
    expiry = now + (CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000); // 30 days
    console.log(`💾 Caching location for ${username}: ${location} (expires in ${CACHE_EXPIRY_DAYS} days)${isVPN ? ' ⚠️  VPN detected' : ''}`);
  }

  // VPN status expires after 24 hours (more dynamic than location)
  vpnExpiry = now + (24 * 60 * 60 * 1000);

  // Store as object with metadata
  locationCache.set(username, {
    location: location,
    expiry: expiry,
    cachedAt: now,
    isVPN: isVPN,
    vpnExpiry: vpnExpiry
  });

  // Debounce saves - only save every 5 seconds
  if (!saveCache.timeout) {
    saveCache.timeout = setTimeout(async () => {
      await saveCache();
      saveCache.timeout = null;
    }, 5000);
  }
}

// Inject script into page context to access fetch with proper cookies
function injectPageScript() {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('pageScript.js');
  script.onload = function() {
    this.remove();
  };
  (document.head || document.documentElement).appendChild(script);
  
  // Listen for rate limit info from page script
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.data && event.data.type === '__rateLimitInfo') {
      rateLimitResetTime = event.data.resetTime;
      const waitTime = event.data.waitTime;
      console.log(`Rate limit detected. Will resume requests in ${Math.ceil(waitTime / 1000 / 60)} minutes`);

      // Update the rate limit tracker with Twitter's actual status
      // resetTime is in seconds (Unix timestamp)
      const remaining = event.data.remaining || 0;
      const limit = event.data.limit || 50;
      rateLimitTracker.setTwitterRateLimit(event.data.resetTime, remaining, limit);
    }
  });
}

// Process request queue with rate limiting
async function processRequestQueue() {
  if (isProcessingQueue || requestQueue.length === 0) {
    return;
  }
  
  // Check if we're rate limited
  if (rateLimitResetTime > 0) {
    const now = Math.floor(Date.now() / 1000);
    if (now < rateLimitResetTime) {
      const waitTime = (rateLimitResetTime - now) * 1000;
      console.log(`Rate limited. Waiting ${Math.ceil(waitTime / 1000 / 60)} minutes...`);
      setTimeout(processRequestQueue, Math.min(waitTime, 60000)); // Check every minute max
      return;
    } else {
      // Rate limit expired, reset
      rateLimitResetTime = 0;
    }
  }
  
  isProcessingQueue = true;
  
  while (requestQueue.length > 0 && activeRequests < MAX_CONCURRENT_REQUESTS) {
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    
    // Wait if needed to respect rate limit
    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
      await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest));
    }
    
    const { screenName, resolve, reject } = requestQueue.shift();
    activeRequests++;
    lastRequestTime = Date.now();
    
    // Make the request
    makeLocationRequest(screenName)
      .then(location => {
        resolve(location);
      })
      .catch(error => {
        reject(error);
      })
      .finally(() => {
        activeRequests--;
        // Continue processing queue
        setTimeout(processRequestQueue, 200);
      });
  }
  
  isProcessingQueue = false;
}

// Make actual API request
function makeLocationRequest(screenName) {
  return new Promise((resolve, reject) => {
    const requestId = Date.now() + Math.random();
    
    // Listen for response via postMessage
    const handler = (event) => {
      // Only accept messages from the page (not from extension)
      if (event.source !== window) return;

      if (event.data &&
          event.data.type === '__locationResponse' &&
          event.data.screenName === screenName &&
          event.data.requestId === requestId) {
        window.removeEventListener('message', handler);
        const location = event.data.location;
        const isVPN = event.data.isVPN || false;
        const isRateLimited = event.data.isRateLimited || false;

        // Only cache if not rate limited (don't cache failures due to rate limiting)
        if (!isRateLimited) {
          saveCacheEntry(screenName, location || null, isVPN);
        } else {
          console.log(`Not caching null for ${screenName} due to rate limit`);
        }

        resolve({location: location || null, isVPN: isVPN});
      }
    };
    window.addEventListener('message', handler);
    
    // Track this request for rate limiting
    rateLimitTracker.addRequest();

    // Send fetch request to page script via postMessage
    window.postMessage({
      type: '__fetchLocation',
      screenName,
      requestId
    }, '*');
    
    // Timeout after 10 seconds
    setTimeout(() => {
      window.removeEventListener('message', handler);
      // Don't cache timeout failures - allow retry
      console.log(`Request timeout for ${screenName}, not caching`);
      resolve(null);
    }, 10000);
  });
}

// Function to query Twitter GraphQL API for user location (with rate limiting)
async function getUserLocation(screenName) {
  // Check cache first
  if (locationCache.has(screenName)) {
    const cached = locationCache.get(screenName);

    // Cache now stores objects with {location, expiry, cachedAt, isVPN, vpnExpiry}
    const location = cached.location;
    const expiry = cached.expiry;
    const cachedAt = cached.cachedAt;
    const isVPN = cached.isVPN || false;
    const vpnExpiry = cached.vpnExpiry || 0;

    // Check if cache entry is still valid
    if (expiry && expiry > Date.now()) {
      // Check if VPN status is still valid (24h expiry)
      const vpnValid = vpnExpiry && vpnExpiry > Date.now();
      const vpnStatus = vpnValid ? isVPN : false;

      // Cache is valid
      if (location !== null) {
        console.log(`✅ Cache hit for ${screenName}: ${location}${vpnStatus ? ' ⚠️ VPN' : ''} (cached ${Math.floor((Date.now() - cachedAt) / 1000 / 60)} min ago)`);
      } else {
        console.log(`✅ Cache hit for ${screenName}: NULL (cached ${Math.floor((Date.now() - cachedAt) / 1000 / 60)} min ago, expires in ${Math.floor((expiry - Date.now()) / 1000 / 60)} min)`);
      }
      return {location: location, isVPN: vpnStatus};
    } else {
      // Cache expired, remove and re-fetch
      console.log(`⏰ Cache expired for ${screenName}, will re-fetch`);
      locationCache.delete(screenName);
    }
  }

  // Check if we can make a request (rate limit check)
  if (!rateLimitTracker.canMakeRequest()) {
    const minutesUntilReset = rateLimitTracker.getMinutesUntilReset();
    console.log(`⏸️  Rate limit reached (40/40). Will resume in ${minutesUntilReset} minute${minutesUntilReset !== 1 ? 's' : ''}`);

    // Show toast notification (first time only)
    if (rateLimitTracker.getStatus().used === rateLimitTracker.maxRequests) {
      showToast(`⏸️ Location fetching paused - rate limit reached. Resumes in ${minutesUntilReset} min`);
    }

    // Return null without caching (will show Unknown)
    return {location: null, isVPN: false};
  }

  console.log(`📡 Queueing API request for ${screenName}`);
  // Queue the request
  return new Promise((resolve, reject) => {
    requestQueue.push({ screenName, resolve, reject });
    processRequestQueue();
  });
}

// Function to extract username from various Twitter UI elements
function extractUsername(element) {
  // Try data-testid="UserName" or "User-Name" first (most reliable)
  const usernameElement = element.querySelector('[data-testid="UserName"], [data-testid="User-Name"]');
  if (usernameElement) {
    const links = usernameElement.querySelectorAll('a[href^="/"]');
    for (const link of links) {
      const href = link.getAttribute('href');
      const match = href.match(/^\/([^\/\?]+)/);
      if (match && match[1]) {
        const username = match[1];
        // Filter out common routes
        const excludedRoutes = ['home', 'explore', 'notifications', 'messages', 'i', 'compose', 'search', 'settings', 'bookmarks', 'lists', 'communities'];
        if (!excludedRoutes.includes(username) && 
            !username.startsWith('hashtag') &&
            !username.startsWith('search') &&
            username.length > 0 &&
            username.length < 20) { // Usernames are typically short
          return username;
        }
      }
    }
  }
  
  // Try finding username links in the entire element (broader search)
  const allLinks = element.querySelectorAll('a[href^="/"]');
  const seenUsernames = new Set();
  
  for (const link of allLinks) {
    const href = link.getAttribute('href');
    if (!href) continue;
    
    const match = href.match(/^\/([^\/\?]+)/);
    if (!match || !match[1]) continue;
    
    const potentialUsername = match[1];
    
    // Skip if we've already checked this username
    if (seenUsernames.has(potentialUsername)) continue;
    seenUsernames.add(potentialUsername);
    
    // Filter out routes and invalid usernames
    const excludedRoutes = ['home', 'explore', 'notifications', 'messages', 'i', 'compose', 'search', 'settings', 'bookmarks', 'lists', 'communities', 'hashtag'];
    if (excludedRoutes.some(route => potentialUsername === route || potentialUsername.startsWith(route))) {
      continue;
    }
    
    // Skip status/tweet links
    if (potentialUsername.includes('status') || potentialUsername.match(/^\d+$/)) {
      continue;
    }
    
    // Check link text/content for username indicators
    const text = link.textContent?.trim() || '';
    const linkText = text.toLowerCase();
    const usernameLower = potentialUsername.toLowerCase();
    
    // If link text starts with @, it's definitely a username
    if (text.startsWith('@')) {
      return potentialUsername;
    }
    
    // If link text matches the username (without @), it's likely a username
    if (linkText === usernameLower || linkText === `@${usernameLower}`) {
      return potentialUsername;
    }
    
    // Check if link is in a UserName container or has username-like structure
    const parent = link.closest('[data-testid="UserName"], [data-testid="User-Name"]');
    if (parent) {
      // If it's in a UserName container and looks like a username, return it
      if (potentialUsername.length > 0 && potentialUsername.length < 20 && !potentialUsername.includes('/')) {
        return potentialUsername;
      }
    }
    
    // Also check if link text is @username format
    if (text && text.trim().startsWith('@')) {
      const atUsername = text.trim().substring(1);
      if (atUsername === potentialUsername) {
        return potentialUsername;
      }
    }
  }
  
  // Last resort: look for @username pattern in text content and verify with link
  const textContent = element.textContent || '';
  const atMentionMatches = textContent.matchAll(/@([a-zA-Z0-9_]+)/g);
  for (const match of atMentionMatches) {
    const username = match[1];
    // Verify it's actually a link in a User-Name container
    const link = element.querySelector(`a[href="/${username}"], a[href^="/${username}?"]`);
    if (link) {
      // Make sure it's in a username context, not just mentioned in tweet text
      const isInUserNameContainer = link.closest('[data-testid="UserName"], [data-testid="User-Name"]');
      if (isInUserNameContainer) {
        return username;
      }
    }
  }
  
  return null;
}

// Helper function to find handle section
function findHandleSection(container, screenName) {
  return Array.from(container.querySelectorAll('div')).find(div => {
    const link = div.querySelector(`a[href="/${screenName}"]`);
    if (link) {
      const text = link.textContent?.trim();
      return text === `@${screenName}`;
    }
    return false;
  });
}

// Create loading shimmer placeholder
function createLoadingShimmer() {
  const shimmer = document.createElement('span');
  shimmer.setAttribute('data-twitter-flag-shimmer', 'true');
  shimmer.style.display = 'inline-block';
  shimmer.style.width = '20px';
  shimmer.style.height = '16px';
  shimmer.style.marginLeft = '4px';
  shimmer.style.marginRight = '4px';
  shimmer.style.verticalAlign = 'middle';
  shimmer.style.borderRadius = '2px';
  shimmer.style.background = 'linear-gradient(90deg, rgba(113, 118, 123, 0.2) 25%, rgba(113, 118, 123, 0.4) 50%, rgba(113, 118, 123, 0.2) 75%)';
  shimmer.style.backgroundSize = '200% 100%';
  shimmer.style.animation = 'shimmer 1.5s infinite';
  
  // Add animation keyframes if not already added
  if (!document.getElementById('twitter-flag-shimmer-style')) {
    const style = document.createElement('style');
    style.id = 'twitter-flag-shimmer-style';
    style.textContent = `
      @keyframes shimmer {
        0% {
          background-position: -200% 0;
        }
        100% {
          background-position: 200% 0;
        }
      }
    `;
    document.head.appendChild(style);
  }
  
  return shimmer;
}

// Function to add flag to username element
async function addFlagToUsername(usernameElement, screenName) {
  // Check if flag already added
  if (usernameElement.dataset.flagAdded === 'true') {
    return;
  }

  // Check if this username is already being processed (prevent duplicate API calls)
  if (processingUsernames.has(screenName)) {
    // Wait a bit and check if flag was added by the other process
    await new Promise(resolve => setTimeout(resolve, 500));
    if (usernameElement.dataset.flagAdded === 'true') {
      return;
    }
    // If still not added, mark this container as waiting
    usernameElement.dataset.flagAdded = 'waiting';
    return;
  }

  // Mark as processing to avoid duplicate requests
  usernameElement.dataset.flagAdded = 'processing';
  processingUsernames.add(screenName);
  
  // Find User-Name container for shimmer placement
  const userNameContainer = usernameElement.querySelector('[data-testid="UserName"], [data-testid="User-Name"]');
  
  // Create and insert loading shimmer
  const shimmerSpan = createLoadingShimmer();
  let shimmerInserted = false;
  
  if (userNameContainer) {
    // Try to insert shimmer before handle section (same place flag will go)
    const handleSection = findHandleSection(userNameContainer, screenName);
    if (handleSection && handleSection.parentNode) {
      try {
        handleSection.parentNode.insertBefore(shimmerSpan, handleSection);
        shimmerInserted = true;
      } catch (e) {
        // Fallback: insert at end of container
        try {
          userNameContainer.appendChild(shimmerSpan);
          shimmerInserted = true;
        } catch (e2) {
          console.log('Failed to insert shimmer');
        }
      }
    } else {
      // Fallback: insert at end of container
      try {
        userNameContainer.appendChild(shimmerSpan);
        shimmerInserted = true;
      } catch (e) {
        console.log('Failed to insert shimmer');
      }
    }
  }
  
  try {
    console.log(`Processing flag for ${screenName}...`);

    // Get location and VPN status
    const result = await getUserLocation(screenName);
    let location = result.location;
    const isVPN = result.isVPN || false;
    console.log(`Location for ${screenName}:`, location, isVPN ? '⚠️ VPN' : '');

    // Remove shimmer
    if (shimmerInserted && shimmerSpan.parentNode) {
      shimmerSpan.remove();
    }

    // If no location, use "Unknown"
    if (!location) {
      console.log(`❓ No location found for ${screenName}, using "Unknown"`);
      location = "Unknown";
    }

    // Normalize location: if it's not a recognized country, treat as "Unknown"
    // This ensures regions like "East Asia & Pacific" get the Unknown flag
    if (!COUNTRY_FLAGS[location]) {
      // Check case-insensitive match
      const normalized = location.trim();
      let foundMatch = false;
      for (const country of Object.keys(COUNTRY_FLAGS)) {
        if (country.toLowerCase() === normalized.toLowerCase()) {
          location = country; // Use the exact case from COUNTRY_FLAGS
          foundMatch = true;
          break;
        }
      }

      if (!foundMatch) {
        console.log(`⚠️ Location "${location}" is not a recognized country - treating as Unknown`);
        location = "Unknown";
      }
    }

  // Get flag emoji
  const flag = getCountryFlag(location);
  if (!flag) {
    console.log(`No flag found for location: ${location}`);
    // Shimmer already removed above, but ensure it's gone
    if (shimmerInserted && shimmerSpan.parentNode) {
      shimmerSpan.remove();
    }
    usernameElement.dataset.flagAdded = 'failed';
    return;
  }
  
  console.log(`Found flag ${flag} for ${screenName} (${location})`);

  // Find the username link - try multiple strategies
  // Priority: Find the @username link, not the display name link
  let usernameLink = null;
  
  // Find the User-Name container (reuse from above if available, otherwise find it)
  const containerForLink = userNameContainer || usernameElement.querySelector('[data-testid="UserName"], [data-testid="User-Name"]');
  
  // Strategy 1: Find link with @username text content (most reliable - this is the actual handle)
  if (containerForLink) {
    const containerLinks = containerForLink.querySelectorAll('a[href^="/"]');
    for (const link of containerLinks) {
      const text = link.textContent?.trim();
      const href = link.getAttribute('href');
      const match = href.match(/^\/([^\/\?]+)/);
      
      // Prioritize links that have @username as text
      if (match && match[1] === screenName) {
        if (text === `@${screenName}` || text === screenName) {
          usernameLink = link;
          break;
        }
      }
    }
  }
  
  // Strategy 2: Find any link with @username text in UserName container
  if (!usernameLink && containerForLink) {
    const containerLinks = containerForLink.querySelectorAll('a[href^="/"]');
    for (const link of containerLinks) {
      const text = link.textContent?.trim();
      if (text === `@${screenName}`) {
        usernameLink = link;
        break;
      }
    }
  }
  
  // Strategy 3: Find link with exact matching href that has @username text anywhere in element
  if (!usernameLink) {
    const links = usernameElement.querySelectorAll('a[href^="/"]');
    for (const link of links) {
      const href = link.getAttribute('href');
      const text = link.textContent?.trim();
      if ((href === `/${screenName}` || href.startsWith(`/${screenName}?`)) && 
          (text === `@${screenName}` || text === screenName)) {
        usernameLink = link;
        break;
      }
    }
  }
  
  // Strategy 4: Fallback to any matching href (but prefer ones not in display name area)
  if (!usernameLink) {
    const links = usernameElement.querySelectorAll('a[href^="/"]');
    for (const link of links) {
      const href = link.getAttribute('href');
      const match = href.match(/^\/([^\/\?]+)/);
      if (match && match[1] === screenName) {
        // Skip if this looks like a display name link (has verification badge nearby)
        const hasVerificationBadge = link.closest('[data-testid="User-Name"]')?.querySelector('[data-testid="icon-verified"]');
        if (!hasVerificationBadge || link.textContent?.trim() === `@${screenName}`) {
          usernameLink = link;
          break;
        }
      }
    }
  }

  if (!usernameLink) {
    console.error(`Could not find username link for ${screenName}`);
    console.error('Available links in container:', Array.from(usernameElement.querySelectorAll('a[href^="/"]')).map(l => ({
      href: l.getAttribute('href'),
      text: l.textContent?.trim()
    })));
    // Remove shimmer on error
    if (shimmerInserted && shimmerSpan.parentNode) {
      shimmerSpan.remove();
    }
    usernameElement.dataset.flagAdded = 'failed';
    return;
  }
  
  console.log(`Found username link for ${screenName}:`, usernameLink.href, usernameLink.textContent?.trim());

  // Check if flag already exists (check in the entire container, not just parent)
  const existingFlag = usernameElement.querySelector('[data-twitter-flag]');
  if (existingFlag) {
    // Remove shimmer if flag already exists
    if (shimmerInserted && shimmerSpan.parentNode) {
      shimmerSpan.remove();
    }
    usernameElement.dataset.flagAdded = 'true';
    return;
  }

  // Add flag emoji - place it next to verification badge, before @ handle
  // Include VPN warning if detected
  const flagSpan = document.createElement('span');
  flagSpan.textContent = ` ${flag}${isVPN ? '⚠️' : ''}`;
  flagSpan.setAttribute('data-twitter-flag', 'true');
  if (isVPN) {
    flagSpan.setAttribute('data-vpn-detected', 'true');
    flagSpan.title = `${location} (VPN detected)`;
  }
  flagSpan.style.marginLeft = '4px';
  flagSpan.style.marginRight = '4px';
  flagSpan.style.display = 'inline';
  flagSpan.style.color = 'inherit';
  flagSpan.style.verticalAlign = 'middle';
  
  // Use userNameContainer found above, or find it if not found
  const containerForFlag = userNameContainer || usernameElement.querySelector('[data-testid="UserName"], [data-testid="User-Name"]');
  
  if (!containerForFlag) {
    console.error(`Could not find UserName container for ${screenName}`);
    // Remove shimmer on error
    if (shimmerInserted && shimmerSpan.parentNode) {
      shimmerSpan.remove();
    }
    usernameElement.dataset.flagAdded = 'failed';
    return;
  }
  
  // Find the verification badge (SVG with data-testid="icon-verified")
  const verificationBadge = containerForFlag.querySelector('[data-testid="icon-verified"]');
  
  // Find the handle section - the div that contains the @username link
  // The structure is: User-Name > div (display name) > div (handle section with @username)
  const handleSection = findHandleSection(containerForFlag, screenName);

  let inserted = false;
  
  // Strategy 1: Insert right before the handle section div (which contains @username)
  // The handle section is a direct child of User-Name container
  if (handleSection && handleSection.parentNode === containerForFlag) {
    try {
      containerForFlag.insertBefore(flagSpan, handleSection);
      inserted = true;
      console.log(`✓ Inserted flag before handle section for ${screenName}`);
    } catch (e) {
      console.log('Failed to insert before handle section:', e);
    }
  }
  
  // Strategy 2: Find the handle section's parent and insert before it
  if (!inserted && handleSection && handleSection.parentNode) {
    try {
      // Insert before the handle section's parent (if it's not User-Name)
      const handleParent = handleSection.parentNode;
      if (handleParent !== containerForFlag && handleParent.parentNode) {
        handleParent.parentNode.insertBefore(flagSpan, handleParent);
        inserted = true;
        console.log(`✓ Inserted flag before handle parent for ${screenName}`);
      } else if (handleParent === containerForFlag) {
        // Handle section is direct child, insert before it
        containerForFlag.insertBefore(flagSpan, handleSection);
        inserted = true;
        console.log(`✓ Inserted flag before handle section (direct child) for ${screenName}`);
      }
    } catch (e) {
      console.log('Failed to insert before handle parent:', e);
    }
  }
  
  // Strategy 3: Find display name container and insert after it, before handle section
  if (!inserted && handleSection) {
    try {
      // Find the display name link (first link)
      const displayNameLink = containerForFlag.querySelector('a[href^="/"]');
      if (displayNameLink) {
        // Find the div that contains the display name link
        const displayNameContainer = displayNameLink.closest('div');
        if (displayNameContainer && displayNameContainer.parentNode) {
          // Check if handle section is a sibling
          if (displayNameContainer.parentNode === handleSection.parentNode) {
            displayNameContainer.parentNode.insertBefore(flagSpan, handleSection);
            inserted = true;
            console.log(`✓ Inserted flag between display name and handle (siblings) for ${screenName}`);
          } else {
            // Try inserting after display name container
            displayNameContainer.parentNode.insertBefore(flagSpan, displayNameContainer.nextSibling);
            inserted = true;
            console.log(`✓ Inserted flag after display name container for ${screenName}`);
          }
        }
      }
    } catch (e) {
      console.log('Failed to insert after display name:', e);
    }
  }
  
  // Strategy 4: Insert at the end of User-Name container (fallback)
  if (!inserted) {
    try {
      containerForFlag.appendChild(flagSpan);
      inserted = true;
      console.log(`✓ Inserted flag at end of UserName container for ${screenName}`);
    } catch (e) {
      console.error('Failed to append flag to User-Name container:', e);
    }
  }
  
    if (inserted) {
      // Mark as processed
      usernameElement.dataset.flagAdded = 'true';
      console.log(`✓ Successfully added flag ${flag} for ${screenName} (${location})`);

      // Apply country filtering if enabled
      applyCountryFilter(usernameElement, location);

      // Also mark any other containers waiting for this username
      const waitingContainers = document.querySelectorAll(`[data-flag-added="waiting"]`);
      waitingContainers.forEach(container => {
        const waitingUsername = extractUsername(container);
        if (waitingUsername === screenName) {
          // Try to add flag to this container too
          addFlagToUsername(container, screenName).catch(() => {});
        }
      });
    } else {
      console.error(`✗ Failed to insert flag for ${screenName} - tried all strategies`);
      console.error('Username link:', usernameLink);
      console.error('Parent structure:', usernameLink.parentNode);
      // Remove shimmer on failure
      if (shimmerInserted && shimmerSpan.parentNode) {
        shimmerSpan.remove();
      }
      usernameElement.dataset.flagAdded = 'failed';
    }
  } catch (error) {
    console.error(`Error processing flag for ${screenName}:`, error);
    // Remove shimmer on error
    if (shimmerInserted && shimmerSpan.parentNode) {
      shimmerSpan.remove();
    }
    usernameElement.dataset.flagAdded = 'failed';
  } finally {
    // Remove from processing set
    processingUsernames.delete(screenName);
  }
}

// Function to remove all flags (when extension is disabled)
function removeAllFlags() {
  const flags = document.querySelectorAll('[data-twitter-flag]');
  flags.forEach(flag => flag.remove());

  // Also remove any loading shimmers
  const shimmers = document.querySelectorAll('[data-twitter-flag-shimmer]');
  shimmers.forEach(shimmer => shimmer.remove());

  // Reset flag added markers
  const containers = document.querySelectorAll('[data-flag-added]');
  containers.forEach(container => {
    delete container.dataset.flagAdded;
  });

  console.log('Removed all flags');
}

// Function to find the tweet/post container from any element
function getTweetContainer(element) {
  // Look for the main tweet article container
  let container = element.closest('article[data-testid="tweet"]');
  if (container) return container;

  // Look for user cell containers (in search results, followers list, etc.)
  container = element.closest('[data-testid="UserCell"]');
  if (container) return container;

  // Look for cellInnerDiv (generic container)
  container = element.closest('[data-testid="cellInnerDiv"]');
  if (container) return container;

  return null;
}

// Thanos snap dissolve animation
function applyDissolveAnimation(container, location) {
  // Add dissolve class to trigger animation
  container.classList.add('twitter-flag-dissolve');

  console.log(`💫 Dissolving post from ${location}...`);

  // After animation completes, hide the element
  setTimeout(() => {
    container.style.display = 'none';
    container.classList.remove('twitter-flag-dissolve');
  }, 1000); // Match animation duration
}

// Inject CSS for dissolve animation (Thanos snap effect)
function injectDissolveStyles() {
  if (document.getElementById('twitter-flag-dissolve-style')) {
    return; // Already injected
  }

  const style = document.createElement('style');
  style.id = 'twitter-flag-dissolve-style';
  style.textContent = `
    @keyframes dissolve {
      0% {
        opacity: 1;
        transform: scale(1);
        filter: blur(0px);
      }
      40% {
        opacity: 0.8;
        transform: scale(0.98);
        filter: blur(0px);
      }
      70% {
        opacity: 0.4;
        transform: scale(0.95);
        filter: blur(2px) brightness(1.2);
      }
      100% {
        opacity: 0;
        transform: scale(0.9);
        filter: blur(4px) brightness(1.5);
      }
    }

    @keyframes particle-float {
      0% {
        opacity: 1;
        transform: translateY(0) translateX(0) scale(1);
      }
      100% {
        opacity: 0;
        transform: translateY(-30px) translateX(var(--drift-x, 0)) scale(0.3);
      }
    }

    .twitter-flag-dissolve {
      animation: dissolve 1s cubic-bezier(0.4, 0.0, 0.6, 1) forwards;
      position: relative;
    }

    .twitter-flag-dissolve::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.3) 0%, transparent 70%);
      opacity: 0;
      animation: dissolve 1s cubic-bezier(0.4, 0.0, 0.6, 1) forwards;
      pointer-events: none;
      z-index: 1;
    }

    /* Particle effect overlay */
    .twitter-flag-dissolve::after {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      width: 100%;
      height: 100%;
      transform: translate(-50%, -50%);
      background-image:
        radial-gradient(circle, rgba(200, 200, 200, 0.8) 1px, transparent 1px),
        radial-gradient(circle, rgba(150, 150, 150, 0.6) 1px, transparent 1px),
        radial-gradient(circle, rgba(180, 180, 180, 0.7) 1px, transparent 1px);
      background-size: 50px 50px, 80px 80px, 100px 100px;
      background-position: 0 0, 25px 25px, 50px 50px;
      opacity: 0;
      animation: particle-float 1s cubic-bezier(0.4, 0.0, 0.6, 1) forwards 0.3s;
      pointer-events: none;
      z-index: 2;
    }
  `;
  document.head.appendChild(style);
}

// Function to apply country filter to a single post/element
function applyCountryFilter(usernameElement, location) {
  // Debug: Log filter state
  console.log(`🔍 Filter check: location="${location}", filterEnabled=${countryFilterEnabled}, selectedCount=${selectedCountries.size}`);

  if (!countryFilterEnabled) {
    // Filter is disabled, make sure post is visible
    const container = getTweetContainer(usernameElement);
    if (container && container.dataset.countryFiltered === 'true') {
      container.style.display = '';
      delete container.dataset.countryFiltered;
      delete container.dataset.countryLocation;
    }
    return;
  }

  // Find the tweet/post container
  const container = getTweetContainer(usernameElement);
  if (!container) {
    console.log(`⚠️  No container found for ${location}`);
    return;
  }

  // Store the location on the container for future reference
  container.dataset.countryLocation = location;

  // Check if the location's country is in the selected countries
  const isSelected = selectedCountries.has(location);
  console.log(`🎯 Filter decision: "${location}" selected=${isSelected}, showing=${isSelected}`);

  if (isSelected) {
    // Country is selected, show the post
    container.style.display = '';
    delete container.dataset.countryFiltered;
    console.log(`✅ Showing post from ${location}`);
  } else {
    // Country is not selected, hide the post with dissolve animation
    if (!container.dataset.countryFiltered) {
      // First time hiding - trigger dissolve animation
      applyDissolveAnimation(container, location);
    } else {
      // Already hidden, just ensure it stays hidden
      container.style.display = 'none';
    }
    container.dataset.countryFiltered = 'true';
    console.log(`🚫 HIDING post from ${location}`);
  }
}

// Function to apply filter to all visible posts
function applyFilterToAllPosts() {
  // Find all elements that have flags added
  const processedContainers = document.querySelectorAll('[data-flag-added="true"]');

  processedContainers.forEach(element => {
    // Get the location from cache
    const screenName = extractUsername(element);
    if (screenName) {
      const cached = locationCache.get(screenName);
      if (cached) {
        // Convert null location to "Unknown" (same as in addFlagToUsername)
        const location = cached.location || "Unknown";
        applyCountryFilter(element, location);
      } else {
        // No cache entry, try to get from container data
        const container = getTweetContainer(element);
        if (container && container.dataset.countryLocation) {
          applyCountryFilter(element, container.dataset.countryLocation);
        }
      }
    } else {
      // Couldn't extract username, try to get location from the container's stored data
      const container = getTweetContainer(element);
      if (container && container.dataset.countryLocation) {
        applyCountryFilter(element, container.dataset.countryLocation);
      }
    }
  });

  console.log('✅ Applied filter to all posts');
}

// Function to process all username elements on the page
async function processUsernames() {
  // Check if extension is enabled
  if (!extensionEnabled) {
    return;
  }

  // Enhanced selectors to catch more username instances including replies
  const selectors = [
    'article[data-testid="tweet"]',           // Main tweets
    '[data-testid="UserCell"]',               // User cells in lists
    '[data-testid="User-Names"]',             // User name sections
    '[data-testid="User-Name"]',              // Individual user names
    '[data-testid="UserName"]',               // Alternative casing
  ];

  // Find all containers
  const containers = document.querySelectorAll(selectors.join(', '));

  // Also look for UserName elements nested within tweets (replies, quoted tweets)
  const tweets = document.querySelectorAll('article[data-testid="tweet"]');
  const nestedUserNames = [];
  tweets.forEach(tweet => {
    const nested = tweet.querySelectorAll('[data-testid="UserName"], [data-testid="User-Name"]');
    nested.forEach(n => nestedUserNames.push(n));
  });

  // Combine and deduplicate
  const allContainers = [...new Set([...containers, ...nestedUserNames])];

  console.log(`🔍 Processing ${allContainers.length} containers for usernames (${containers.length} base + ${nestedUserNames.length} nested) - Mode: ${loadingMode}`);

  let foundCount = 0;
  let processedCount = 0;
  let skippedCount = 0;
  let observedCount = 0;
  let cacheHits = 0;
  let newRequests = 0;

  for (const container of allContainers) {
    const screenName = extractUsername(container);
    if (screenName) {
      foundCount++;
      const status = container.dataset.flagAdded;

      // Check if we have this user cached
      const isCached = locationCache.has(screenName);
      if (isCached) {
        cacheHits++;
      }

      if (!status || status === 'failed') {
        // Different behavior based on loading mode
        if (loadingMode === 'balanced') {
          // Viewport-based loading: observe tweets instead of processing immediately
          const tweetContainer = getTweetContainer(container);
          if (tweetContainer) {
            observeTweet(tweetContainer);
            observedCount++;
          }
        } else if (loadingMode === 'aggressive') {
          // Aggressive mode: process immediately (old behavior)
          processedCount++;
          if (!isCached) {
            newRequests++;
          }
          addFlagToUsername(container, screenName).catch(err => {
            console.error(`❌ Error processing ${screenName}:`, err);
            container.dataset.flagAdded = 'failed';
          });
        }
        // Conservative mode: don't process at all (user must hover/click)
      } else {
        skippedCount++;
      }
    } else {
      // Debug: log containers that don't have usernames
      const hasUserName = container.querySelector('[data-testid="UserName"], [data-testid="User-Name"]');
      if (hasUserName) {
        console.log('⚠️  Found UserName container but no username extracted');
      }
    }
  }

  if (foundCount > 0) {
    if (loadingMode === 'balanced') {
      console.log(`📊 Stats: ${foundCount} usernames found | ${observedCount} observed for viewport loading | ${skippedCount} already done`);
    } else {
      console.log(`📊 Stats: ${foundCount} usernames found | ${processedCount} processing (${cacheHits} cached, ${newRequests} new API calls) | ${skippedCount} already done`);
    }
  } else {
    // Only log if we found containers but no usernames (potential issue)
    // Don't spam when page has no tweets (normal state)
    if (allContainers.length > 0) {
      console.log(`⚠️  Found ${allContainers.length} containers but no extractable usernames`);
    }
    // Silently skip when no containers at all (page loading, no tweets, etc.)
  }
}

// Track last processing time to avoid spam
let lastProcessTime = 0;
const MIN_PROCESS_INTERVAL = 1000; // 1 second minimum between processing

// Toast notification system
let activeToast = null;

function showToast(message, duration = 5000) {
  // Remove existing toast if any
  if (activeToast) {
    activeToast.remove();
    activeToast = null;
  }

  // Create toast element
  const toast = document.createElement('div');
  toast.className = 'twitter-location-toast';
  toast.textContent = message;

  // Style the toast
  Object.assign(toast.style, {
    position: 'fixed',
    bottom: '80px',
    right: '20px',
    background: '#1d9bf0',
    color: 'white',
    padding: '12px 20px',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    zIndex: '10000',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: '14px',
    fontWeight: '500',
    maxWidth: '300px',
    opacity: '0',
    transform: 'translateY(20px)',
    transition: 'all 0.3s ease'
  });

  // Add CSS animation keyframes if not already added
  if (!document.getElementById('toast-animations')) {
    const style = document.createElement('style');
    style.id = 'toast-animations';
    style.textContent = `
      @keyframes toastSlideIn {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      @keyframes toastSlideOut {
        from {
          opacity: 1;
          transform: translateY(0);
        }
        to {
          opacity: 0;
          transform: translateY(20px);
        }
      }
    `;
    document.head.appendChild(style);
  }

  // Append to body
  document.body.appendChild(toast);
  activeToast = toast;

  // Trigger slide-in animation
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });

  // Auto-dismiss after duration
  setTimeout(() => {
    if (toast.parentNode) {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(20px)';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.remove();
        }
        if (activeToast === toast) {
          activeToast = null;
        }
      }, 300);
    }
  }, duration);
}

// Initialize Intersection Observer for viewport detection
function initViewportObserver() {
  if (viewportObserver) {
    viewportObserver.disconnect();
  }

  try {
    viewportObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && extensionEnabled) {
          // Tweet is visible in viewport
          const tweetElement = entry.target;
          const screenName = extractUsername(tweetElement);

          if (screenName && !tweetElement.dataset.flagAdded) {
            // Process this tweet immediately
            addFlagToUsername(tweetElement, screenName).catch(err => {
              console.error(`❌ Error processing ${screenName}:`, err);
              tweetElement.dataset.flagAdded = 'failed';
            });
          }
        }
      });
    }, {
      root: null, // Use viewport as root
      rootMargin: '100px', // Start loading 100px before tweet is visible
      threshold: 0.1 // Trigger when 10% of tweet is visible
    });

    console.log('✅ Viewport observer initialized');
  } catch (error) {
    console.error('❌ Error initializing viewport observer:', error);
  }
}

// Helper function to observe a tweet element
function observeTweet(tweetElement) {
  if (viewportObserver && loadingMode === 'balanced') {
    viewportObserver.observe(tweetElement);
  }
}

// Initialize observer for dynamically loaded content
function initObserver() {
  if (observer) {
    observer.disconnect();
  }

  // Make sure document.body exists before trying to observe
  if (!document.body) {
    console.log('⚠️  document.body not ready, will retry observer setup');
    setTimeout(initObserver, 100);
    return;
  }

  try {
    observer = new MutationObserver((mutations) => {
      // Don't process if extension is disabled
      if (!extensionEnabled) {
        return;
      }

      // Check if we've processed recently (avoid spam)
      const now = Date.now();
      if (now - lastProcessTime < MIN_PROCESS_INTERVAL) {
        return;
      }

      // Check if any relevant nodes were added
      let foundRelevantMutation = false;
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          // Check if any added nodes might contain tweets
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node;
              // Check if it's a tweet container or contains UserName elements
              if (element.matches && (
                element.matches('article[data-testid="tweet"]') ||
                element.matches('[data-testid="UserCell"]') ||
                element.querySelector('[data-testid="UserName"]') ||
                element.querySelector('[data-testid="User-Name"]')
              )) {
                foundRelevantMutation = true;
                break;
              }
            }
          }
          if (foundRelevantMutation) break;
        }
      }

      if (foundRelevantMutation) {
        // Debounce processing
        setTimeout(() => {
          lastProcessTime = Date.now();
          processUsernames();
        }, 500);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    console.log('✅ MutationObserver initialized');
  } catch (error) {
    console.error('❌ Error initializing MutationObserver:', error);
  }
}

// Check if Twitter feed has loaded
function isTwitterFeedLoaded() {
  // Check for common Twitter feed elements
  const hasTweets = document.querySelector('article[data-testid="tweet"]');
  const hasUserCells = document.querySelector('[data-testid="UserCell"]');
  const hasUserNames = document.querySelector('[data-testid="UserName"]');

  return !!(hasTweets || hasUserCells || hasUserNames);
}

// Main initialization
async function init() {
  console.log('🚀 Twitter Location Flag extension initialized');

  // Load enabled state first
  await loadEnabledState();

  // Load persistent cache
  await loadCache();

  // Only proceed if extension is enabled
  if (!extensionEnabled) {
    console.log('Extension is disabled');
    return;
  }

  // Inject page script
  injectPageScript();

  // Inject dissolve animation styles
  injectDissolveStyles();

  // Wait for page to load with content
  let attempts = 0;
  const maxAttempts = 10;
  const checkInterval = setInterval(() => {
    attempts++;

    if (isTwitterFeedLoaded()) {
      console.log('✅ Twitter feed loaded, processing usernames...');
      clearInterval(checkInterval);
      processUsernames();
    } else if (attempts >= maxAttempts) {
      console.log('⚠️  Twitter feed not detected after 10 seconds - will process when content appears');
      clearInterval(checkInterval);
      // Still process once in case we're on a page without tweets
      processUsernames();
    }
  }, 1000);

  // Set up observer for new content
  initObserver();

  // Set up viewport observer if in balanced mode
  if (loadingMode === 'balanced') {
    initViewportObserver();
  }

  // Re-process on navigation (Twitter uses SPA)
  try {
    let lastUrl = location.href;
    const navObserver = new MutationObserver(() => {
      const url = location.href;
      if (url !== lastUrl) {
        lastUrl = url;
        console.log('🔄 Page navigation detected, reprocessing usernames');
        setTimeout(processUsernames, 2000);
      }
    });

    // Only observe if document exists
    if (document.documentElement) {
      navObserver.observe(document.documentElement, { subtree: true, childList: true });
      console.log('✅ Navigation observer initialized');
    }
  } catch (error) {
    console.error('❌ Error initializing navigation observer:', error);
  }
  
  // Save cache periodically
  setInterval(saveCache, 30000); // Save every 30 seconds
}

// Wait for page to load and safely initialize
function safeInit() {
  try {
    // Make sure we're on Twitter/X
    if (!location.hostname.includes('twitter.com') && !location.hostname.includes('x.com')) {
      console.log('Not on Twitter/X, extension will not run');
      return;
    }

    init();
  } catch (error) {
    console.error('❌ Error during extension initialization:', error);
    // Try again after a delay
    setTimeout(safeInit, 2000);
  }
}

// Wait for page to load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', safeInit);
} else {
  // Give it a tiny delay to ensure DOM is fully ready
  setTimeout(safeInit, 100);
}

