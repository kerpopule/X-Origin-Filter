# Changelog

All notable changes to X Origin Filter will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.6.0] - 2025-11-23

### Added
- 💫 **Thanos Snap Dissolve Animation**: Posts now dissolve away with a cinematic effect when filtered
  - 1-second smooth animation with progressive blur and fade
  - Particle/dust overlay that floats upward
  - Radial gradient glow effect
  - GPU-accelerated at 60fps
  - Smart triggering (only first hide to prevent spam)
- 📝 Comprehensive documentation for all features
- 📄 Created `DISSOLVE_ANIMATION_v1.6.0.md` with full animation details
- 📄 Created `BULK_LOOKUP_EXPLANATION.md` explaining API limitations

### Changed
- Filter now triggers animation before hiding posts
- Improved visual feedback when posts are removed

### Technical
- Added `applyDissolveAnimation()` function in content.js
- Added `injectDissolveStyles()` with CSS keyframes and animations
- Modified `applyCountryFilter()` to integrate animation system
- Animation CSS injected during initialization

## [1.5.2] - 2025-11-23

### Added
- 🔄 **Twitter Rate Limit Sync**: Extension now syncs with Twitter's actual rate limit status
  - Shows accurate usage even after reinstalling extension
  - Displays "(Twitter)" label when showing Twitter's actual status
  - Auto-expires when rate limit resets
- ⏸️ Visual pause indicator when rate limited
- 🚨 Enhanced console logging for rate limit events

### Changed
- RateLimitTracker now tracks both session and Twitter's actual status
- Popup prioritizes Twitter's status over session estimate
- Reset message shows "⏸️ Rate limited - resets in X minutes" when at Twitter's limit

### Fixed
- Extension now correctly displays rate limit status after reinstall
- No more confusion between session tracking and Twitter's actual limit

### Technical
- Enhanced `RateLimitTracker` class with Twitter status tracking (content.js:8-114)
- Added `setTwitterRateLimit()` method
- Updated pageScript.js to send remaining/limit from 429 responses
- Modified popup.js to display `isTwitterLimit` flag

## [1.5.1] - 2025-11-23

### Added
- ❓ Regional locations now show Unknown flag
- 🗺️ Handles "East Asia & Pacific" and similar non-country regions
- 📝 Console warning when non-country location detected

### Changed
- `getCountryFlag()` now returns Unknown flag instead of null for unrecognized locations
- Location normalization ensures regions are treated as "Unknown" for filtering

### Fixed
- Accounts with regional locations (like "East Asia & Pacific") now show ❓ flag
- Filter works correctly with Unknown locations
- No more missing flags for non-specific locations

### Technical
- Modified `getCountryFlag()` in countryFlags.js (lines 67-86)
- Added location normalization in content.js (lines 703-721)

## [1.5.0] - 2025-11-23

### Added
- 🚦 **Smart Rate Limit Tracking**: 40/50 request buffer with sliding window
  - Prevents hitting Twitter's rate limit
  - Automatic cleanup of old requests
  - Real-time monitoring
- 👁️ **Viewport-Based Loading**: Intersection Observer for visible tweets only
  - Reduces API calls by 70-80%
  - Smooth scrolling experience
  - 100px preload margin
- 📊 **Real-time Rate Limit Display** in popup
  - Progress bar visualization
  - Color-coded warnings (blue/yellow/red)
  - Countdown timer to reset
  - Updates every 10 seconds
- 🎚️ **Three Loading Modes**:
  - **Aggressive**: Load all immediately (may hit rate limits)
  - **Balanced** (Default): Viewport-only loading
  - **Conservative**: Minimal API usage
- 🔔 **Toast Notifications**: User-friendly notifications when limit reached
  - Twitter-style design
  - 5-second auto-dismiss
  - Smooth slide animations

### Changed
- Default behavior now uses Balanced mode (viewport loading)
- Extension no longer appears "broken" when rate limited
- Better user communication about rate limit status

### Technical
- Added `RateLimitTracker` class (content.js:7-61)
- Added `initViewportObserver()` function (content.js:1249-1289)
- Modified `processUsernames()` with mode support (content.js:1070-1168)
- Added toast notification system (content.js:1158-1247)
- Enhanced popup UI with rate limit and loading mode sections

## [1.4.0] - 2025-11-22

### Added
- 🌓 **Dark Mode Support**: Automatic system detection and manual toggle
  - Matches system theme on load
  - Manual toggle with moon 🌙 / sun ☀️ button
  - Persistent preference across sessions
  - Smooth color transitions
- ⚠️ **VPN Detection Infrastructure**: Framework for detecting VPN usage
  - Shows ⚠️ emoji next to flag when detected
  - 24-hour VPN status cache
  - Ready for external API integration
- 💾 Persistent theme preference in storage

### Changed
- Popup UI now supports both light and dark themes
- Updated CSS with theme variables
- Enhanced cache structure to include VPN data

### Technical
- Added theme management functions in popup.js (lines 277-335)
- Added CSS variables for theming in popup.html
- Updated cache structure with `isVPN` and `vpnExpiry` fields
- Added theme toggle button in popup

## [1.3.2] - 2025-11-21

### Fixed
- Country filter now works correctly
- Filter state properly tracked and applied
- Fixed issue where filter wasn't hiding posts

### Technical
- Improved filter logic in `applyCountryFilter()`
- Added better state management for filter toggle

## [1.3.0] - 2025-11-20

### Added
- 🎯 **Country Filter System**: Show only posts from selected countries
  - Toggle to enable/disable filter
  - Country selection UI with checkboxes
  - Select all / deselect all buttons
  - Real-time filtering with page reload
- 📝 Filter status display in popup
- 🔍 Console logging for filter decisions

### Technical
- Added country filter logic in content.js
- Created filter UI in popup.html
- Added filter state management

## [1.2.0] - 2025-11-19

### Added
- 💾 **Smart Caching System**: 30-day cache for location data
  - Significantly reduces API calls
  - Null results cached for 24 hours
  - Automatic cache expiry
  - Persistent across sessions
- Cache management functions
- Cache statistics in console

### Changed
- Extension now checks cache before making API calls
- Much faster flag display for cached users

### Technical
- Added `loadCache()` and `saveCache()` functions
- Implemented cache expiry system
- Added `CACHE_KEY` and expiry constants

## [1.1.0] - 2025-11-18

### Added
- 🚩 **Flag Display System**: Shows country flags next to usernames
  - Automatic username detection
  - Flag emoji mapping for 50+ countries
  - Hover tooltips showing country name
  - VPN warning emoji support (⚠️)
- Dynamic content support (infinite scroll)
- Multiple username detection strategies

### Technical
- Created `countryFlags.js` with country→flag mapping
- Implemented `addFlagToUsername()` function
- Added multiple strategies for finding username elements
- Support for nested username containers

## [1.0.0] - 2025-11-17

### Added
- 🚀 **Initial Release**: Basic extension functionality
  - Content script injection
  - Page script for API calls
  - Twitter GraphQL API integration
  - Basic location fetching
- Extension popup UI
- Background service worker
- Chrome extension manifest v3

### Technical
- Created base extension structure
- Implemented `AboutAccountQuery` API integration
- Set up message passing between scripts
- Basic error handling

---

## Version Notes

### Versioning Scheme
- **Major (X.0.0)**: Breaking changes or major feature additions
- **Minor (0.X.0)**: New features, non-breaking changes
- **Patch (0.0.X)**: Bug fixes, minor improvements

### Upgrade Guidelines

#### From 1.5.x to 1.6.0
- No breaking changes
- Dissolve animation enabled automatically
- No configuration required
- Existing cache and settings preserved

#### From 1.4.x to 1.5.0
- Rate limit tracking automatically enabled
- Default mode changed to "Balanced"
- Existing installations may see different behavior (fewer API calls)
- Cache and settings preserved

#### From 1.3.x to 1.4.0
- Dark mode automatically detects system preference
- No action required
- Theme preference saved for future sessions

---

## Future Releases

### Planned for v1.7.0
- Region grouping (e.g., "Europe", "Asia")
- Custom country groups
- Filter presets (save/load)
- Enhanced VPN detection with external APIs

### Planned for v1.8.0
- Customizable animation effects
- Animation speed controls
- Multiple animation styles
- Reverse animation for showing posts

### Planned for v2.0.0
- Support for other social platforms
- Internationalization (i18n)
- Major performance optimizations
- Advanced analytics dashboard

---

## Links

- **Repository**: [github.com/kerpopule/X-Origin-Filter](https://github.com/kerpopule/X-Origin-Filter)
- **Issues**: [github.com/kerpopule/X-Origin-Filter/issues](https://github.com/kerpopule/X-Origin-Filter/issues)
- **Discussions**: [github.com/kerpopule/X-Origin-Filter/discussions](https://github.com/kerpopule/X-Origin-Filter/discussions)

---

**Note**: Dates are in YYYY-MM-DD format. All times are UTC.
