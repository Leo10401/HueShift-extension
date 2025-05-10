document.addEventListener('DOMContentLoaded', function() {
  const statusElement = document.getElementById('status');
  const themeRadios = document.querySelectorAll('input[name="theme"]');
  const applyButton = document.getElementById('apply-button');
  const intensitySlider = document.getElementById('intensity-slider');
  const intensityValue = document.getElementById('intensity-value');
  const fontSizeControls = document.getElementById('font-size-controls');
  const savePerSiteCheckbox = document.getElementById('save-per-site');
  const searchInput = document.getElementById('search-themes');
  let currentTab = null;
  let currentUrl = '';
  
  // Get current tab once to avoid redundant queries
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    currentTab = tabs[0];
    currentUrl = new URL(currentTab.url).hostname;
    document.getElementById('current-site').textContent = currentUrl;
    
    // Load site-specific settings if they exist
    loadSiteSpecificSettings(currentUrl);
  });

  // Load the current theme setting
  function loadSiteSpecificSettings(hostname) {
    chrome.storage.sync.get(['globalTheme', 'siteThemes', 'savePerSite', 'themeIntensity', 'fontSize'], function(data) {
      // Check if we should use site-specific settings
      if (data.savePerSite && data.siteThemes && data.siteThemes[hostname]) {
        const siteSettings = data.siteThemes[hostname];
        
        // Apply site-specific theme
        if (siteSettings.theme) {
          document.querySelector(`input[value="${siteSettings.theme}"]`).checked = true;
        }
        
        // Apply site-specific intensity
        if (siteSettings.intensity !== undefined) {
          intensitySlider.value = siteSettings.intensity;
          intensityValue.textContent = `${siteSettings.intensity}%`;
        }
        
        // Apply site-specific font size
        if (siteSettings.fontSize) {
          document.querySelector(`button[data-size="${siteSettings.fontSize}"]`).classList.add('active');
        }
        
        // Set the save per site checkbox
        savePerSiteCheckbox.checked = true;
      } else {
        // Use global settings
        if (data.globalTheme) {
          document.querySelector(`input[value="${data.globalTheme}"]`).checked = true;
        } else {
          document.querySelector('input[value="none"]').checked = true;
        }
        
        // Set intensity
        if (data.themeIntensity !== undefined) {
          intensitySlider.value = data.themeIntensity;
          intensityValue.textContent = `${data.themeIntensity}%`;
        }
        
        // Set font size
        if (data.fontSize) {
          document.querySelector(`button[data-size="${data.fontSize}"]`).classList.add('active');
        }
        
        // Set the save per site checkbox
        savePerSiteCheckbox.checked = !!data.savePerSite;
      }
    });
  }

  // Theme search functionality
  searchInput.addEventListener('input', function() {
    const searchTerm = this.value.toLowerCase();
    const themeOptions = document.querySelectorAll('.theme-option-wrapper');
    
    themeOptions.forEach(option => {
      const themeName = option.querySelector('.theme-label').textContent.toLowerCase();
      if (searchTerm === '' || themeName.includes(searchTerm)) {
        option.style.display = 'block';
      } else {
        option.style.display = 'none';
      }
    });
  });

  // Add live preview on hover
  document.querySelectorAll('.theme-option').forEach(option => {
    option.addEventListener('mouseenter', function() {
      const themeValue = this.closest('label').querySelector('input[name="theme"]').value;
      previewTheme(themeValue);
    });
    
    option.addEventListener('mouseleave', function() {
      const selectedTheme = document.querySelector('input[name="theme"]:checked').value;
      previewTheme(selectedTheme);
    });
  });

  // Preview theme without saving
  function previewTheme(theme) {
    if (currentTab) {
      chrome.tabs.sendMessage(currentTab.id, {
        action: 'previewTheme', 
        theme: theme,
        intensity: intensitySlider.value
      });
    }
  }

  // Intensity slider
  intensitySlider.addEventListener('input', function() {
    intensityValue.textContent = `${this.value}%`;
    
    // Live preview intensity change
    const selectedTheme = document.querySelector('input[name="theme"]:checked').value;
    if (currentTab && selectedTheme !== 'none') {
      chrome.tabs.sendMessage(currentTab.id, {
        action: 'previewTheme', 
        theme: selectedTheme,
        intensity: this.value
      });
    }
  });

  // Font size buttons
  fontSizeControls.addEventListener('click', function(e) {
    if (e.target.tagName === 'BUTTON') {
      // Remove active class from all buttons
      fontSizeControls.querySelectorAll('button').forEach(btn => btn.classList.remove('active'));
      
      // Add active class to clicked button
      e.target.classList.add('active');
      
      // Preview font size
      if (currentTab) {
        chrome.tabs.sendMessage(currentTab.id, {
          action: 'changeFontSize', 
          size: e.target.dataset.size
        });
      }
    }
  });

  // Add click listeners to all radio buttons for instant preview
  themeRadios.forEach(radio => {
    radio.addEventListener('change', function() {
      // Highlight selected option visually
      showStatus(`${this.value.charAt(0).toUpperCase() + this.value.slice(1)} theme selected`);
      
      // Preview the theme
      previewTheme(this.value);
    });
  });

  // Apply theme button click handler
  applyButton.addEventListener('click', function() {
    const selectedTheme = document.querySelector('input[name="theme"]:checked').value;
    const intensity = intensitySlider.value;
    const fontSize = document.querySelector('#font-size-controls button.active')?.dataset.size || 'normal';
    const savePerSite = savePerSiteCheckbox.checked;
    
    // Show loading state
    applyButton.textContent = 'Applying...';
    applyButton.disabled = true;
    
    // Save settings
    saveSettings(selectedTheme, intensity, fontSize, savePerSite, function() {
      // Apply the theme to the current tab
      if (currentTab) {
        chrome.tabs.sendMessage(currentTab.id, {
          action: 'applyTheme', 
          theme: selectedTheme,
          intensity: intensity,
          fontSize: fontSize
        }, function(response) {
          // Show success/error message
          if (chrome.runtime.lastError) {
            showStatus('Error applying theme');
          } else {
            showStatus('Theme applied successfully!');
          }
          
          // Reset button state
          setTimeout(() => {
            applyButton.textContent = 'Apply Theme';
            applyButton.disabled = false;
          }, 500);
        });
      } else {
        showStatus('No active tab found');
        applyButton.textContent = 'Apply Theme';
        applyButton.disabled = false;
      }
    });
  });
  
  // Save settings to storage
  function saveSettings(theme, intensity, fontSize, savePerSite, callback) {
    chrome.storage.sync.get(['globalTheme', 'siteThemes'], function(data) {
      const settings = {
        savePerSite: savePerSite,
        themeIntensity: intensity,
        fontSize: fontSize
      };
      
      if (savePerSite) {
        // Save site-specific settings
        const siteThemes = data.siteThemes || {};
        siteThemes[currentUrl] = {
          theme: theme,
          intensity: intensity,
          fontSize: fontSize
        };
        
        settings.siteThemes = siteThemes;
      } else {
        // Save global settings
        settings.globalTheme = theme;
      }
      
      chrome.storage.sync.set(settings, callback);
    });
  }
  
  // Helper function to show status messages
  function showStatus(message) {
    statusElement.textContent = message;
    statusElement.style.opacity = 1;
    
    // Clear the status after 2 seconds
    setTimeout(() => {
      statusElement.style.opacity = 0;
    }, 2000);
  }
  
  // Keyboard shortcuts
  document.addEventListener('keydown', function(e) {
    // Alt+1 through Alt+0 for quick theme switching
    if (e.altKey && e.key >= '0' && e.key <= '9') {
      let index = parseInt(e.key) - 1;
      if (index === -1) index = 9; // Make 0 key select the 10th theme
      
      const themeInputs = document.querySelectorAll('input[name="theme"]');
      if (index < themeInputs.length) {
        themeInputs[index].checked = true;
        themeInputs[index].dispatchEvent(new Event('change'));
      }
    }
    
    // Alt+A to apply theme
    if (e.altKey && e.key === 'a') {
      applyButton.click();
    }
  });
  
  // Show keyboard shortcuts help
  document.getElementById('show-shortcuts').addEventListener('click', function() {
    const shortcutsDialog = document.getElementById('shortcuts-dialog');
    shortcutsDialog.style.display = 'block';
  });
  
  document.getElementById('close-shortcuts').addEventListener('click', function() {
    document.getElementById('shortcuts-dialog').style.display = 'none';
  });
});

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "previewTheme" || request.action === "applyTheme") {
    applyTheme(request.theme, request.intensity);
    sendResponse({ success: true });
  } else if (request.action === "changeFontSize") {
    changeFontSize(request.size);
    sendResponse({ success: true });
  }
  return true;
});

// Function to apply theme to the page
function applyTheme(theme, intensity) {
  // Remove any existing theme classes
  document.body.classList.remove(
    'theme-dark',
    'theme-light',
    'theme-sepia',
    'theme-blue',
    'theme-green',
    'theme-nord',
    'theme-mint',
    'theme-solarized',
    'theme-purple'
  );

  // If theme is none, just return after removing classes
  if (theme === 'none') return;

  // Add the new theme class
  document.body.classList.add(`theme-${theme}`);

  // Apply intensity by adjusting the opacity/strength of the theme
  const intensityValue = intensity / 100;
  const style = document.getElementById('theme-intensity') || document.createElement('style');
  style.id = 'theme-intensity';
  
  // Adjust filter intensity based on theme
  let filterStyle = '';
  switch (theme) {
    case 'dark':
      filterStyle = `filter: invert(${90 * intensityValue}%) hue-rotate(180deg) !important;`;
      break;
    case 'sepia':
      filterStyle = `filter: sepia(${100 * intensityValue}%) !important;`;
      break;
    case 'blue':
      filterStyle = `filter: sepia(${20 * intensityValue}%) hue-rotate(${190 * intensityValue}deg) brightness(${105 * intensityValue}%) !important;`;
      break;
    case 'green':
      filterStyle = `filter: hue-rotate(${80 * intensityValue}deg) saturate(${0.8 * intensityValue}) !important;`;
      break;
    default:
      // For other themes, adjust the opacity of the background color
      filterStyle = `opacity: ${intensityValue} !important;`;
  }

  style.textContent = `
    .theme-${theme} {
      ${filterStyle}
    }
    .theme-${theme} img:not([src*=".svg"]),
    .theme-${theme} video,
    .theme-${theme} canvas,
    .theme-${theme} iframe {
      filter: none !important;
    }
  `;

  if (!style.parentNode) {
    document.head.appendChild(style);
  }
}

// Function to change font size
function changeFontSize(size) {
  // Remove any existing font size classes
  document.body.classList.remove(
    'font-size-small',
    'font-size-normal',
    'font-size-large',
    'font-size-x-large'
  );

  // Add the new font size class
  document.body.classList.add(`font-size-${size}`);
}
