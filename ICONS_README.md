# Extension Icons Setup Guide

## Quick Start

1. **Open the icon converter:**
   ```
   Open convert-icons.html in your web browser
   ```

2. **Download the icons:**
   - Click "Download All Blue Icons" (for enabled state)
   - Click "Download All Red Icons" (for disabled state)

3. **You'll get 6 PNG files:**
   - `icon-16.png` (blue)
   - `icon-48.png` (blue)
   - `icon-128.png` (blue)
   - `icon-disabled-16.png` (red)
   - `icon-disabled-48.png` (red)
   - `icon-disabled-128.png` (red)

4. **Place all 6 files in the extension root directory** (same folder as manifest.json)

5. **Reload the extension in Chrome**

---

## Icon Design

### Blue Icon (Enabled State)
- **Color:** #1DA1F2 (Twitter Blue)
- **Design:** X logo (Twitter/X style)
- **Background:** Transparent
- **State:** Extension is ON, flags are showing

### Red Icon (Disabled State)
- **Color:** #DC3545 (Bootstrap Danger Red)
- **Design:** Same X logo
- **Background:** Transparent
- **State:** Extension is OFF, no flags showing

---

## How It Works

### Dynamic Icon Switching

The extension automatically changes its icon based on the enabled/disabled state:

```javascript
// background.js listens for state changes
chrome.storage.onChanged.addListener((changes) => {
  if (changes.extension_enabled) {
    // Update icon to blue (enabled) or red (disabled)
    chrome.action.setIcon({ path: icons });
  }
});
```

**User Experience:**
1. Extension enabled → Blue X icon in toolbar
2. User clicks popup → Toggles extension off
3. Icon instantly changes to Red X
4. Extension disabled → Red X icon in toolbar

---

## Manual Icon Creation (Alternative)

If you prefer to create icons manually or customize them:

### Using the SVG Files

**Source files provided:**
- `icon-enabled.svg` - Blue X logo
- `icon-disabled.svg` - Red X logo

**To convert SVG to PNG:**

1. **Using Inkscape (Free):**
   ```bash
   inkscape icon-enabled.svg --export-filename=icon-16.png --export-width=16
   inkscape icon-enabled.svg --export-filename=icon-48.png --export-width=48
   inkscape icon-enabled.svg --export-filename=icon-128.png --export-width=128
   ```

2. **Using ImageMagick (Command Line):**
   ```bash
   convert -background none -resize 16x16 icon-enabled.svg icon-16.png
   convert -background none -resize 48x48 icon-enabled.svg icon-48.png
   convert -background none -resize 128x128 icon-enabled.svg icon-128.png
   ```

3. **Using Online Tools:**
   - Upload SVG to https://svgtopng.com/
   - Set transparent background
   - Export at 16px, 48px, and 128px

### Custom Colors

To change the icon colors, edit the SVG files:

**icon-enabled.svg:**
```xml
<path d="..." fill="#1DA1F2" />  <!-- Change this color -->
```

**icon-disabled.svg:**
```xml
<path d="..." fill="#DC3545" />  <!-- Change this color -->
```

Popular alternatives:
- Green (success): #28A745
- Orange (warning): #FD7E14
- Purple (custom): #6F42C1

---

## Icon Sizes Explained

Chrome extensions use three standard icon sizes:

| Size | Usage |
|------|-------|
| 16x16 | Extension toolbar (favicon) |
| 48x48 | Extensions page, popup preview |
| 128x128 | Chrome Web Store listing, installation dialog |

---

## Troubleshooting

### Icons Not Showing
1. **Check file names:** Must be exact: `icon-16.png`, `icon-48.png`, `icon-128.png`, etc.
2. **Check file location:** Must be in extension root directory
3. **Reload extension:** Go to chrome://extensions/ and click reload
4. **Clear browser cache:** Sometimes Chrome caches old icons

### Icons Not Switching
1. **Check background.js:** Make sure it's loaded (check chrome://extensions/ → service worker)
2. **Check console:** Open service worker and look for error messages
3. **Check storage:** Verify extension_enabled value is changing

### Wrong Colors
1. **Re-download from convert-icons.html**
2. **Check SVG source:** Verify colors in SVG files
3. **Clear icon cache:** Chrome may cache old versions

---

## Testing

After setting up icons:

1. **Test enabled state:**
   - Make sure extension is enabled
   - Check toolbar icon → should be blue X

2. **Test disabled state:**
   - Click extension icon
   - Toggle "Enable Extension" off
   - Check toolbar icon → should turn red X

3. **Test switching:**
   - Toggle extension on/off multiple times
   - Icon should change instantly

---

## File Structure

Your extension directory should look like this:

```
X Origin Filter/
├── manifest.json
├── background.js
├── content.js
├── popup.html
├── popup.js
├── countryFlags.js
├── pageScript.js
├── icon-16.png              ← Blue enabled
├── icon-48.png              ← Blue enabled
├── icon-128.png             ← Blue enabled
├── icon-disabled-16.png     ← Red disabled
├── icon-disabled-48.png     ← Red disabled
├── icon-disabled-128.png    ← Red disabled
├── icon-enabled.svg         (source)
├── icon-disabled.svg        (source)
└── convert-icons.html       (tool)
```

---

## Credits

- X logo design inspired by Twitter/X branding
- Blue color (#1DA1F2): Official Twitter blue
- Red color (#DC3545): Bootstrap danger color
- Transparent backgrounds for clean toolbar integration

---

## Support

If you have issues with icons:
1. Check all 6 PNG files are present and correctly named
2. Verify background.js is loaded as service worker
3. Clear Chrome's extension icon cache
4. Try generating icons again with convert-icons.html

For custom icon requests or issues, check the main documentation in `claude.md`.
