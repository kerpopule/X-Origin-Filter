// Popup script for extension toggle and country filtering
const TOGGLE_KEY = 'extension_enabled';
const FILTER_ENABLED_KEY = 'country_filter_enabled';
const SELECTED_COUNTRIES_KEY = 'selected_countries';
const THEME_KEY = 'popup_theme';
const LOADING_MODE_KEY = 'loading_mode';
const DEFAULT_ENABLED = true;
const DEFAULT_FILTER_ENABLED = false;
const DEFAULT_LOADING_MODE = 'balanced';

// Get DOM elements
const toggleSwitch = document.getElementById('toggleSwitch');
const status = document.getElementById('status');
const filterSectionHeader = document.getElementById('filterSectionHeader');
const expandIcon = document.getElementById('expandIcon');
const countryFilterContent = document.getElementById('countryFilterContent');
const filterToggle = document.getElementById('filterToggle');
const filterInfo = document.getElementById('filterInfo');
const selectAllBtn = document.getElementById('selectAllBtn');
const deselectAllBtn = document.getElementById('deselectAllBtn');
const countryList = document.getElementById('countryList');
const themeToggle = document.getElementById('themeToggle');

// Rate limit elements
const rateLimitSectionHeader = document.getElementById('rateLimitSectionHeader');
const rateLimitExpandIcon = document.getElementById('rateLimitExpandIcon');
const rateLimitContent = document.getElementById('rateLimitContent');
const rateLimitCount = document.getElementById('rateLimitCount');
const rateLimitProgress = document.getElementById('rateLimitProgress');
const rateLimitReset = document.getElementById('rateLimitReset');

// Loading mode elements
const loadingModeSectionHeader = document.getElementById('loadingModeSectionHeader');
const loadingModeExpandIcon = document.getElementById('loadingModeExpandIcon');
const loadingModeContent = document.getElementById('loadingModeContent');
const modeOptions = document.querySelectorAll('.mode-option');
const modeRadios = document.querySelectorAll('input[name="loadingMode"]');

// State
let selectedCountries = new Set();
let allCountries = [];
let currentTheme = 'auto'; // auto, light, or dark

// Initialize popup
async function init() {
  // Get all unique countries from COUNTRY_FLAGS with custom sort order
  const countriesSet = new Set(Object.keys(COUNTRY_FLAGS));
  const countriesArray = [...countriesSet];

  // Remove special countries from array for custom positioning
  const unknownIndex = countriesArray.indexOf('Unknown');
  const usaIndex = countriesArray.indexOf('United States');

  let sortedCountries = [];

  // Add Unknown first (if exists)
  if (unknownIndex !== -1) {
    sortedCountries.push('Unknown');
    countriesArray.splice(unknownIndex, 1);
  }

  // Add United States second (if exists)
  const newUsaIndex = countriesArray.indexOf('United States');
  if (newUsaIndex !== -1) {
    sortedCountries.push('United States');
    countriesArray.splice(newUsaIndex, 1);
  }

  // Sort remaining countries alphabetically and add them
  const remainingCountries = countriesArray.sort();
  allCountries = [...sortedCountries, ...remainingCountries];

  // Load saved state
  chrome.storage.local.get([TOGGLE_KEY, FILTER_ENABLED_KEY, SELECTED_COUNTRIES_KEY], (result) => {
    const isEnabled = result[TOGGLE_KEY] !== undefined ? result[TOGGLE_KEY] : DEFAULT_ENABLED;
    const filterEnabled = result[FILTER_ENABLED_KEY] !== undefined ? result[FILTER_ENABLED_KEY] : DEFAULT_FILTER_ENABLED;
    const savedCountries = result[SELECTED_COUNTRIES_KEY] || allCountries;

    selectedCountries = new Set(savedCountries);

    updateToggle(isEnabled);
    updateFilterToggle(filterEnabled);
    populateCountryList();
    updateFilterInfo();
  });
}

// Toggle expansion of country filter section
filterSectionHeader.addEventListener('click', () => {
  const isExpanded = countryFilterContent.classList.contains('visible');
  if (isExpanded) {
    countryFilterContent.classList.remove('visible');
    expandIcon.classList.remove('expanded');
  } else {
    countryFilterContent.classList.add('visible');
    expandIcon.classList.add('expanded');
  }
});

// Toggle expansion of rate limit section
rateLimitSectionHeader.addEventListener('click', () => {
  const isExpanded = rateLimitContent.classList.contains('visible');
  if (isExpanded) {
    rateLimitContent.classList.remove('visible');
    rateLimitExpandIcon.classList.remove('expanded');
  } else {
    rateLimitContent.classList.add('visible');
    rateLimitExpandIcon.classList.add('expanded');
  }
});

// Toggle expansion of loading mode section
loadingModeSectionHeader.addEventListener('click', () => {
  const isExpanded = loadingModeContent.classList.contains('visible');
  if (isExpanded) {
    loadingModeContent.classList.remove('visible');
    loadingModeExpandIcon.classList.remove('expanded');
  } else {
    loadingModeContent.classList.add('visible');
    loadingModeExpandIcon.classList.add('expanded');
  }
});

// Loading mode radio button handlers
modeRadios.forEach(radio => {
  radio.addEventListener('change', (e) => {
    if (e.target.checked) {
      handleLoadingModeChange(e.target.value);
    }
  });
});

// Loading mode option click handlers (click anywhere on option to select)
modeOptions.forEach(option => {
  option.addEventListener('click', (e) => {
    const mode = option.dataset.mode;
    const radio = option.querySelector('input[type="radio"]');
    if (radio && !radio.checked) {
      radio.checked = true;
      handleLoadingModeChange(mode);
    }
  });
});

// Main extension toggle
toggleSwitch.addEventListener('click', () => {
  chrome.storage.local.get([TOGGLE_KEY], (result) => {
    const currentState = result[TOGGLE_KEY] !== undefined ? result[TOGGLE_KEY] : DEFAULT_ENABLED;
    const newState = !currentState;

    chrome.storage.local.set({ [TOGGLE_KEY]: newState }, () => {
      updateToggle(newState);
      notifyContentScript();
    });
  });
});

// Filter toggle
filterToggle.addEventListener('click', () => {
  chrome.storage.local.get([FILTER_ENABLED_KEY], (result) => {
    const currentState = result[FILTER_ENABLED_KEY] !== undefined ? result[FILTER_ENABLED_KEY] : DEFAULT_FILTER_ENABLED;
    const newState = !currentState;

    chrome.storage.local.set({ [FILTER_ENABLED_KEY]: newState }, () => {
      updateFilterToggle(newState);
      updateFilterInfo();
      notifyContentScript();
    });
  });
});

// Select all countries
selectAllBtn.addEventListener('click', () => {
  selectedCountries = new Set(allCountries);
  saveSelectedCountries();
  updateCheckboxes();
  updateFilterInfo();
  notifyContentScript();
});

// Deselect all countries
deselectAllBtn.addEventListener('click', () => {
  selectedCountries.clear();
  saveSelectedCountries();
  updateCheckboxes();
  updateFilterInfo();
  notifyContentScript();
});

// Populate country list with checkboxes
function populateCountryList() {
  countryList.innerHTML = '';

  allCountries.forEach(country => {
    const item = document.createElement('div');
    item.className = 'country-item';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'country-checkbox';
    checkbox.id = `country-${country}`;
    checkbox.checked = selectedCountries.has(country);
    checkbox.dataset.country = country;

    const label = document.createElement('label');
    label.className = 'country-label';
    label.htmlFor = `country-${country}`;

    const flag = document.createElement('span');
    flag.className = 'country-flag';
    flag.textContent = COUNTRY_FLAGS[country];

    const name = document.createElement('span');
    name.className = 'country-name';
    name.textContent = country;

    label.appendChild(flag);
    label.appendChild(name);

    item.appendChild(checkbox);
    item.appendChild(label);

    // Toggle checkbox on item click
    item.addEventListener('click', (e) => {
      if (e.target !== checkbox) {
        checkbox.checked = !checkbox.checked;
      }
      handleCountryToggle(country, checkbox.checked);
    });

    // Handle direct checkbox click
    checkbox.addEventListener('change', (e) => {
      e.stopPropagation();
      handleCountryToggle(country, checkbox.checked);
    });

    countryList.appendChild(item);
  });
}

// Handle country selection toggle
function handleCountryToggle(country, isChecked) {
  if (isChecked) {
    selectedCountries.add(country);
  } else {
    selectedCountries.delete(country);
  }
  saveSelectedCountries();
  updateFilterInfo();
  notifyContentScript();
}

// Update all checkboxes to match current state
function updateCheckboxes() {
  const checkboxes = document.querySelectorAll('.country-checkbox');
  checkboxes.forEach(checkbox => {
    const country = checkbox.dataset.country;
    checkbox.checked = selectedCountries.has(country);
  });
}

// Save selected countries to storage
function saveSelectedCountries() {
  chrome.storage.local.set({
    [SELECTED_COUNTRIES_KEY]: Array.from(selectedCountries)
  });
}

// Update main toggle display
function updateToggle(isEnabled) {
  if (isEnabled) {
    toggleSwitch.classList.add('enabled');
    status.textContent = 'Extension is enabled';
    status.style.color = '#1d9bf0';
  } else {
    toggleSwitch.classList.remove('enabled');
    status.textContent = 'Extension is disabled';
    status.style.color = '#536471';
  }
}

// Update filter toggle display
function updateFilterToggle(isEnabled) {
  if (isEnabled) {
    filterToggle.classList.add('enabled');
  } else {
    filterToggle.classList.remove('enabled');
  }
}

// Update filter info text
function updateFilterInfo() {
  chrome.storage.local.get([FILTER_ENABLED_KEY], (result) => {
    const filterEnabled = result[FILTER_ENABLED_KEY] !== undefined ? result[FILTER_ENABLED_KEY] : DEFAULT_FILTER_ENABLED;

    if (filterEnabled) {
      const count = selectedCountries.size;
      if (count === 0) {
        filterInfo.textContent = '⚠️ No countries selected - all posts hidden';
        filterInfo.style.background = '#fff3cd';
        filterInfo.style.color = '#856404';
      } else if (count === allCountries.length) {
        filterInfo.textContent = `✓ All ${count} countries selected`;
        filterInfo.style.background = '#d1f2eb';
        filterInfo.style.color = '#0c5540';
      } else {
        filterInfo.textContent = `${count} of ${allCountries.length} countries selected`;
        filterInfo.style.background = '#d1ecf1';
        filterInfo.style.color = '#0c5460';
      }
    } else {
      filterInfo.textContent = 'Select countries to show in feed';
      filterInfo.style.background = '#f7f9f9';
      filterInfo.style.color = '#536471';
    }
  });
}

// Notify content script of changes
function notifyContentScript() {
  chrome.storage.local.get([TOGGLE_KEY, FILTER_ENABLED_KEY, SELECTED_COUNTRIES_KEY], (result) => {
    const message = {
      type: 'settingsUpdate',
      extensionEnabled: result[TOGGLE_KEY] !== undefined ? result[TOGGLE_KEY] : DEFAULT_ENABLED,
      filterEnabled: result[FILTER_ENABLED_KEY] !== undefined ? result[FILTER_ENABLED_KEY] : DEFAULT_FILTER_ENABLED,
      selectedCountries: result[SELECTED_COUNTRIES_KEY] || allCountries
    };

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, message).catch(() => {
          // Tab might not have content script loaded yet, that's okay
        });
      }
    });
  });
}

// Rate limit status updater
async function updateRateLimitStatus() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0]) return;

    // Request rate limit status from content script
    chrome.tabs.sendMessage(tabs[0].id, { type: 'getRateLimitStatus' }, (response) => {
      if (chrome.runtime.lastError || !response) {
        // Content script not loaded or error occurred
        rateLimitCount.textContent = '0/40';
        rateLimitProgress.style.width = '0%';
        rateLimitReset.textContent = 'No data available';
        return;
      }

      const { used, max, resetTime, isTwitterLimit } = response;

      // Update count display
      // If showing Twitter's actual status, indicate it
      if (isTwitterLimit) {
        rateLimitCount.textContent = `${used}/${max} (Twitter)`;
      } else {
        rateLimitCount.textContent = `${used}/${max}`;
      }

      // Update progress bar
      const percentage = (used / max) * 100;
      rateLimitProgress.style.width = `${percentage}%`;

      // Update color based on usage
      rateLimitCount.className = 'rate-limit-count';
      rateLimitProgress.className = 'progress-bar';

      if (used >= 35) {
        rateLimitCount.classList.add('critical');
        rateLimitProgress.classList.add('critical');
      } else if (used >= 30) {
        rateLimitCount.classList.add('warning');
        rateLimitProgress.classList.add('warning');
      }

      // Update reset time
      if (resetTime && used > 0) {
        const now = Date.now();
        const timeLeft = resetTime - now;
        const minutesLeft = Math.ceil(timeLeft / 60000);

        if (minutesLeft > 0) {
          if (isTwitterLimit) {
            rateLimitReset.textContent = `⏸️ Rate limited - resets in ${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''}`;
          } else {
            rateLimitReset.textContent = `Resets in ${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''}`;
          }
        } else {
          rateLimitReset.textContent = 'Resetting now...';
        }
      } else {
        rateLimitReset.textContent = 'Resets in 15 minutes';
      }
    });
  } catch (error) {
    console.error('Error updating rate limit status:', error);
  }
}

// Initialize loading mode
function initLoadingMode() {
  chrome.storage.local.get([LOADING_MODE_KEY], (result) => {
    const currentMode = result[LOADING_MODE_KEY] || DEFAULT_LOADING_MODE;

    // Update radio buttons
    modeRadios.forEach(radio => {
      radio.checked = radio.value === currentMode;
    });

    // Update selected styling on mode options
    modeOptions.forEach(option => {
      if (option.dataset.mode === currentMode) {
        option.classList.add('selected');
      } else {
        option.classList.remove('selected');
      }
    });
  });
}

// Handle loading mode change
function handleLoadingModeChange(newMode) {
  // Save to storage
  chrome.storage.local.set({ [LOADING_MODE_KEY]: newMode }, () => {
    // Update UI
    modeOptions.forEach(option => {
      if (option.dataset.mode === newMode) {
        option.classList.add('selected');
      } else {
        option.classList.remove('selected');
      }
    });

    // Notify content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'loadingModeChange',
          mode: newMode
        }).catch(() => {
          // Content script not loaded yet
        });
      }
    });
  });
}

// Theme management
function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
  let actualTheme = theme;
  if (theme === 'auto') {
    actualTheme = getSystemTheme();
  }

  if (actualTheme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    themeToggle.textContent = '☀️';
    themeToggle.title = 'Switch to light mode';
  } else {
    document.documentElement.removeAttribute('data-theme');
    themeToggle.textContent = '🌙';
    themeToggle.title = 'Switch to dark mode';
  }
}

function initTheme() {
  // Load saved theme preference
  chrome.storage.local.get([THEME_KEY], (result) => {
    currentTheme = result[THEME_KEY] || 'auto';
    applyTheme(currentTheme);
  });

  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (currentTheme === 'auto') {
      applyTheme('auto');
    }
  });
}

// Theme toggle handler
themeToggle.addEventListener('click', () => {
  // Cycle through: auto -> light -> dark -> auto
  const currentActualTheme = currentTheme === 'auto' ? getSystemTheme() : currentTheme;

  if (currentActualTheme === 'light') {
    currentTheme = 'dark';
  } else {
    currentTheme = 'light';
  }

  // Save preference
  chrome.storage.local.set({ [THEME_KEY]: currentTheme }, () => {
    applyTheme(currentTheme);
  });
});

// Initialize theme first (before other UI elements)
initTheme();

// Initialize on load
init();

// Initialize loading mode
initLoadingMode();

// Initialize and start rate limit updates
updateRateLimitStatus();
// Update rate limit status every 10 seconds
setInterval(updateRateLimitStatus, 10000);
