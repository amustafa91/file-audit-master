/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./App.tsx",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'primary': '#0078d4',
        'accent': '#005a9e',
        'secondary': '#f3f3f3',
        'base-100': '#ffffff',
        'base-200': '#f9f9f9',
        'base-300': '#e9e9e9',
        'text-primary': '#0d0d0d',
        'text-secondary': '#606060',
        'border': '#d9d9d9',
      },
      fontFamily: {
        sans: ['"Segoe UI Variable"', '"Segoe UI"', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Inter"', 'sans-serif'],
      },
      gridTemplateColumns: {
        'changelog': '190px 130px 150px minmax(0, 1fr) 80px',
      }
    },
  },
  plugins: [],
}