/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['system-ui', 'sans-serif'],
      },
      colors: {
        accent: '#6366f1',
        'accent-dark': '#4f46e5',
      }
    },
  },
  plugins: [],
}
