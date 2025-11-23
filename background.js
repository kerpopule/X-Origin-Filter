// Background script to manage extension icon based on enabled state

const TOGGLE_KEY = 'extension_enabled';
const DEFAULT_ENABLED = true;

// Icon paths
const ICONS_ENABLED = {
  "16": "icon-16.png",
  "48": "icon-48.png",
  "128": "icon-128.png"
};

const ICONS_DISABLED = {
  "16": "icon-disabled-16.png",
  "48": "icon-disabled-48.png",
  "128": "icon-disabled-128.png"
};

// Update icon based on current state
async function updateIcon() {
  try {
    const result = await chrome.storage.local.get([TOGGLE_KEY]);
    const isEnabled = result[TOGGLE_KEY] !== undefined ? result[TOGGLE_KEY] : DEFAULT_ENABLED;

    const icons = isEnabled ? ICONS_ENABLED : ICONS_DISABLED;

    chrome.action.setIcon({ path: icons });

    console.log(`🎨 Icon updated: ${isEnabled ? 'Blue (enabled)' : 'Red (disabled)'}`);
  } catch (error) {
    console.error('Error updating icon:', error);
  }
}

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes[TOGGLE_KEY]) {
    updateIcon();
  }
});

// Update icon on startup
chrome.runtime.onStartup.addListener(() => {
  updateIcon();
});

// Update icon when extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
  updateIcon();
});

// Initial icon update
updateIcon();
