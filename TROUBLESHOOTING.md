# Troubleshooting Guide

## Common Issues and Solutions

---

## Issue: "Failed to execute 'observe' on 'MutationObserver'" Error

### Symptoms
Console shows error:
```
TypeError: Failed to execute 'observe' on 'MutationObserver': parameter 1 is not of type 'Node'.
```
And X.com may fail to load or crash.

### Cause
Extension tried to observe `document.body` before it existed (DOM not ready yet).

### Solution
✅ **Fixed in v1.3.1** - Update to latest version

The extension now:
- Checks if `document.body` exists before observing
- Retries automatically if DOM not ready
- Wraps all observers in try-catch
- Waits 100ms after DOM ready event before initializing

### Manual Fix (if still seeing this)
1. **Update to v1.3.1:**
   - Download latest version
   - Replace old files
   - Reload extension

2. **Clear and reload:**
   ```
   chrome://extensions/ → Remove extension
   Clear browser cache
   Reinstall extension
   ```

3. **Hard reload Twitter:**
   ```
   Ctrl+Shift+R (Windows)
   Cmd+Shift+R (Mac)
   ```

---

## Issue: "No usernames found in containers" Spam

### Symptoms
Console shows repeatedly:
```
🔍 Processing 0 containers for usernames (0 base + 0 nested)
❌ No usernames found in containers
```

### Causes
1. **Page hasn't loaded yet** - Extension tried to process before Twitter loaded tweets
2. **Twitter API errors** - Twitter's servers returning 503 errors (rate limiting)
3. **Empty page** - You're on a page without tweets (settings, empty profile, etc.)
4. **MutationObserver spam** - Observer firing on every DOM change

### Solutions
✅ **Fixed in v1.3.1**
- Extension now waits for Twitter feed to load before processing
- MutationObserver only triggers on tweet-related changes
- Minimum 1-second interval between processing attempts
- Silent when no containers found (normal state)

### What You Should See Now
```
🚀 Twitter Location Flag extension initialized
✅ Cache loaded: 45 valid locations, 12 null locations, 0 expired
✅ Twitter feed loaded, processing usernames...
📊 Stats: 50 usernames found | 12 processing (38 cached, 12 new API calls) | 38 done
```

---

## Issue: Twitter API 503 Errors

### Symptoms
Console shows:
```
Failed to load resource: the server responded with a status of 503
ApiError: https://x.com/i/api/graphql/.../HomeLatestTimeline HTTP-503
```

### Cause
**Twitter's API is down or rate limiting you**
- This is NOT an extension issue
- Twitter's servers are having problems
- You may be rate limited by Twitter

### What Happens
- Extension can't fetch location data for new users
- Cached users still show flags (cache works offline)
- New users will be queued and retried later

### Solutions
1. **Wait a few minutes** - Twitter's API usually recovers
2. **Check Twitter status** - https://api.twitterstat.us/
3. **Clear cache if needed**:
   ```javascript
   chrome.storage.local.clear()
   ```
4. **Reload page** - Sometimes helps clear rate limits

### What Extension Does
- Queues failed requests
- Retries after rate limit resets
- Shows cached data while waiting
- Logs rate limit info to console

---

## Issue: Flags Not Showing

### Symptoms
- No flags appear next to usernames
- Console shows no errors

### Possible Causes & Solutions

#### 1. Extension Disabled
**Check:** Look at toolbar icon
- 🔵 Blue X = Enabled
- 🔴 Red X = Disabled

**Fix:** Click icon → Toggle "Enable Extension" on

#### 2. Not Logged Into Twitter
**Check:** Are you logged into Twitter/X?

**Fix:** Log in to your Twitter account
- Extension needs authentication to access Twitter's API

#### 3. Page Not Loaded
**Check:** Console should show:
```
✅ Twitter feed loaded, processing usernames...
```

**Fix:** Wait 10 seconds, then reload page if needed

#### 4. Wrong Page
**Check:** Are you on a page with tweets?
- Settings, login, error pages don't have tweets

**Fix:** Go to Home feed or a profile with tweets

#### 5. Cache Corruption
**Check:** Console shows cache errors?

**Fix:** Clear cache:
```javascript
// In console:
chrome.storage.local.clear()
// Then reload page
```

---

## Issue: Flags Show But Filter Not Working

### Symptoms
- Flags appear correctly
- Enabling country filter does nothing
- Posts don't hide when deselecting countries

### Possible Causes & Solutions

#### 1. Filter Not Enabled
**Check:** In popup, "Enable Filter" toggle should be blue/on

**Fix:**
1. Click extension icon
2. Expand "Country Filter"
3. Toggle "Enable Filter" on

#### 2. All Countries Selected
**Check:** Filter info shows "All 63 countries selected"

**Fix:**
1. Click "Deselect All"
2. Select only countries you want to see
3. Posts should hide/show immediately

#### 3. No Location Data Yet
**Check:** Users might not have locations loaded yet

**Fix:** Wait for flags to appear, then filter works

---

## Issue: Slow Performance

### Symptoms
- Page lags when scrolling
- Console shows many processing messages
- High CPU usage

### Causes
1. Too many API calls
2. Cache not working properly
3. Extension processing too frequently

### Solutions

#### Check Cache Hit Rate
Console should show:
```
📊 Stats: 50 found | 5 processing (45 cached, 5 new API calls)
```
- Good: 80%+ cached
- Bad: <50% cached

#### If Cache Not Working
```javascript
// Clear and rebuild cache
chrome.storage.local.clear()
// Reload page
location.reload()
```

#### Check Processing Frequency
Console should show stats every 1-2 seconds, not faster

If seeing constant processing:
1. **v1.3.1 fixes this** - Update to latest version
2. Clear cache and reload
3. Check for browser extensions conflicts

---

## Issue: Extension Icon Wrong Color

### Symptoms
- Icon is wrong color (blue when disabled or vice versa)
- Icon doesn't change when toggling

### Causes
1. Icon files missing
2. Background worker not running
3. Icons cached by Chrome

### Solutions

#### 1. Check Icon Files
All 6 PNG files must be present:
```
icon-16.png
icon-48.png
icon-128.png
icon-disabled-16.png
icon-disabled-48.png
icon-disabled-128.png
```

**Fix:** Generate icons using `convert-icons.html`

#### 2. Check Background Worker
1. Go to `chrome://extensions/`
2. Find "Twitter Account Location Flag"
3. Click "service worker" link
4. Should see: `🎨 Icon updated: Blue (enabled)` or similar

**Fix:** If no service worker, reload extension

#### 3. Clear Chrome Icon Cache
1. Right-click extension icon → Remove from Chrome
2. Go to `chrome://extensions/`
3. Reload extension
4. Icon should appear with correct color

---

## Issue: Country Filter List Wrong Order

### Symptoms
- "Unknown" not at top
- "United States" not second
- Wrong alphabetical order

### Cause
- Old version of extension
- Cache from previous version

### Solution
1. Update to v1.3.0 or later
2. Reload extension:
   ```
   chrome://extensions/ → Reload button
   ```
3. Clear browser cache if needed
4. Open popup → Should see:
   ```
   1. ❓ Unknown
   2. 🇺🇸 United States
   3. 🇦🇫 Afghanistan
   ...
   ```

---

## Issue: Unknown Location (❓) Not Showing

### Symptoms
- Accounts without location show no flag
- No ❓ emoji appears

### Causes
1. Old version (before v1.3.0)
2. Cache issue

### Solutions
1. **Update to v1.3.0+**
2. **Clear cache**:
   ```javascript
   chrome.storage.local.clear()
   ```
3. **Reload page**
4. Government accounts should now show ❓

---

## Debug Commands

### Check Extension State
```javascript
// In console:
chrome.storage.local.get(null, (data) => console.log(data))
```

### Check Cache
```javascript
chrome.storage.local.get('twitter_location_cache', (result) => {
  const cache = result.twitter_location_cache || {};
  console.log('Cache entries:', Object.keys(cache).length);
  console.log('Sample entries:', Object.entries(cache).slice(0, 5));
});
```

### Force Process Usernames
```javascript
// On Twitter page, in console:
// (This function is in content script context)
// You can trigger it via page reload or waiting for MutationObserver
```

### Check Filter Settings
```javascript
chrome.storage.local.get(['country_filter_enabled', 'selected_countries'], (result) => {
  console.log('Filter enabled:', result.country_filter_enabled);
  console.log('Selected countries:', result.selected_countries);
});
```

### Clear Everything and Start Fresh
```javascript
chrome.storage.local.clear(() => {
  console.log('Cache cleared, reload page');
  location.reload();
});
```

---

## Getting More Help

### 1. Check Console Logs
Open DevTools (F12) → Console tab
Look for:
- ✅ Success messages (green checks)
- ⚠️ Warnings (yellow)
- ❌ Errors (red)

### 2. Check Service Worker
1. `chrome://extensions/`
2. Click "service worker" under extension
3. Look for errors

### 3. Verify Files
Check extension directory has all files:
- manifest.json
- content.js
- background.js
- popup.html, popup.js
- countryFlags.js
- pageScript.js
- 6 icon PNG files

### 4. Test in Incognito
Sometimes other extensions interfere:
1. Enable extension in incognito mode
2. Test in incognito window
3. If works there, you have extension conflict

---

## Known Limitations

### Not Bugs (Expected Behavior)

1. **Private accounts:** Can't fetch location from private accounts you don't follow
2. **Very new accounts:** May not have location indexed yet
3. **Deleted accounts:** Show no flag (account doesn't exist)
4. **Rate limiting:** Twitter limits API calls, extension backs off when limited
5. **503 errors:** Twitter's API is down, not extension issue

---

## Reporting Issues

If problem persists:

1. **Collect info:**
   - Extension version (check manifest.json)
   - Browser version
   - Console errors (screenshot)
   - Steps to reproduce

2. **Check if already fixed:**
   - Latest version is v1.3.1
   - Check CHANGELOG for fixes

3. **Try clean install:**
   ```
   1. Remove extension
   2. Delete extension folder
   3. Re-download fresh copy
   4. Generate icons
   5. Load extension
   ```

---

## Quick Fixes Summary

| Problem | Quick Fix |
|---------|-----------|
| Console spam | Update to v1.3.1 |
| No flags | Check blue/red icon, must be logged in |
| Filter not working | Enable filter toggle in popup |
| Slow | Clear cache: `chrome.storage.local.clear()` |
| Wrong icon color | Generate icon PNGs from convert-icons.html |
| No ❓ emoji | Update to v1.3.0+, clear cache |
| Twitter 503 errors | Wait, Twitter API issue not extension |

---

**Most issues fixed by:**
1. Update to latest version (v1.3.1)
2. Clear cache: `chrome.storage.local.clear()`
3. Reload extension
4. Reload page

Good luck! 🚀
