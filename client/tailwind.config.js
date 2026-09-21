/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: { 800: '#111a2e', 900: '#0b1220', 950: '#070c17' },
        brand: { 50: '#eef2ff', 100: '#e0e7ff', 500: '#6366f1', 600: '#4f46e5', 700: '#4338ca' },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
