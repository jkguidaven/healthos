/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      fontFamily: {
        // Poppins — friendly geometric sans, the canonical "consumer health app" font.
        // Used everywhere. Bold weights for headlines, regular for body.
        sans: ['Poppins_400Regular'],
        'sans-medium': ['Poppins_500Medium'],
        'sans-semibold': ['Poppins_600SemiBold'],
        'sans-bold': ['Poppins_700Bold'],
      },
      colors: {
        // Friendly mint/teal palette — consumer health app aesthetic
        mint: {
          50: '#F0FBF7', // Lightest tint — page background top
          100: '#D8F3E8', // Page background middle
          200: '#B5E8D5', // Soft accent
          300: '#7DD9B8', // Light primary
          400: '#4FCFB8', // Primary mint
          500: '#2BBF9E', // Primary deep
          600: '#1D9E75', // Brand green (existing)
          700: '#15805F',
        },
        slate: {
          0: '#FFFFFF',
          50: '#F8FAFA',
          100: '#EEF1F1',
          200: '#D9DEDE',
          400: '#8A9494',
          600: '#5B6868',
          800: '#2A3636',
          900: '#1A2727', // Primary text
        },
        // Brand pillar colors retained for data
        brand: {
          green: '#1D9E75',
          purple: '#534AB7',
          amber: '#EF9F27',
          coral: '#D85A30',
          blue: '#185FA5',
        },
      },
    },
  },
  plugins: [],
};
