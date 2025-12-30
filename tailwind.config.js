/** @type {import('tailwindcss').Config} */
module.exports = {
  // Extend shared preset for unified design tokens
  presets: [require('./shared/tailwind-preset')],

  content: [
    "./index.html",
    "./src/**/*.{js,ts}",
    "./renderer.js",
    "./*.html"
  ],

  theme: {
    extend: {
      // Electron-specific overrides (if any)
      // Keep backward compatibility with existing primary scale
      colors: {
        // Legacy primary scale for backward compatibility
        // New code should use semantic colors from preset (primary, secondary, etc.)
        'primary-legacy': {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        }
      },
    }
  },

  plugins: []
};
