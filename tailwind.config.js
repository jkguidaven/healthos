/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './App.tsx',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
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
