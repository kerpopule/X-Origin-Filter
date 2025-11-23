# Testing Guide - Country Filtering Feature

## Pre-Testing Setup

1. **Load Extension in Chrome:**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (top right)
   - Click "Load unpacked"
   - Select the `/Users/darlow/Desktop/X Origin Filter` directory

2. **Navigate to Twitter/X:**
   - Go to https://x.com or https://twitter.com
   - Make sure you're logged in

## Feature Testing Checklist

### ✅ Basic Functionality

- [ ] **Extension Icon Click**
  - Click the extension icon in Chrome toolbar
  - Popup should open with width ~320px

- [ ] **Main Toggle**
  - Toggle "Enable Extension" on/off
  - Flags should appear/disappear on page

- [ ] **Country Filter Section**
  - Click "Country Filter" header
  - Section should expand/collapse with smooth animation
  - Arrow icon should rotate

### ✅ Country Selection UI

- [ ] **Country List Display**
  - All 62 countries should be listed alphabetically
  - Each country should show flag emoji + name
  - List should be scrollable (max height 300px)

- [ ] **Select All Button**
  - Click "Select All"
  - All checkboxes should be checked
  - Filter info should say "✓ All 62 countries selected"

- [ ] **Deselect All Button**
  - Click "Deselect All"
  - All checkboxes should be unchecked
  - Filter info should say "⚠️ No countries selected - all posts hidden"

- [ ] **Individual Country Toggle**
  - Click individual country checkbox
  - Checkbox should toggle
  - Click country name/flag area (not checkbox)
  - Checkbox should also toggle

- [ ] **Filter Info Updates**
  - Select 0 countries: Yellow warning with "all posts hidden"
  - Select all countries: Green message with "All 62 countries selected"
  - Select partial (e.g., 5 countries): Blue message with "5 of 62 countries selected"

### ✅ Filtering Functionality

- [ ] **Enable Filter Toggle**
  - Enable "Enable Filter" toggle
  - Posts from non-selected countries should disappear

- [ ] **Filter US Posts Only**
  - Deselect all countries
  - Select only "United States 🇺🇸"
  - Only posts from US accounts should be visible

- [ ] **Filter Multiple Countries**
  - Select USA, Canada, UK, Japan
  - Only posts from those 4 countries should be visible

- [ ] **Disable Filter**
  - Toggle "Enable Filter" off
  - All posts should become visible again (regardless of selections)

- [ ] **Real-time Filter Updates**
  - With filter enabled and only USA selected
  - Add Canada to selection
  - Canadian posts should immediately appear

### ✅ Persistence Testing

- [ ] **Reload Page**
  - Set filter to: Enabled, select only 3 countries
  - Reload Twitter page (F5)
  - Filter settings should be preserved

- [ ] **Close/Reopen Popup**
  - Configure filter settings
  - Close popup
  - Reopen popup
  - Settings should be preserved

- [ ] **Restart Chrome**
  - Configure filter settings
  - Close Chrome completely
  - Reopen Chrome and go to Twitter
  - Settings should still be preserved

### ✅ Cross-View Testing

- [ ] **Home Feed**
  - Go to home feed (https://x.com/home)
  - Enable filter with specific countries
  - Tweets should be filtered correctly

- [ ] **User Profiles**
  - Go to a user's profile page
  - Filtering should work on profile tweets

- [ ] **Search Results**
  - Search for something (e.g., "javascript")
  - Filtering should work on search results

- [ ] **Infinite Scroll**
  - Enable filter
  - Scroll down to load more tweets
  - New tweets should be automatically filtered

### ✅ Edge Cases

- [ ] **No Location Users**
  - Users without location set should always be visible
  - No errors in console

- [ ] **Unknown Country**
  - If user has location not in COUNTRY_FLAGS list
  - Post should be visible (fail open, not closed)

- [ ] **Mixed Feed**
  - Feed with US, Japan, UK, and no-location posts
  - Filter to only USA
  - Only USA posts should show (+ no-location posts)

- [ ] **Zero Countries Selected**
  - Deselect all countries
  - Enable filter
  - All posts with locations should be hidden
  - Warning should be visible in popup

### ✅ Performance Testing

- [ ] **Large Feed**
  - Scroll through 50+ tweets
  - Filter should apply quickly (< 1 second)
  - No lag or freezing

- [ ] **Rapid Toggle**
  - Quickly toggle filter on/off multiple times
  - No errors or visual glitches

- [ ] **Quick Country Changes**
  - Rapidly select/deselect multiple countries
  - Changes should apply smoothly
  - No race conditions

### ✅ UI/UX Testing

- [ ] **Responsive Design**
  - Popup should look good at default size
  - Scrollbars should be styled (custom design)

- [ ] **Hover States**
  - Country items should highlight on hover
  - Buttons should show hover effect

- [ ] **Visual Feedback**
  - Checkboxes should use Twitter blue accent
  - Toggle switches should animate smoothly
  - Filter info colors should be appropriate (yellow warning, blue info, green success)

## Console Testing

Open Chrome DevTools Console (F12) and check for:

- [ ] **No Errors**
  - No red error messages
  - No warnings about missing functions

- [ ] **Proper Logging**
  - "Extension enabled: true/false"
  - "Country filter enabled: true/false"
  - "Selected countries: [number]"
  - "Filtered post from [country]"
  - "Applied filter to all posts"

## Known Limitations to Verify

- [ ] Users must be logged into Twitter/X
- [ ] Only works for accounts with location set in their profile
- [ ] Country name must match one of the 62 countries in COUNTRY_FLAGS
- [ ] Rate limiting may delay flag appearance on large feeds

## Regression Testing

- [ ] **Original Functionality Still Works**
  - Flags still appear next to usernames
  - 30-day caching still works
  - Rate limiting still works
  - Extension on/off toggle still works

## Success Criteria

✅ **Must Pass:**
- All basic functionality tests
- Filtering works correctly in home feed
- Settings persist across reloads
- No console errors
- Performance is acceptable (< 1s to filter 50 posts)

✅ **Should Pass:**
- Cross-view testing (profiles, search)
- Edge cases handled gracefully
- UI/UX is polished

## Bug Reporting Template

If you find issues, document them with:

```
**Bug Description:**
[What went wrong]

**Steps to Reproduce:**
1. [Step 1]
2. [Step 2]
3. [etc.]

**Expected Behavior:**
[What should happen]

**Actual Behavior:**
[What actually happened]

**Console Errors:**
[Any errors in console]

**Browser:** Chrome [version]
**Extension Version:** 1.1.0
```

## Testing Notes

- Test on a fresh Twitter feed with diverse accounts
- Clear cache (chrome.storage.local.clear() in console) between tests if needed
- Use DevTools to monitor network requests and console logs
- Take screenshots of any visual issues
