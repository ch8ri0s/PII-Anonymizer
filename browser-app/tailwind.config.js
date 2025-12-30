/** @type {import('tailwindcss').Config} */
export default {
  // Extend shared preset for unified design tokens
  presets: [require('../shared/tailwind-preset')],

  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}"
  ],

  theme: {
    extend: {
      // Browser-app specific overrides (if any)
    }
  },

  plugins: []
};
