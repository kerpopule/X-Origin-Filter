# GitHub Setup Guide

Quick guide for pushing X Origin Filter to GitHub.

## Repository Information

- **Fork URL**: `git@github.com:kerpopule/X-Origin-Filter.git`
- **SSH Key**: macbook pro (already configured)
- **Current Version**: 1.6.0

## Initial Setup (First Time)

```bash
# Navigate to project directory
cd "/Users/darlow/Desktop/X Origin Filter"

# Initialize git (if not already initialized)
git init

# Add remote repository
git remote add origin git@github.com:kerpopule/X-Origin-Filter.git

# Check remote is configured
git remote -v
```

## Pushing Changes

### 1. Stage All Files

```bash
# Check status
git status

# Add all files
git add .

# Or add specific files
git add README.md CHANGELOG.md manifest.json content.js popup.html popup.js
```

### 2. Commit Changes

```bash
# Commit with descriptive message
git commit -m "Release v1.6.0: Add Thanos snap dissolve animation

- Implemented cinematic dissolve effect for filtered posts
- Added comprehensive documentation (README, CHANGELOG)
- Enhanced rate limit sync with Twitter's actual status
- Fixed unknown flag handling for regional locations
- Updated to manifest v1.6.0"
```

### 3. Push to GitHub

```bash
# Push to main branch (first time)
git push -u origin main

# Or push to master branch if that's default
git push -u origin master

# Subsequent pushes
git push
```

## Branch Strategy (Optional)

```bash
# Create development branch
git checkout -b develop

# Make changes, then commit
git add .
git commit -m "Your commit message"

# Push development branch
git push -u origin develop

# Switch back to main
git checkout main

# Merge when ready
git merge develop
git push
```

## Common Commands

### Check Status
```bash
git status                    # See what's changed
git log --oneline            # View commit history
git diff                     # See unstaged changes
```

### Undo Changes
```bash
git checkout -- filename     # Discard changes to a file
git reset HEAD filename      # Unstage a file
git reset --soft HEAD~1      # Undo last commit (keep changes)
```

### Update from Remote
```bash
git pull origin main         # Pull latest changes
git fetch origin            # Fetch without merging
```

## Recommended First Commit

```bash
# Stage everything
git add .

# Commit
git commit -m "Initial commit: X Origin Filter v1.6.0

Complete feature-rich Chrome extension for Twitter/X:
- Country flag display with smart caching
- Country filter with Thanos snap animation
- Rate limit protection with viewport loading
- Dark mode support
- Real-time API usage tracking
- Comprehensive documentation

See README.md for full feature list."

# Push
git push -u origin main
```

## Creating a Release (After Push)

1. Go to: https://github.com/kerpopule/X-Origin-Filter/releases
2. Click "Create a new release"
3. Tag version: `v1.6.0`
4. Release title: `v1.6.0 - Thanos Snap Animation`
5. Description:
   ```markdown
   ## 🎬 Thanos Snap Animation

   Posts now dissolve away with a cinematic Thanos-style effect when filtered!

   ### ✨ New Features
   - 💫 Dissolve animation with particle effects
   - 🚀 GPU-accelerated at 60fps
   - 🎯 Smart triggering (only first hide)

   ### 🔄 Improvements
   - Rate limit sync with Twitter's actual status
   - Enhanced unknown location handling
   - Comprehensive documentation

   ### 📦 Installation
   Download the source code and load as unpacked extension in Chrome.
   See README.md for detailed instructions.
   ```
6. Attach files (optional): Create a .zip of the extension
7. Click "Publish release"

## Troubleshooting

### SSH Key Issues
```bash
# Test SSH connection
ssh -T git@github.com

# Should see: "Hi kerpopule! You've successfully authenticated..."
```

### Push Rejected
```bash
# If remote has changes you don't have
git pull --rebase origin main
git push
```

### Wrong Remote
```bash
# Check current remote
git remote -v

# Remove wrong remote
git remote remove origin

# Add correct remote
git remote add origin git@github.com:kerpopule/X-Origin-Filter.git
```

## Files to Commit

### Essential Files
- [x] `manifest.json` - Extension configuration
- [x] `content.js` - Main content script
- [x] `pageScript.js` - API calls
- [x] `popup.html` - Popup UI
- [x] `popup.js` - Popup logic
- [x] `countryFlags.js` - Country mappings
- [x] `background.js` - Service worker
- [x] `README.md` - Main documentation
- [x] `CHANGELOG.md` - Version history
- [x] `LICENSE` - MIT license
- [x] `.gitignore` - Git ignore rules

### Documentation Files (Optional but Recommended)
- [x] `claude.md` - Development notes
- [x] `DARK_MODE_VPN_v1.4.0.md` - Dark mode docs
- [x] `RATE_LIMIT_FIX_v1.5.0.md` - Rate limit docs
- [x] `TWITTER_RATE_LIMIT_SYNC_v1.5.2.md` - Rate limit sync docs
- [x] `UNKNOWN_FLAG_FIX_v1.5.1.md` - Unknown flag docs
- [x] `DISSOLVE_ANIMATION_v1.6.0.md` - Animation docs
- [x] `BULK_LOOKUP_EXPLANATION.md` - API limitations
- [x] `GITHUB_SETUP.md` - This file

### Icon Files
- [x] `icon-16.png`
- [x] `icon-48.png`
- [x] `icon-128.png`

## Quick Reference Card

```bash
# Status and info
git status                    # What's changed?
git log --oneline --graph    # History
git branch                   # List branches

# Making changes
git add .                    # Stage everything
git add filename             # Stage specific file
git commit -m "message"      # Commit with message

# Syncing
git pull                     # Get updates
git push                     # Send updates

# Branches
git checkout -b new-branch   # Create and switch
git checkout main            # Switch to main
git merge branch-name        # Merge branch

# Undo
git reset HEAD filename      # Unstage
git checkout -- filename     # Discard changes
git revert commit-hash       # Undo commit
```

## Next Steps After Push

1. ✅ Verify files on GitHub: https://github.com/kerpopule/X-Origin-Filter
2. ✅ Create release (v1.6.0)
3. ✅ Add topics/tags to repository (chrome-extension, twitter, javascript)
4. ✅ Enable GitHub Pages (if you want docs site)
5. ✅ Add screenshot to README (optional)
6. ✅ Set repository description
7. ✅ Add link to README in repository description

## Repository Settings Checklist

- [ ] Description: "Chrome extension that displays country flags next to Twitter/X usernames with filtering and rate limit protection"
- [ ] Website: (optional)
- [ ] Topics: `chrome-extension`, `twitter`, `javascript`, `flags`, `rate-limiting`, `dark-mode`
- [ ] Social preview image: (optional, shows in social shares)
- [ ] License: MIT (should auto-detect from LICENSE file)
- [ ] Issues: Enabled
- [ ] Wiki: Optional
- [ ] Projects: Optional
- [ ] Discussions: Optional

---

**Ready to push!** 🚀

Run the commands in the "Recommended First Commit" section to get started.
