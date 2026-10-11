/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Design option A ("clear and calm", chosen 11 Oct 2026). Text colours
        // pass 4.5:1 on white: ink 18:1, body 9.9:1, muted 6.1:1.
        ink: '#0E1116',
        body: '#3D4451',
        muted: '#5B6270',
        line: '#E6E8EC',
        surface: '#F7F7F8',
        brand: { DEFAULT: '#4338CA', dark: '#3730A3', deep: '#1E1B6B', soft: '#EEF0FF' },
        primary: {
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
          950: '#082f49',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'Noto Sans', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
