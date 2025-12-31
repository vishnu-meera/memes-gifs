/* ============================================
   THEME TOGGLE FUNCTIONALITY
   ============================================ */

class ThemeManager {
    constructor() {
        this.theme = this.getInitialTheme();
        this.toggleButton = null;
        this.init();
    }

    // Get initial theme from localStorage or system preference
    getInitialTheme() {
        // Check localStorage first
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) {
            return savedTheme;
        }

        // Fall back to system preference
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
            return 'light';
        }

        // Default to dark
        return 'dark';
    }

    // Initialize theme system
    init() {
        // Apply initial theme
        this.applyTheme(this.theme);

        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupToggle());
        } else {
            this.setupToggle();
        }

        // Listen for system theme changes
        this.watchSystemTheme();
    }

    // Setup toggle button event listener
    setupToggle() {
        this.toggleButton = document.getElementById('themeToggle');
        
        if (this.toggleButton) {
            this.toggleButton.addEventListener('click', () => this.toggle());
        }
    }

    // Apply theme to document
    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        this.theme = theme;
        
        // Save to localStorage
        localStorage.setItem('theme', theme);

        // Update meta theme-color for mobile browsers
        this.updateMetaThemeColor(theme);
    }

    // Toggle between themes
    toggle() {
        const newTheme = this.theme === 'dark' ? 'light' : 'dark';
        this.applyTheme(newTheme);

        // Animate the toggle (optional)
        this.animateToggle();
    }

    // Update mobile browser theme color
    updateMetaThemeColor(theme) {
        let metaThemeColor = document.querySelector('meta[name="theme-color"]');
        
        if (!metaThemeColor) {
            metaThemeColor = document.createElement('meta');
            metaThemeColor.name = 'theme-color';
            document.head.appendChild(metaThemeColor);
        }

        // Set color based on theme
        const color = theme === 'dark' ? '#161b22' : '#f6f8fa';
        metaThemeColor.content = color;
    }

    // Watch for system theme changes
    watchSystemTheme() {
        if (window.matchMedia) {
            const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
            
            darkModeQuery.addEventListener('change', (e) => {
                // Only auto-switch if user hasn't manually set a preference
                if (!localStorage.getItem('theme')) {
                    this.applyTheme(e.matches ? 'dark' : 'light');
                }
            });
        }
    }

    // Optional: Animate toggle button
    animateToggle() {
        if (this.toggleButton) {
            this.toggleButton.style.transform = 'scale(0.9)';
            setTimeout(() => {
                this.toggleButton.style.transform = 'scale(1)';
            }, 150);
        }
    }

    // Get current theme
    getCurrentTheme() {
        return this.theme;
    }
}

// Initialize theme manager
const themeManager = new ThemeManager();

// Export for use in other scripts
window.themeManager = themeManager;
